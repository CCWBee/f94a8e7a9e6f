/*  NPO Handbook viewer – client-side parser & filter  */

document.addEventListener("DOMContentLoaded", init);

function init() {
  fetch("policy.md")
    .then(r => r.text())
    .then(render)
    .then(attachFilterListeners);
}

function render(markdown) {
  const container = document.getElementById("content");
  container.innerHTML = "";

  const blocks = markdown.split(/^\s*---\s*$/m);          // split on '---' lines
  blocks.forEach(block => {
    const meta = extractMeta(block);                      // {rule_type, applies_to}

    // Skip meta-only blocks (e.g. TOC) if needed
    const core = block.replace(/<!--[\s\S]*?-->/, "").trim();
    if (!core) return;

    const node = document.createElement("section");
    node.className = "clause";
    node.dataset.rule_type = meta.rule_type || "unknown";
    node.dataset.applies_to = meta.applies_to || "unknown";
    node.innerHTML = marked.parse(core);
    container.appendChild(node);
  });

  applyFilters();     // run once on initial load
}

function extractMeta(text) {
  const out = {};
  const m = text.match(/<!--([\s\S]*?)-->/);
  if (!m) return out;
  m[1].split(/\n/).forEach(line => {
    const [k, ...v] = line.split(":");
    if (k && v.length) out[k.trim()] = v.join(":").trim().toLowerCase();
  });
  return out;
}

function attachFilterListeners() {
  document.querySelectorAll(".filter").forEach(cb =>
    cb.addEventListener("change", applyFilters)
  );
}

function applyFilters() {
  const checks = [...document.querySelectorAll(".filter:checked")]
    .reduce((acc, el) => {
      (acc[el.dataset.filter] ??= new Set()).add(el.value);
      return acc;
    }, {});

  document.querySelectorAll("#content > section").forEach(sec => {
    if (sec.dataset.rule_type === "general_info" && sec.dataset.applies_to === "all") {
      // always-show: never hide
      sec.style.display = "";
      return;
    }
    const visible = Object.entries(checks).every(
      ([k, set]) => set.has(sec.dataset[k])
    );
    sec.style.display = visible ? "" : "none";
  });
}
