// NPO Handbook viewer – client-side parser & filter

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

  // Split the markdown so that each metadata comment applies to the
  // content immediately following it. The array alternates between
  // content and the inner text of the metadata comment.
  const parts = markdown.split(/<!--([\s\S]*?)-->/);

  const first = parts[0].trim();
  if (first) addClause(container, first, {});

  for (let i = 1; i < parts.length; i += 2) {
    const meta = extractMeta(parts[i]);
    const content = parts[i + 1]?.trim();
    if (!content) continue;
    addClause(container, content, meta);
  }

  applyFilters();
}

function addClause(container, content, meta = {}) {
  const node = document.createElement("section");
  node.className = "clause";
  node.dataset.ruleType = meta.rule_type || "unknown";
  node.dataset.appliesTo = meta.applies_to || "unknown";
  node.innerHTML = marked.parse(content);
  container.appendChild(node);
}

function extractMeta(text) {
  const out = {};
  text.split(/\n/).forEach(line => {
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
    if (sec.dataset.ruleType === "always_show" || sec.dataset.ruleType === "general_info") {
      sec.style.display = "";
      return;
    }
    const visible = Object.entries(checks).every(([k, set]) => {
      const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      return set.has(sec.dataset[key]);
    });
    sec.style.display = visible ? "" : "none";
  });
}
