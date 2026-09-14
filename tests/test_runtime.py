#!/usr/bin/env python3
"""Comprehensive test suite for SYNTH-WEB independent runtime and factual projection."""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import urllib.request


def wait_for(path: pathlib.Path, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.is_file():
            return
        time.sleep(0.05)
    raise AssertionError(f"timed out waiting for {path}")


def wait_for_json(url: str, predicate, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                value = json.load(response)
            if predicate(value):
                return value
        except Exception:
            pass
        time.sleep(0.05)
    raise AssertionError(f"timed out waiting for JSON condition at {url}")


def test_baseline_and_dynamic_runtime(distribution: pathlib.Path) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = pathlib.Path(temporary)
        
        ecosystem_initial = {
            "$schema": "urn:synth:schema:ecosystem-projection:0.1.0",
            "schema_version": "0.1.0",
            "generation": "a" * 64,
            "observed_at": "2026-09-13T00:00:00Z",
            "epistemic_class": "OBSERVED",
            "participants": [{
                "identity": "SYNTH",
                "version": "0.1.0",
                "description": "SYNTH factual core",
                "state": "ACTIVE",
                "epistemic_class": "OBSERVED",
                "registration_evidence_ref": "/observed/foundation.md",
                "realization_id": None,
                "realization_evidence_ref": "/observed/evidence.json",
                "declared_surfaces": [],
                "observed_surfaces": [],
            }],
            "surfaces": [],
            "relations": [],
        }
        ecosystem_updated = {
            **ecosystem_initial,
            "generation": "b" * 64,
            "observed_at": "2026-09-13T01:00:00Z",
            "surfaces": [{
                "id": "interface.human.web.v1",
                "providers": [{
                    "identity": "context-lab",
                    "state": "ACTIVE",
                    "epistemic_class": "OBSERVED",
                    "kind": "http",
                    "media_type": "text/html",
                    "locator": "http://127.0.0.1:9000",
                    "evidence_ref": "/observed/context-lab-witness.json",
                }],
            }],
        }

        # Initial immutable evidence fixture: 1 surface, 0 relations.
        evidence = {
            "identity": "SYNTH",
            "version": "0.1.0",
            "epistemic_class": "OBSERVED",
            "timestamp": "2026-09-13T00:00:00Z",
            "observed_surfaces": [
                {"id": "synth.evidence", "owner": "SYNTH", "kind": "file", "locator": str(root / "evidence.json"), "direction": "outbound", "media_type": "application/json", "observability": "public-surface"}
            ],
            "observed_relations": [],
            "ecosystem": ecosystem_initial,
        }
        evidence_path = root / "evidence.json"
        evidence_path.write_text(json.dumps(evidence), encoding="utf-8")
        
        resolved_path = root / "resolved.json"
        resolved_path.write_text(json.dumps({
            "epistemic_class": "RESOLVED",
            "surfaces": [{"id": "synth.evidence", "locator": str(evidence_path)}],
        }), encoding="utf-8")
        
        witness_path = root / "witness.json"
        stream_state = root / "ecosystem.json"
        stream_state.write_text(json.dumps(ecosystem_initial), encoding="utf-8")
        stream_program = root / "ecosystem-stream.py"
        stream_program.write_text(
            """import json, os, pathlib, time
path = pathlib.Path(os.environ[\"ECOSYSTEM_TEST_STATE\"])
generation = None
while True:
    try:
        value = json.loads(path.read_text(encoding=\"utf-8\"))
        if value.get(\"generation\") != generation:
            print(json.dumps(value), flush=True)
            generation = value.get(\"generation\")
    except Exception:
        pass
    time.sleep(0.05)
""",
            encoding="utf-8",
        )
        environment = {
            "PATH": "/usr/bin:/bin",
            "SYNTH_REALIZATION_ID": "test-realization",
            "SYNTH_WITNESS_PATH": str(witness_path),
            "SYNTH_RESOLVED_SURFACES_PATH": str(resolved_path),
            "SYNTH_ECOSYSTEM_STREAM": json.dumps({
                "$schema": "urn:synth:capability:ecosystem-stream:0.1.0",
                "surface": "synth.ecosystem.stream.v1",
                "media_type": "application/x-ndjson",
                "argv": [sys.executable, str(stream_program)],
                "environment": {"ECOSYSTEM_TEST_STATE": str(stream_state)},
            }),
        }
        
        process = subprocess.Popen([distribution / "bin" / "synth-web"], env=environment)
        try:
            wait_for(witness_path)
            witness = json.loads(witness_path.read_text(encoding="utf-8"))
            witness_bytes = witness_path.read_bytes()
            evidence_bytes = evidence_path.read_bytes()
            assert witness["identity"] == "synth-web"
            assert witness["consumed_surfaces"][0]["evidence_sha256"] == hashlib.sha256(evidence_path.read_bytes()).hexdigest()
            assert {item["id"] for item in witness["provided_surfaces"]} == {
                "synth-web.http", "interface.human.web.v1"
            }
            endpoint = witness["provided_surfaces"][0]["locator"]

            # Test Static UI served
            with urllib.request.urlopen(endpoint + "/", timeout=1) as response:
                body = response.read()
                assert b"Observed surfaces" in body
                assert b"Relational Field" in body
                assert b"relational-field" in body
                assert b"Ecosystem" in body
                assert b"ecosystem-providers" in body

            # Test API State
            with urllib.request.urlopen(endpoint + "/api/state", timeout=1) as response:
                data = json.load(response)
                assert data["identity"] == "SYNTH"
                assert len(data["observed_surfaces"]) == 1
                assert len(data["observed_relations"]) == 0

            # Test API Meta
            with urllib.request.urlopen(endpoint + "/api/meta", timeout=1) as response:
                meta = json.load(response)
                assert meta["web_identity"] == "synth-web"
                assert meta["is_live"] is True
                assert meta["source_digest"] == witness["consumed_surfaces"][0]["evidence_sha256"]

            current_ecosystem = wait_for_json(
                endpoint + "/api/ecosystem",
                lambda value: value.get("generation") == ecosystem_initial["generation"],
            )
            assert current_ecosystem["surfaces"] == []

            # Test Readiness Script
            readiness = subprocess.run([distribution / "bin" / "readiness"], env=environment, check=False)
            assert readiness.returncode == 0

            # A separate live stream changes while evidence and witness remain pinned.
            stream_state.write_text(json.dumps(ecosystem_updated), encoding="utf-8")
            live_ecosystem = wait_for_json(
                endpoint + "/api/ecosystem",
                lambda value: value.get("generation") == ecosystem_updated["generation"],
            )
            assert live_ecosystem["surfaces"][0]["providers"][0]["identity"] == "context-lab"
            assert evidence_path.read_bytes() == evidence_bytes
            assert witness_path.read_bytes() == witness_bytes

            with urllib.request.urlopen(endpoint + "/api/state", timeout=1) as response:
                pinned_state = json.load(response)
                assert pinned_state["version"] == "0.1.0"
                assert len(pinned_state["observed_surfaces"]) == 1
                assert len(pinned_state["observed_relations"]) == 0

        finally:
            process.terminate()
            process.wait(timeout=3)

        # Test Fail-Readiness Option
        failed_witness = root / "failed-witness.json"
        environment["SYNTH_WITNESS_PATH"] = str(failed_witness)
        failed = subprocess.Popen([distribution / "bin" / "synth-web", "--fail-readiness"], env=environment)
        try:
            time.sleep(0.2)
            assert not failed_witness.exists()
            assert subprocess.run([distribution / "bin" / "readiness"], env=environment, check=False).returncode != 0
        finally:
            failed.terminate()
            failed.wait(timeout=3)


def main() -> int:
    distribution = pathlib.Path(sys.argv[1]).resolve()
    test_baseline_and_dynamic_runtime(distribution)
    print("ALL SYNTH-WEB comprehensive runtime and dynamic checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
