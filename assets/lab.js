// Renders window.PROJECTS into #cards-webpages and #cards-presentations.
// Uses textContent and safe DOM attributes only (no innerHTML or mutation listeners).
(function () {
  "use strict";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function renderCards() {
    const webRoot = document.getElementById("cards-webpages");
    const presRoot = document.getElementById("cards-presentations");

    if (!webRoot && !presRoot) return;

    const projects = window.PROJECTS || [];
    let presCount = 0;

    projects.forEach(function (p) {
      const isPres = p.category === "presentation" || (p.tags && p.tags.indexOf("slides") !== -1);
      const target = (isPres && presRoot) ? presRoot : webRoot;
      if (!target) return;

      if (isPres) presCount++;

      const card = el("a", "labyrinth-card");
      card.href = p.url;
      if (p.url && (p.url.indexOf("http://") === 0 || p.url.indexOf("https://") === 0)) {
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      }

      const preview = el("div", "labyrinth-card-preview");
      if (p.image) {
        preview.style.backgroundImage = "url('" + p.image.replace(/'/g, "%27") + "')";
      } else {
        preview.className += " placeholder";
      }
      card.appendChild(preview);

      const body = el("div", "labyrinth-card-body");
      const header = el("div", "labyrinth-card-header");
      header.appendChild(el("h3", null, p.subject || p.name));
      body.appendChild(header);

      if (p.tags && p.tags.length > 0) {
        body.appendChild(el("div", "labyrinth-kind", p.tags.join(" · ")));
      }

      body.appendChild(el("p", "labyrinth-desc", p.description));
      body.appendChild(el("span", "labyrinth-action", isPres ? "View slides →" : "Open →"));
      card.appendChild(body);

      target.appendChild(card);
    });

    if (presRoot && presCount === 0) {
      var notice = el("p", "labyrinth-scope-note", "Presentations coming soon");
      notice.style.display = "block";
      notice.style.width = "fit-content";
      presRoot.appendChild(notice);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderCards);
  } else {
    renderCards();
  }
})();
