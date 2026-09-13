# SYNTH-WEB

Independent factual web projection used by `SYNTH-REALIZATION-001`.

It consumes only a resolved public `synth.evidence` surface, serves a local
human interface, and emits a versioned runtime witness. It does not include
SYNTH headers, inspect SYNTH private state, or require the SYNTH source tree.

## Build and test

```bash
cmake -S . -B build
cmake --build build --parallel
ctest --test-dir build --output-on-failure
cmake --build build --target package
```

Runtime requirement: Python 3.11+ standard library (PSF-2.0). The HTTP
implementation is Python's maintained `http.server`; no socket server is
implemented locally. CMake 3.25+ (BSD-3-Clause) provides the build and packaging
workflow. There are no third-party Python packages or web frameworks.

License: GPL-3.0-only.
