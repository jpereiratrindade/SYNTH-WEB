# SYNTH-WEB

Independent factual web projection used by `SYNTH-REALIZATION-001`.

It consumes only a resolved public `synth.evidence` surface, serves a local
human interface, and emits a versioned runtime witness. It does not include
SYNTH headers, inspect SYNTH private state, or require the SYNTH source tree.

$$\boxed{\text{SYNTH fornece realidade} \quad;\quad \text{SYNTH-WEB fornece experiência}}$$

## Experience Architecture

SYNTH-WEB implements a spatial **Relational Field** interface following progressive disclosure:

$$\boxed{\text{compreensão (NOW)} \longrightarrow \text{inspeção (INSPECT)} \longrightarrow \text{evidência (EVIDENCE)}}$$

- **NOW (Comprehension)**: Dynamic SVG topological field displaying the central observed `SYNTH` entity, orbital surface positions, and witnessed relation vectors without hardcoded counts. Zero relations are rendered as an honest factual state.
- **INSPECT (Contextual Inspection)**: Non-disruptive contextual drawer/bottom sheet categorizing entity properties with strict epistemic separation (`OBSERVED`, `DERIVED BY WEB`, `LOCAL STATE`).
- **EVIDENCE (Auditable Evidence)**: Formatted raw JSON viewer with verified SHA-256 digest provenance.

See [docs/SYNTH-WEB-EXPERIENCE-001-v0.1.0.md](docs/SYNTH-WEB-EXPERIENCE-001-v0.1.0.md) for detailed specifications.

## Endpoints

- `GET /`: Relational Field human web interface.
- `GET /health`: Self-observed HTTP readiness endpoint.
- `GET /api/state`: Current observed evidence state JSON.
- `GET /api/raw`: Raw canonical evidence JSON.
- `GET /api/meta`: Web realization metadata, loaded timestamps, and SHA-256 digest.
- `GET /api/events`: Server-Sent Events (SSE) stream for real-time dynamic state push.

## Build and test

```bash
cmake -S . -B build
cmake --build build --parallel
ctest --test-dir build --output-on-failure
cmake --build build --target package
```

Runtime requirement: Python 3.11+ standard library (PSF-2.0). The HTTP
implementation uses Python's standard `http.server` with SSE streaming and
thread-safe background observation; no external web frameworks or Node runtime
dependencies are required. CMake 3.25+ (BSD-3-Clause) provides the build and packaging
workflow.

License: GPL-3.0-only.
