/**
 * SYNTH-WEB Relational Field Controller (v0.1.0)
 * Independent factual web projection of resolved SYNTH evidence.
 */

// Application State
const appState = {
  state: null,
  meta: null,
  selectedEntity: null,
  isLiveSSE: false,
  eventSource: null,
  lastObservedDate: null,
  pollTimer: null,
  tickerTimer: null,
  theme: localStorage.getItem("synth-web-theme") || "system",
};

// DOM Elements Cache
const dom = {
  root: document.documentElement,
  brandIdentity: document.getElementById("brand-identity"),
  versionTag: document.getElementById("version-tag"),
  projectionPill: document.getElementById("projection-pill"),
  statusDot: document.getElementById("status-dot"),
  projectionLabel: document.getElementById("projection-label"),
  evidenceAge: document.getElementById("evidence-age"),
  freshnessBadge: document.getElementById("freshness-badge"),
  metricSurfaces: document.getElementById("metric-surfaces"),
  metricRelations: document.getElementById("metric-relations"),
  epistemicBadge: document.getElementById("epistemic-badge"),
  sourceDesc: document.getElementById("source-desc"),
  sourceName: document.getElementById("source-name"),
  provenanceTime: document.getElementById("provenance-time"),
  fieldNotice: document.getElementById("field-empty-notice"),
  fieldNoticeText: document.getElementById("field-notice-text"),
  svgGrid: document.getElementById("svg-background-grid"),
  svgRelations: document.getElementById("svg-relations"),
  svgTracks: document.getElementById("svg-orbit-tracks"),
  svgNodes: document.getElementById("svg-nodes"),
  srSurfaces: document.getElementById("sr-surfaces-list"),
  srRelations: document.getElementById("sr-relations-list"),
  themeToggle: document.getElementById("theme-toggle"),
  themeIcon: document.getElementById("theme-icon"),
  btnOpenRaw: document.getElementById("btn-open-raw"),
  drawer: document.getElementById("inspector-drawer"),
  drawerTitle: document.getElementById("drawer-title"),
  drawerEntityType: document.getElementById("drawer-entity-type"),
  drawerEpistemicTag: document.getElementById("drawer-epistemic-tag"),
  drawerEpistemicText: document.getElementById("drawer-epistemic-text"),
  drawerProperties: document.getElementById("drawer-properties"),
  btnDrawerInspectRaw: document.getElementById("btn-drawer-inspect-raw"),
  btnCloseDrawer: document.getElementById("btn-close-drawer"),
  rawModal: document.getElementById("raw-modal"),
  rawDigestVal: document.getElementById("raw-digest-val"),
  rawJsonContent: document.getElementById("raw-json-content"),
  btnCopyRaw: document.getElementById("btn-copy-raw"),
  btnCloseRaw: document.getElementById("btn-close-raw"),
};

// --- Theme Management ---
function applyTheme(theme) {
  appState.theme = theme;
  dom.root.dataset.theme = theme;
  localStorage.setItem("synth-web-theme", theme);
  const icons = { system: "◐", dark: "☾", light: "☀" };
  if (dom.themeIcon) dom.themeIcon.textContent = icons[theme] || "◐";
}

function cycleTheme() {
  const next = appState.theme === "system" ? "dark" : appState.theme === "dark" ? "light" : "system";
  applyTheme(next);
}

// --- Temporal & Freshness Calculations (Derived by Web) ---
function updateFreshnessTicker() {
  if (!appState.lastObservedDate) {
    dom.evidenceAge.textContent = "—";
    dom.freshnessBadge.textContent = "OBSERVING";
    dom.freshnessBadge.className = "metric-badge";
    dom.statusDot.className = "status-indicator";
    return;
  }

  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - appState.lastObservedDate.getTime()) / 1000));

  let ageText = "";
  if (elapsedSeconds < 60) {
    ageText = `${elapsedSeconds}s ago`;
  } else if (elapsedSeconds < 3600) {
    ageText = `${Math.floor(elapsedSeconds / 60)}m ago`;
  } else {
    ageText = `${Math.floor(elapsedSeconds / 3600)}h ago`;
  }

  dom.evidenceAge.textContent = ageText;

  // Derive Freshness (UI interpretation threshold explicitly labeled as derived)
  if (elapsedSeconds < 30) {
    dom.freshnessBadge.textContent = "FRESH";
    dom.freshnessBadge.className = "metric-badge";
    dom.statusDot.className = "status-indicator";
  } else if (elapsedSeconds <= 120) {
    dom.freshnessBadge.textContent = "AGING";
    dom.freshnessBadge.className = "metric-badge aging";
    dom.statusDot.className = "status-indicator aging";
  } else {
    dom.freshnessBadge.textContent = "STALE";
    dom.freshnessBadge.className = "metric-badge stale";
    dom.statusDot.className = "status-indicator stale";
  }
}

// --- Epistemic Data Processing ---
function handleStateUpdate(state) {
  if (!state || typeof state !== "object") return;
  appState.state = state;

  if (state.timestamp) {
    appState.lastObservedDate = new Date(state.timestamp);
  } else {
    appState.lastObservedDate = new Date();
  }

  const identity = state.identity || "SYNTH";
  const version = state.version || "unknown";
  const surfaces = Array.isArray(state.observed_surfaces) ? state.observed_surfaces : [];
  const relations = Array.isArray(state.observed_relations) ? state.observed_relations : [];

  dom.brandIdentity.textContent = identity;
  dom.versionTag.textContent = `v${version}`;
  dom.metricSurfaces.textContent = String(surfaces.length);
  dom.metricRelations.textContent = String(relations.length);
  dom.epistemicBadge.textContent = state.epistemic_class || "OBSERVED";

  const modeLabel = appState.isLiveSSE ? "Live projection" : "Observed snapshot";
  dom.projectionLabel.textContent = modeLabel;

  if (state.timestamp) {
    dom.provenanceTime.textContent = `Snapshot observed at ${state.timestamp}`;
  }

  // Update Accessible Alternative
  updateAccessibleAlternative(surfaces, relations);

  // Render Dynamic Relational Field
  renderRelationalField(identity, version, surfaces, relations);

  // Refresh active drawer if open
  if (appState.selectedEntity) {
    rebindSelectedEntity(surfaces, relations);
  }

  updateFreshnessTicker();
}

function updateAccessibleAlternative(surfaces, relations) {
  dom.srSurfaces.innerHTML = surfaces.length
    ? surfaces.map((s) => `<li><strong>${s.id}</strong>: ${s.locator || "n/a"} (${s.kind || "surface"}, ${s.direction || "bidirectional"})</li>`).join("")
    : "<li>No surfaces observed in this snapshot.</li>";

  dom.srRelations.innerHTML = relations.length
    ? relations.map((r) => `<li><strong>${r.source}</strong> &rarr; <strong>${r.target}</strong> via <code>${r.surface}</code> [${r.epistemic_class || "OBSERVED"}]</li>`).join("")
    : "<li>No relations observed in this snapshot.</li>";
}

// --- Dynamic Relational Field SVG Renderer ---
function renderRelationalField(identity, version, surfaces, relations) {
  // Clear previous dynamic layers
  dom.svgGrid.innerHTML = "";
  dom.svgRelations.innerHTML = "";
  dom.svgTracks.innerHTML = "";
  dom.svgNodes.innerHTML = "";

  const width = 1000;
  const height = 650;
  const cx = width / 2;
  const cy = height / 2;

  // Background subtle grid
  const gridCount = 5;
  for (let i = 1; i <= gridCount; i++) {
    const r = (Math.min(width, height) / 2) * (i / gridCount) * 0.9;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(r));
    circle.setAttribute("class", "svg-grid-line");
    dom.svgGrid.appendChild(circle);
  }

  // 1. Orbital Geometry for Surfaces
  const N = surfaces.length;
  const rx = 280;
  const ry = 190;

  // Draw orbit track
  const track = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  track.setAttribute("cx", String(cx));
  track.setAttribute("cy", String(cy));
  track.setAttribute("rx", String(rx));
  track.setAttribute("ry", String(ry));
  track.setAttribute("class", "orbit-track");
  dom.svgTracks.appendChild(track);

  // Position surfaces along the orbital track
  const surfacePositions = new Map();
  surfaces.forEach((surf, index) => {
    // Top-first distribution
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / (N || 1);
    const sx = cx + rx * Math.cos(angle);
    const sy = cy + ry * Math.sin(angle);
    surfacePositions.set(surf.id, { x: sx, y: sy, surface: surf });
  });

  // 2. Discover External Participants from Relations
  const participantPositions = new Map();
  relations.forEach((rel) => {
    const target = rel.target;
    if (target && target !== identity && !participantPositions.has(target)) {
      const surfPos = surfacePositions.get(rel.surface);
      if (surfPos) {
        // Place participant with an angular and radial offset to avoid label collision
        const angleFromCenter = Math.atan2(surfPos.y - cy, surfPos.x - cx);
        const pAngle = angleFromCenter + 0.35;
        const pDist = 130;
        const px = surfPos.x + pDist * Math.cos(pAngle);
        const py = surfPos.y + pDist * Math.sin(pAngle);
        participantPositions.set(target, { x: px, y: py, id: target, fromSurface: rel.surface });
      } else {
        participantPositions.set(target, { x: cx + 380, y: cy + 180, id: target });
      }
    }
  });

  // 3. Render Observed Relations (Directional Arrows)
  if (relations.length === 0) {
    dom.fieldNotice.hidden = false;
    dom.fieldNoticeText.textContent = "No relations observed in this snapshot.";
  } else {
    dom.fieldNotice.hidden = true;
    relations.forEach((rel) => {
      const surfPos = surfacePositions.get(rel.surface);
      const targetPos = participantPositions.get(rel.target);

      const startX = surfPos ? surfPos.x : cx;
      const startY = surfPos ? surfPos.y : cy;
      const endX = targetPos ? targetPos.x : cx;
      const endY = targetPos ? targetPos.y : cy;

      const gRel = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gRel.setAttribute("class", "relation-group");
      gRel.setAttribute("tabindex", "0");
      gRel.setAttribute("role", "button");
      gRel.setAttribute("aria-label", `Observed Relation: ${rel.source} to ${rel.target} via ${rel.surface}`);

      // Smooth curved path
      const dx = endX - startX;
      const dy = endY - startY;
      const normX = -dy * 0.25;
      const normY = dx * 0.25;
      const ctrlX = (startX + endX) / 2 + normX;
      const ctrlY = (startY + endY) / 2 + normY;

      const d = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", d);
      line.setAttribute("class", "relation-link interactive");
      line.setAttribute("marker-end", "url(#arrow-observed)");

      // Compute label anchor at quadratic bezier mid-point (t = 0.5)
      const labelX = 0.25 * startX + 0.5 * ctrlX + 0.25 * endX;
      const labelY = 0.25 * startY + 0.5 * ctrlY + 0.25 * endY;

      // Relation label badge along path
      const labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const labelStr = `${rel.surface} [${rel.epistemic_class || "OBSERVED"}]`;
      labelText.textContent = labelStr;
      labelText.setAttribute("x", String(labelX));
      labelText.setAttribute("y", String(labelY));
      labelText.setAttribute("class", "relation-label-text");

      const badgeW = labelStr.length * 6.5 + 16;
      labelBg.setAttribute("x", String(labelX - badgeW / 2));
      labelBg.setAttribute("y", String(labelY - 10));
      labelBg.setAttribute("width", String(badgeW));
      labelBg.setAttribute("height", "20");
      labelBg.setAttribute("class", "relation-label-bg");

      gRel.appendChild(line);
      gRel.appendChild(labelBg);
      gRel.appendChild(labelText);

      const onSelectRelation = () => inspectEntity("relation", rel);
      gRel.addEventListener("click", onSelectRelation);
      gRel.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectRelation();
        }
      });

      dom.svgRelations.appendChild(gRel);
    });
  }

  // 4. Render Surface Nodes
  surfacePositions.forEach((pos, surfId) => {
    const gSurf = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gSurf.setAttribute("class", "field-node surface");
    gSurf.setAttribute("tabindex", "0");
    gSurf.setAttribute("role", "button");
    gSurf.setAttribute("aria-label", `Observed Surface: ${surfId}`);

    // Connector line from core to surface
    const conn = document.createElementNS("http://www.w3.org/2000/svg", "line");
    conn.setAttribute("x1", String(cx));
    conn.setAttribute("y1", String(cy));
    conn.setAttribute("x2", String(pos.x));
    conn.setAttribute("y2", String(pos.y));
    conn.setAttribute("stroke", "var(--border-subtle)");
    conn.setAttribute("stroke-width", "1.5");
    dom.svgTracks.appendChild(conn);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(pos.x));
    circle.setAttribute("cy", String(pos.y));
    circle.setAttribute("r", "28");
    circle.setAttribute("class", "node-shape surface");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", String(pos.x));
    title.setAttribute("y", String(pos.y + 44));
    title.setAttribute("class", "node-title");
    title.textContent = surfId;

    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("x", String(pos.x));
    sub.setAttribute("y", String(pos.y + 58));
    sub.setAttribute("class", "node-subtitle");
    sub.textContent = `${pos.surface.kind || "surface"} · ${pos.surface.direction || "outbound"}`;

    // Glyph / Icon inside circle
    const glyph = document.createElementNS("http://www.w3.org/2000/svg", "text");
    glyph.setAttribute("x", String(pos.x));
    glyph.setAttribute("y", String(pos.y));
    glyph.setAttribute("class", "node-title");
    glyph.setAttribute("style", "font-size: 16px; fill: var(--accent-surface);");
    glyph.textContent = pos.surface.kind === "file" ? "🗎" : pos.surface.kind === "socket" ? "⚡" : "◎";

    gSurf.appendChild(circle);
    gSurf.appendChild(glyph);
    gSurf.appendChild(title);
    gSurf.appendChild(sub);

    const onSelectSurface = () => inspectEntity("surface", pos.surface);
    gSurf.addEventListener("click", onSelectSurface);
    gSurf.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectSurface();
      }
    });

    dom.svgNodes.appendChild(gSurf);
  });

  // 5. Render Participant Nodes
  participantPositions.forEach((pos, pId) => {
    const gPart = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gPart.setAttribute("class", "field-node participant");
    gPart.setAttribute("tabindex", "0");
    gPart.setAttribute("role", "button");
    gPart.setAttribute("aria-label", `Witnessed Participant: ${pId}`);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(pos.x - 40));
    rect.setAttribute("y", String(pos.y - 20));
    rect.setAttribute("width", "80");
    rect.setAttribute("height", "40");
    rect.setAttribute("rx", "8");
    rect.setAttribute("class", "node-shape participant");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", String(pos.x));
    title.setAttribute("y", String(pos.y + 1));
    title.setAttribute("class", "node-title");
    title.setAttribute("style", "font-size: 11px;");
    title.textContent = pId;

    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("x", String(pos.x));
    sub.setAttribute("y", String(pos.y + 32));
    sub.setAttribute("class", "node-subtitle");
    sub.textContent = "participant";

    gPart.appendChild(rect);
    gPart.appendChild(title);
    gPart.appendChild(sub);

    const onSelectPart = () => inspectEntity("participant", { id: pId, type: "participant" });
    gPart.addEventListener("click", onSelectPart);
    gPart.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectPart();
      }
    });

    dom.svgNodes.appendChild(gPart);
  });

  // 6. Render Core SYNTH Node (Gravitational Center)
  const gCore = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gCore.setAttribute("class", "field-node core");
  gCore.setAttribute("tabindex", "0");
  gCore.setAttribute("role", "button");
  gCore.setAttribute("aria-label", `Observed Core System: ${identity}`);

  const coreRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  coreRect.setAttribute("x", String(cx - 70));
  coreRect.setAttribute("y", String(cy - 45));
  coreRect.setAttribute("width", "140");
  coreRect.setAttribute("height", "90");
  coreRect.setAttribute("rx", "14");
  coreRect.setAttribute("class", "node-shape core");

  const coreGlyph = document.createElementNS("http://www.w3.org/2000/svg", "text");
  coreGlyph.setAttribute("x", String(cx));
  coreGlyph.setAttribute("y", String(cy - 18));
  coreGlyph.setAttribute("class", "node-title");
  coreGlyph.setAttribute("style", "font-size: 20px; fill: var(--accent-core);");
  coreGlyph.textContent = "⬡";

  const coreTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
  coreTitle.setAttribute("x", String(cx));
  coreTitle.setAttribute("y", String(cy + 6));
  coreTitle.setAttribute("class", "node-title");
  coreTitle.setAttribute("style", "font-size: 15px; font-weight: 700;");
  coreTitle.textContent = identity;

  const coreSub = document.createElementNS("http://www.w3.org/2000/svg", "text");
  coreSub.setAttribute("x", String(cx));
  coreSub.setAttribute("y", String(cy + 24));
  coreSub.setAttribute("class", "node-subtitle");
  coreSub.textContent = `v${version} · ${appState.state.epistemic_class || "OBSERVED"}`;

  gCore.appendChild(coreRect);
  gCore.appendChild(coreGlyph);
  gCore.appendChild(coreTitle);
  gCore.appendChild(coreSub);

  const onSelectCore = () => inspectEntity("system", appState.state);
  gCore.addEventListener("click", onSelectCore);
  gCore.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectCore();
    }
  });

  dom.svgNodes.appendChild(gCore);
}

// --- Contextual Inspector (Level B - INSPECT) ---
function inspectEntity(type, data) {
  appState.selectedEntity = { type, data };

  dom.drawerEntityType.textContent = type.toUpperCase();
  dom.drawer.classList.add("open");
  dom.drawer.setAttribute("aria-hidden", "false");

  dom.drawerProperties.innerHTML = "";

  if (type === "system") {
    dom.drawerTitle.textContent = data.identity || "SYNTH Core";
    dom.drawerEpistemicTag.textContent = "OBSERVED";
    dom.drawerEpistemicTag.className = "badge badge-epistemic";
    dom.drawerEpistemicText.textContent = "Core system entity declared by observed evidence.";

    addProperty("Identity", data.identity || "SYNTH", "OBSERVED");
    addProperty("Version", data.version || "unknown", "OBSERVED");
    addProperty("Epistemic Class", data.epistemic_class || "OBSERVED", "OBSERVED");
    addProperty("Timestamp", data.timestamp || "n/a", "OBSERVED");
    if (data.process) {
      addProperty("Process PID", String(data.process.pid), "OBSERVED");
    }
    if (data.roots) {
      addProperty("Roots", JSON.stringify(data.roots), "OBSERVED");
    }
  } else if (type === "surface") {
    dom.drawerTitle.textContent = data.id;
    dom.drawerEpistemicTag.textContent = "OBSERVED";
    dom.drawerEpistemicTag.className = "badge badge-epistemic";
    dom.drawerEpistemicText.textContent = "Public surface witnessed and resolved for this realization.";

    addProperty("Surface ID", data.id, "OBSERVED");
    addProperty("Owner", data.owner || "SYNTH", "OBSERVED");
    addProperty("Kind", data.kind || "unspecified", "OBSERVED");
    addProperty("Direction", data.direction || "outbound", "OBSERVED");
    addProperty("Media Type", data.media_type || "unspecified", "OBSERVED");
    addProperty("Locator", data.locator || "n/a", "OBSERVED", true);
    addProperty("Observability", data.observability || "public-surface", "OBSERVED");
    if (data.metadata) {
      addProperty("Metadata", typeof data.metadata === "object" ? JSON.stringify(data.metadata) : data.metadata, "OBSERVED");
    }
  } else if (type === "relation") {
    dom.drawerTitle.textContent = `${data.source} → ${data.target}`;
    dom.drawerEpistemicTag.textContent = data.epistemic_class || "OBSERVED";
    dom.drawerEpistemicTag.className = "badge badge-epistemic";
    dom.drawerEpistemicText.textContent = "Witnessed factual relation between participants.";

    addProperty("Source Entity", data.source, "OBSERVED");
    addProperty("Target Entity", data.target, "OBSERVED");
    addProperty("Surface Mediated", data.surface, "OBSERVED", true);
    addProperty("Epistemic Class", data.epistemic_class || "OBSERVED", "OBSERVED");
    addProperty("Observed At", data.observed_at || "n/a", "OBSERVED");
  } else if (type === "participant") {
    dom.drawerTitle.textContent = data.id;
    dom.drawerEpistemicTag.textContent = "DERIVED BY WEB";
    dom.drawerEpistemicTag.className = "badge badge-epistemic derived";
    dom.drawerEpistemicText.textContent = "External participant derived from witnessed relation targets.";

    addProperty("Participant ID", data.id, "OBSERVED");
    addProperty("Role", "Relation Target", "DERIVED BY WEB");
  }
}

function addProperty(label, value, epistemology, isCode = false) {
  const group = document.createElement("div");
  group.className = "property-group";

  const dt = document.createElement("dt");
  dt.className = "property-label";

  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;

  const epistemicBadge = document.createElement("span");
  const isObs = epistemology === "OBSERVED";
  epistemicBadge.className = `badge badge-epistemic ${isObs ? "" : "derived"}`;
  epistemicBadge.style.fontSize = "9px";
  epistemicBadge.style.padding = "1px 4px";
  epistemicBadge.textContent = epistemology;

  dt.appendChild(labelSpan);
  dt.appendChild(epistemicBadge);

  const dd = document.createElement("dd");
  dd.className = "property-value";

  if (isCode) {
    const code = document.createElement("code");
    code.textContent = value;
    dd.appendChild(code);
  } else {
    dd.textContent = value;
  }

  group.appendChild(dt);
  group.appendChild(dd);
  dom.drawerProperties.appendChild(group);
}

function closeDrawer() {
  appState.selectedEntity = null;
  dom.drawer.classList.remove("open");
  dom.drawer.setAttribute("aria-hidden", "true");
}

function rebindSelectedEntity(surfaces, relations) {
  if (!appState.selectedEntity) return;
  const { type, data } = appState.selectedEntity;
  if (type === "system") {
    inspectEntity("system", appState.state);
  } else if (type === "surface") {
    const updated = surfaces.find((s) => s.id === data.id);
    if (updated) inspectEntity("surface", updated);
  } else if (type === "relation") {
    const updated = relations.find((r) => r.surface === data.surface && r.target === data.target);
    if (updated) inspectEntity("relation", updated);
  }
}

// --- Raw Evidence Modal & Syntax Highlighter (Level C - EVIDENCE) ---
function openRawModal(targetData = null) {
  const data = targetData || appState.state || {};
  const jsonStr = JSON.stringify(data, null, 2);

  dom.rawJsonContent.innerHTML = syntaxHighlightJSON(jsonStr);

  if (appState.meta && appState.meta.source_digest) {
    dom.rawDigestVal.textContent = appState.meta.source_digest;
  } else {
    computeSHA256(jsonStr).then((digest) => {
      dom.rawDigestVal.textContent = digest;
    });
  }

  dom.rawModal.classList.add("open");
  dom.rawModal.hidden = false;
  dom.rawModal.setAttribute("aria-hidden", "false");
}

function closeRawModal() {
  dom.rawModal.classList.remove("open");
  dom.rawModal.hidden = true;
  dom.rawModal.setAttribute("aria-hidden", "true");
}

async function computeSHA256(text) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "digest-unavailable";
  }
}

function syntaxHighlightJSON(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\\-]?\d+)?)/g, (match) => {
    let cls = "json-number";
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? "json-key" : "json-string";
    } else if (/true|false/.test(match)) {
      cls = "json-boolean";
    } else if (/null/.test(match)) {
      cls = "json-null";
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

// --- Network & Data Fetching ---
async function fetchMeta() {
  try {
    const res = await fetch("/api/meta", { cache: "no-store" });
    if (res.ok) {
      appState.meta = await res.json();
      if (appState.meta.source_surface) {
        dom.sourceName.textContent = appState.meta.source_surface;
      }
    }
  } catch {
    // Meta endpoint is non-blocking
  }
}

async function fetchStatePolling() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    handleStateUpdate(data);
  } catch (err) {
    dom.projectionLabel.textContent = "Evidence unavailable";
    dom.freshnessBadge.textContent = "UNAVAILABLE";
    dom.freshnessBadge.className = "metric-badge stale";
    dom.statusDot.className = "status-indicator offline";
  }
}

function setupSSE() {
  // Perform immediate initial fetch to avoid waiting for connection handshake
  fetchMeta();
  fetchStatePolling();

  if (!window.EventSource) {
    startPolling();
    return;
  }

  try {
    const sse = new EventSource("/api/events");
    appState.eventSource = sse;

    sse.addEventListener("ready", (e) => {
      appState.isLiveSSE = true;
      try {
        const initial = JSON.parse(e.data);
        handleStateUpdate(initial);
      } catch {}
      fetchMeta();
    });

    sse.addEventListener("state_updated", (e) => {
      appState.isLiveSSE = true;
      try {
        const update = JSON.parse(e.data);
        handleStateUpdate(update);
      } catch {}
      fetchMeta();
    });

    sse.onerror = () => {
      appState.isLiveSSE = false;
      const modeLabel = "Observed snapshot";
      dom.projectionLabel.textContent = modeLabel;
      // Fallback polling
      fetchStatePolling();
    };
  } catch {
    startPolling();
  }
}

function startPolling() {
  appState.isLiveSSE = false;
  fetchMeta();
  fetchStatePolling();
  if (appState.pollTimer) clearInterval(appState.pollTimer);
  appState.pollTimer = setInterval(fetchStatePolling, 2500);
}

// --- Initialization ---
function init() {
  // Apply saved or system theme
  applyTheme(appState.theme);

  // Event Listeners
  dom.themeToggle.addEventListener("click", cycleTheme);

  dom.btnOpenRaw.addEventListener("click", () => openRawModal());
  dom.btnCloseRaw.addEventListener("click", closeRawModal);
  dom.rawModal.addEventListener("click", (e) => {
    if (e.target === dom.rawModal) closeRawModal();
  });

  dom.btnCloseDrawer.addEventListener("click", closeDrawer);
  dom.btnDrawerInspectRaw.addEventListener("click", () => {
    if (appState.selectedEntity) {
      openRawModal(appState.selectedEntity.data);
    } else {
      openRawModal();
    }
  });

  dom.btnCopyRaw.addEventListener("click", async () => {
    const text = dom.rawJsonContent.textContent;
    try {
      await navigator.clipboard.writeText(text);
      dom.btnCopyRaw.textContent = "Copied ✓";
      setTimeout(() => {
        dom.btnCopyRaw.textContent = "Copy JSON";
      }, 1800);
    } catch {
      dom.btnCopyRaw.textContent = "Error copying";
    }
  });

  // Global Keyboard Navigation
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!dom.rawModal.hidden) {
        closeRawModal();
      } else if (dom.drawer.classList.contains("open")) {
        closeDrawer();
      }
    }
  });

  // Start freshness ticker (1 second interval)
  appState.tickerTimer = setInterval(updateFreshnessTicker, 1000);

  // Connect to SSE stream
  setupSSE();
}

// Bootstrap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
