const text = (id, value) => { document.getElementById(id).textContent = String(value); };
const row = (primary, secondary, status) => {
  const element = document.createElement("div");
  element.className = "row";
  for (const [tag, value] of [["strong", primary], ["code", secondary], ["span", status]]) {
    const child = document.createElement(tag);
    child.textContent = value;
    element.appendChild(child);
  }
  return element;
};

fetch("/api/state", {cache: "no-store"}).then((response) => response.json()).then((state) => {
  const surfaces = Array.isArray(state.observed_surfaces) ? state.observed_surfaces : [];
  const relations = Array.isArray(state.observed_relations) ? state.observed_relations : [];
  text("summary", "A human view of the public evidence resolved for this independent realization.");
  text("evidence-state", state.epistemic_class ?? "UNKNOWN");
  text("observed-at", state.timestamp ?? "timestamp unavailable");
  text("identity", state.identity ?? "unknown");
  text("version", state.version ?? "unknown");
  text("surface-count", surfaces.length);
  text("relation-count", relations.length);
  const surfaceRoot = document.getElementById("surfaces");
  surfaces.forEach((surface) => surfaceRoot.appendChild(row(surface.id, surface.locator, surface.observability)));
  if (!surfaces.length) surfaceRoot.innerHTML = '<p class="empty">No surfaces observed in this evidence.</p>';
  const relationRoot = document.getElementById("relations");
  relations.forEach((relation) => relationRoot.appendChild(row(relation.source, relation.surface, relation.epistemic_class)));
  if (!relations.length) relationRoot.innerHTML = '<p class="empty">No relations observed in this evidence.</p>';
  text("raw", JSON.stringify(state, null, 2));
}).catch((error) => {
  text("summary", `Evidence unavailable: ${error.message}`);
  text("evidence-state", "UNAVAILABLE");
});
