#!/usr/bin/env python3
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


def wait_for(path: pathlib.Path, timeout: float = 5) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.is_file():
            return
        time.sleep(0.05)
    raise AssertionError(f"timed out waiting for {path}")


def main() -> int:
    distribution = pathlib.Path(sys.argv[1]).resolve()
    with tempfile.TemporaryDirectory() as temporary:
        root = pathlib.Path(temporary)
        evidence = {
            "identity": "SYNTH",
            "version": "fixture",
            "epistemic_class": "OBSERVED",
            "timestamp": "2026-09-13T00:00:00Z",
            "observed_surfaces": [{"id": "synth.evidence", "locator": str(root / "evidence.json")}],
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
            with urllib.request.urlopen(endpoint + "/", timeout=1) as response:
                assert b"Observed surfaces" in response.read()
            with urllib.request.urlopen(endpoint + "/api/state", timeout=1) as response:
                assert json.load(response)["identity"] == "SYNTH"
            readiness = subprocess.run([distribution / "bin" / "readiness"], env=environment, check=False)
            assert readiness.returncode == 0
        finally:
            process.terminate()
            process.wait(timeout=3)

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
    print("SYNTH-WEB independent runtime checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
