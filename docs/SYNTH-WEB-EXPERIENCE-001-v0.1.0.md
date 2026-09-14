# SYNTH-WEB-EXPERIENCE-001 — Especificação de Design e Arquitetura de Experiência
## v0.1.0 — design-candidate

```context-metadata+json
{
  "document": {
    "id": "SYNTH-WEB-EXPERIENCE-001-SPEC",
    "version": "0.1.0",
    "status": "design-candidate",
    "title": "Especificação de Design e Experiência do SYNTH-WEB",
    "project": "SYNTH-WEB",
    "created_at": "2026-09-13",
    "language": "pt-BR",
    "license": "GPL-3.0-only"
  },
  "basis": {
    "architectural_rule": "SYNTH fornece realidade; SYNTH-WEB fornece experiência.",
    "boundary": "Integração somente por superfícies e descritores públicos versionados do SYNTH."
  }
}
```

---

## 1. Wireframes

### 1.1 Desktop Wireframe (1440 × 900)

```text
+---------------------------------------------------------------------------------------------------------+
| [SYNTH]  [● Live Projection]   Observed 14s ago · Fresh             [3 surfaces] [1 relation]   [Theme ☀/☾] |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|                                     (● synth.control)                                                   |
|                                             |                                                           |
|                                             |                                 +-----------------------+ |
|                                   +-------------------+                       | INSPECT: surface      | |
|                                   |       SYNTH       |                       | synth.evidence        | |
|                                   |   v0.1.0 OBSERVED |                       | [OBSERVED]            | |
|                                   +-------------------+                       |                       | |
|                                       /           \                           | Kind: file            | |
|                                      /             \                          | Direction: outbound   | |
|                 (● synth.evidence)                 (● synth.metrics)          | Locator: /tmp/...     | |
|                         \                                                     | Observability: public | |
|                          \ [OBSERVED]                                         |                       | |
|                           ▼                                                   | [View Raw Evidence →] | |
|                  (● synth-web)                                                |                       | |
|                                                                               +-----------------------+ |
|                                                                                                         |
| Status: All observed entities operational · Snapshot digest: 8f4e2b... (Verified)                      |
+---------------------------------------------------------------------------------------------------------+
| [Keyboard: Tab/Arrows to navigate nodes · Enter to inspect · Esc to close drawer · Space to toggle raw] |
+---------------------------------------------------------------------------------------------------------+
```

### 1.2 Mobile Wireframe (390 × 844)

```text
+-----------------------------------+
| SYNTH                [Live ●] [☾] |
| Observed 14s ago · Fresh (<30s)   |
| 3 surfaces · 1 relation           |
+-----------------------------------+
|                                   |
|       (● synth.control)           |
|               |                   |
|       +---------------+           |
|       |     SYNTH     |           |
|       +---------------+           |
|          /         \              |
|   (● evidence)   (● metrics)      |
|         \                         |
|          ▼                        |
|     (● synth-web)                 |
|                                   |
| [Factual empty state if 0 rels]   |
+-----------------------------------+
| ▲ BOTTOM SHEET (Contextual)       |
| --------------------------------- |
| Surface: synth.evidence           |
| Epistemic Class: OBSERVED         |
| Direction: outbound | Kind: file  |
| Locator: .../evidence.json        |
| [View Raw JSON] [Close ✕]         |
+-----------------------------------+
```

---

## 2. Tokens Visuais (Design Tokens)

### 2.1 Cores e Modos (Light / Dark / System)

```css
:root {
  /* Dark Theme (Default) */
  --bg-canvas: #090d14;
  --bg-surface: #111827;
  --bg-surface-elevated: #1a2234;
  --bg-overlay: rgba(9, 13, 20, 0.75);
  
  --border-subtle: #1f293d;
  --border-prominent: #334155;
  
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  
  --accent-system: #6366f1;     /* Indigo: Core SYNTH entity */
  --accent-surface: #38bdf8;    /* Sky: Surfaces */
  --accent-relation: #2dd4bf;   /* Teal: Observed Relations */
  --accent-live: #10b981;       /* Emerald: Live status */
  --accent-stale: #f59e0b;      /* Amber: Aging evidence */
  --accent-error: #f43f5e;      /* Rose: Unavailable/Invalid */
  
  --epistemic-observed: #10b981;
  --epistemic-derived: #818cf8;
  --epistemic-local: #94a3b8;
  
  --font-human: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-evidence: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
}

[data-theme="light"] {
  --bg-canvas: #f8fafc;
  --bg-surface: #ffffff;
  --bg-surface-elevated: #f1f5f9;
  --bg-overlay: rgba(248, 250, 252, 0.8);
  
  --border-subtle: #e2e8f0;
  --border-prominent: #cbd5e1;
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
}
```

---

## 3. Matemática do Campo Relacional (Relational Field)

O layout do canvas SVG é gerado dinamicamente:
1. **Centro**: Posição fixada no baricentro $(C_x, C_y)$ do viewBox SVG.
2. **Superfícies**: Distribuídas ao redor do centro com raio orbital $R = \min(W, H) \times 0.32$. Ângulo para a superfície $i$ de $N$:
   $$\theta_i = -\frac{\pi}{2} + \frac{2\pi \cdot i}{N}$$
   $$(x_i, y_i) = (C_x + R \cos \theta_i, \; C_y + R \sin \theta_i)$$
3. **Participantes Externos**: Quando uma relação aponta para um `target` distinto de SYNTH, este é posicionado em raio estendido $R_{ext} = R \times 1.45$ alinhado com a superfície intermediária.
4. **Zero Relações**: Quando `observed_relations.length === 0`, o campo não desenha arestas arbitrárias, apresentando o estado factual com um indicador discreto.

---

## 4. Separação Epistemológica Obrigatória

| Camada | Exemplos | Tratamento Visual |
|---|---|---|
| **OBSERVED** | `identity`, `version`, `surfaces`, `relations`, `timestamp` | Badge esmeralda `OBSERVED`, dados protegidos |
| **DERIVED BY WEB** | Idade da evidência (`14s ago`), frescor (`fresh/aging/stale`), contagens, layout | Badge índigo `DERIVED BY WEB`, texto explicativo |
| **LOCAL WEB STATE** | Tema (`dark/light/system`), nó selecionado, gaveta aberta/fechada | Badge neutro `LOCAL STATE` |

---

## 5. Matriz de Estados Testáveis

1. **1 superfície / 0 relações**: Nó central + 1 satélite orbital. Indicador de zero relações.
2. **3 superfícies / 0 relações**: Nó central + 3 satélites orbitais equidistantes.
3. **3 superfícies / 1 relação**: Nó central + 3 satélites + 1 participante conectado direcionalmente.
4. **Múltiplas relações**: Grafo direcionado completo renderizado com setas e rótulos de relação.
5. **Evidência Indisponível**: Banner e estado claro com status `UNAVAILABLE` sem falhas silenciosas.
6. **Evidência Inválida**: Validação rejeita formato corrompido ou epistemic_class não-OBSERVED.
7. **Evidência Antiga (Stale)**: Ticker de tempo >120s reflete estado `aging/stale` derivado pela web.

---

## 6. Evidência pinada e ecossistema vivo

O documento resolvido de `synth.evidence` permanece imutável durante toda a
realização. `/api/state` e `/api/raw` expõem esse snapshot, e o witness que o
atesta é escrito uma única vez antes da promoção.

A visão atual do ecossistema chega separadamente pela capacidade pública
`synth.ecosystem.stream.v1`, descrita em `SYNTH_ECOSYSTEM_STREAM`. O descritor
versionado contém argv e ambiente suficientes para iniciar uma consulta local
sem shell e sem acesso direto ao estado privado do SYNTH.

```text
synth.evidence                  -> snapshot auditável e pinado
synth.ecosystem.stream.v1       -> projeções factuais presentes em NDJSON
interface.human.web.v1          -> interface humana descoberta semanticamente
```

O backend mantém a projeção mais recente em memória, oferece
`GET /api/ecosystem` e encaminha mudanças ao navegador por SSE. Uma falha do
stream não invalida nem substitui a evidência pinada.

## 7. Descoberta de interfaces humanas

O SYNTH-WEB publica duas superfícies no mesmo endpoint:

- `synth-web.http`, preservada por compatibilidade;
- `interface.human.web.v1`, contrato compartilhado `http + text/html`.

O menu **Ecossistema** mostra apenas provedores `ACTIVE + OBSERVED` dessa
superfície. Os links são construídos com APIs DOM e abertos com
`noopener noreferrer`; nenhum HTML vindo da projeção é interpolado.

## 8. Critérios de aceitação

```text
PINNED_EVIDENCE_UNCHANGED       PASS
IMMUTABLE_WITNESS               PASS
LIVE_ECOSYSTEM_SEPARATE         PASS
SEMANTIC_HUMAN_SURFACE          PASS
ECOSYSTEM_HTTP_ADAPTER          PASS
CTEST                           PASS
CI                              PENDING
```
