
document.addEventListener("DOMContentLoaded", () => {
  fetch("policy.md")
    .then(response => response.text())
    .then(text => {
      const blocks = text.split(/---\s*/).filter(Boolean);
      const contentDiv = document.getElementById("content");
      contentDiv.innerHTML = "";
      blocks.forEach(block => {
        const metaMatch = block.match(/<!--(.*?)-->/s);
        const metadata = {};
        if (metaMatch) {
          metaMatch[1].split(/\n+/).forEach(line => {
            const [key, ...rest] = line.trim().split(":");
            metadata[key.trim()] = rest.join(":").trim();
          });
        }
        const html = marked.parse(block.replace(/<!--.*?-->/s, "").trim());
        const section = document.createElement("section");
        section.innerHTML = html;
        Object.entries(metadata).forEach(([k, v]) => {
          section.dataset[k.replace(/\s+/g, "_")] = v.toLowerCase();
        });
        contentDiv.appendChild(section);
      });
      document.querySelectorAll(".filter").forEach(input => {
        input.addEventListener("change", () => {
          const filters = Array.from(document.querySelectorAll(".filter:checked"))
            .reduce((acc, el) => {
              const key = el.dataset.filter;
              acc[key] = acc[key] || new Set();
              acc[key].add(el.value);
              return acc;
            }, {});
          document.querySelectorAll("#content > section").forEach(sec => {
            const visible = Object.entries(filters).every(([k, vals]) =>
              vals.has(sec.dataset[k])
            );
            sec.style.display = visible ? "" : "none";
          });
        });
      });
    });
});
