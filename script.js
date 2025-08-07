// NPO Handbook viewer – client-side parser & filter

document.addEventListener("DOMContentLoaded", init);

let definitions = {};

// Map non-standard rule_type tags to canonical values
const RULE_TYPE_ALIASES = {
  bluegrey: "general_info",
  alwaysshow: "general_info"
};

function init() {
  fetch("policy.md")
    .then(r => r.text())
    .then(render)
    .then(attachFilterListeners);
}

function render(markdown) {
  const container = document.getElementById("content");
  container.innerHTML = "";

  definitions = parseDefinitions(markdown);

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

  highlightTerms();
  applyFilters();
}

function addClause(container, content, meta = {}) {
  const node = document.createElement("section");
  node.className = "clause";
  const rt = RULE_TYPE_ALIASES[meta.rule_type] || meta.rule_type;
  node.dataset.ruleType = rt || "unknown";
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
  const allFilters = [...document.querySelectorAll(".filter")]
    .reduce((acc, el) => {
      (acc[el.dataset.filter] ??= new Set()).add(el.value);
      return acc;
    }, {});

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

    const visible = Object.entries(allFilters).every(([k, allVals]) => {
      const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const value = sec.dataset[key];
      if (!allVals.has(value)) return true;
      const set = checks[k];
      return set?.has(value);
    });

    sec.style.display = visible ? "" : "none";
  });
}

function parseDefinitions(md) {
  const defs = {};
  md = md.replace(/\r\n/g, "\n");

  // Reference style: [Term]: definition
  const refRe = /^\[([^\]]+)\]:\s+(.+)$/gm;
  let m;
  while ((m = refRe.exec(md))) {
    defs[m[1].trim().toLowerCase()] = m[2].trim();
  }

  // Section style: headings like "## Definitions" or "## 9 GLOSSARY"
  const secRe = /^##\s+(?:\d+\s+)?(?:Definitions|Glossary)\s*$/gim;
  let match;
  while ((match = secRe.exec(md))) {
    const start = match.index + match[0].length;
    const rest = md.slice(start);
    const next = rest.search(/\n##\s+/);
    const block = rest.slice(0, next === -1 ? rest.length : next);

    // Bullet style within section: **Term** - Definition
    block.split(/\n/).forEach(line => {
      const mLine = line.match(/\*\*(.+?)\*\*\s*[-–—:]\s*(.+)/);
      if (mLine) {
        defs[mLine[1].trim().toLowerCase()] = mLine[2].trim();
      }
    });

    // Table style within section
    const rowRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
    let row;
    while ((row = rowRe.exec(block))) {
      const term = row[1].trim();
      const def = row[2].trim();
      if (!term || /^term$/i.test(term) || /^[-\s]+$/.test(term)) continue;
      if (!def || /^definition$/i.test(def) || /^[-\s]+$/.test(def)) continue;
      defs[term.toLowerCase()] = def;
    }
  }

  return defs;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTerms() {
  const terms = Object.keys(definitions);
  if (!terms.length) return;

  const sorted = terms.sort((a, b) => b.length - a.length)
    .map(t => escapeRegExp(t));
  const pattern = new RegExp(`\\b(${sorted.join("|")})\\b`, "gi");

  const walker = document.createTreeWalker(
    document.getElementById("content"),
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest("a, code, pre")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const toProcess = [];
  let n;
  while ((n = walker.nextNode())) toProcess.push(n);

  toProcess.forEach(node => {
    const text = node.textContent;
    pattern.lastIndex = 0;
    let match;
    let last = 0;
    const frag = document.createDocumentFragment();

    while ((match = pattern.exec(text))) {
      const term = match[0];
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      const span = document.createElement("span");
      span.className = "def-term";
      span.textContent = term;
      span.dataset.definition = definitions[term.toLowerCase()];
      span.addEventListener("mouseenter", showTooltip);
      span.addEventListener("mouseleave", hideTooltip);
      frag.appendChild(span);
      last = match.index + term.length;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    if (frag.childNodes.length) {
      node.parentNode.replaceChild(frag, node);
    }
  });
}

const tooltip = document.createElement("div");
tooltip.className = "definition-tooltip";
document.body.appendChild(tooltip);

function showTooltip(e) {
  tooltip.textContent = e.currentTarget.dataset.definition;
  tooltip.style.display = "block";
  const rect = e.currentTarget.getBoundingClientRect();
  tooltip.style.top = `${window.scrollY + rect.bottom + 5}px`;
  tooltip.style.left = `${window.scrollX + rect.left}px`;
}

function hideTooltip() {
  tooltip.style.display = "none";
}
