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


def test_baseline_and_dynamic_runtime(distribution: pathlib.Path) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = pathlib.Path(temporary)
        
        # Initial fixture: 1 surface, 0 relations
        evidence = {
            "identity": "SYNTH",
            "version": "0.1.0",
            "epistemic_class": "OBSERVED",
            "timestamp": "2026-09-13T00:00:00Z",
            "observed_surfaces": [
                {"id": "synth.evidence", "owner": "SYNTH", "kind": "file", "locator": str(root / "evidence.json"), "direction": "outbound", "media_type": "application/json", "observability": "public-surface"}
            ],
            "observed_relations": [],
        }
        evidence_path = root / "evidence.json"
        evidence_path.write_text(json.dumps(evidence), encoding="utf-8")
        
        resolved_path = root / "resolved.json"
        resolved_path.write_text(json.dumps({
            "epistemic_class": "RESOLVED",
            "surfaces": [{"id": "synth.evidence", "locator": str(evidence_path)}],
        }), encoding="utf-8")
        
        witness_path = root / "witness.json"
        environment = {
            "PATH": "/usr/bin:/bin",
            "SYNTH_REALIZATION_ID": "test-realization",
            "SYNTH_WITNESS_PATH": str(witness_path),
            "SYNTH_RESOLVED_SURFACES_PATH": str(resolved_path),
        }
        
        process = subprocess.Popen([distribution / "bin" / "synth-web"], env=environment)
        try:
            wait_for(witness_path)
            witness = json.loads(witness_path.read_text(encoding="utf-8"))
            assert witness["identity"] == "synth-web"
            assert witness["consumed_surfaces"][0]["evidence_sha256"] == hashlib.sha256(evidence_path.read_bytes()).hexdigest()
            endpoint = witness["provided_surfaces"][0]["locator"]

            # Test Static UI served
            with urllib.request.urlopen(endpoint + "/", timeout=1) as response:
                body = response.read()
                assert b"Observed surfaces" in body
                assert b"Relational Field" in body
                assert b"relational-field" in body

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

            # Test Readiness Script
            readiness = subprocess.run([distribution / "bin" / "readiness"], env=environment, check=False)
            assert readiness.returncode == 0

            # Dynamic Update Test: Modify evidence on disk (add 2 surfaces and 1 relation)
            updated_evidence = {
                "identity": "SYNTH",
                "version": "0.1.1",
                "epistemic_class": "OBSERVED",
                "timestamp": "2026-09-13T01:00:00Z",
                "observed_surfaces": [
                    {"id": "synth.evidence", "owner": "SYNTH", "kind": "file", "locator": str(evidence_path), "direction": "outbound", "media_type": "application/json", "observability": "public-surface"},
                    {"id": "synth.control", "owner": "SYNTH", "kind": "socket", "locator": "ipc:///tmp/synth.sock", "direction": "inbound", "media_type": "application/octet-stream", "observability": "observed-endpoint"},
                    {"id": "synth.metrics", "owner": "SYNTH", "kind": "metrics", "locator": "http://127.0.0.1:9090/metrics", "direction": "outbound", "media_type": "text/plain", "observability": "observed-endpoint"},
                ],
                "observed_relations": [
                    {"source": "SYNTH", "target": "synth-web", "surface": "synth.evidence", "epistemic_class": "OBSERVED", "observed_at": "2026-09-13T01:00:00Z"}
                ],
            }
            evidence_path.write_text(json.dumps(updated_evidence), encoding="utf-8")
            
            # Wait for watcher thread in synth-web to detect digest change and update witness
            time.sleep(0.5)
            
            updated_witness = json.loads(witness_path.read_text(encoding="utf-8"))
            new_sha = hashlib.sha256(evidence_path.read_bytes()).hexdigest()
            assert updated_witness["consumed_surfaces"][0]["evidence_sha256"] == new_sha
            
            with urllib.request.urlopen(endpoint + "/api/state", timeout=1) as response:
                new_state = json.load(response)
                assert new_state["version"] == "0.1.1"
                assert len(new_state["observed_surfaces"]) == 3
                assert len(new_state["observed_relations"]) == 1

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
