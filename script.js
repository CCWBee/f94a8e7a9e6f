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
  // content immediately preceding it.  The array alternates between
  // content and the inner text of the metadata comment.
  const parts = markdown.split(/<!--([\s\S]*?)-->/);

  for (let i = 0; i < parts.length - 1; i += 2) {
    const content = parts[i].trim();
    const meta = extractMeta(`<!--${parts[i + 1]}-->`);
    if (!content) continue;

    const node = document.createElement("section");
    node.className = "clause";
    node.dataset.ruleType = meta.rule_type || "unknown";
    node.dataset.appliesTo = meta.applies_to || "unknown";
    node.innerHTML = marked.parse(content);
    container.appendChild(node);
  }

  // Any trailing content without metadata is rendered with default styling.
  const tail = parts[parts.length - 1].trim();
  if (tail) {
    const node = document.createElement("section");
    node.className = "clause";
    node.dataset.ruleType = "unknown";
    node.dataset.appliesTo = "unknown";
    node.innerHTML = marked.parse(tail);
    container.appendChild(node);
  }

  applyFilters();
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
