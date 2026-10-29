// Renders window.PROJECTS into #cards-webpages and #cards-presentations.
// Uses textContent and safe DOM attributes only (no innerHTML or mutation listeners).
(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function renderCards() {
    var webRoot = document.getElementById("cards-webpages");
    var presRoot = document.getElementById("cards-presentations");

    if (!webRoot && !presRoot) return;

    var projects = window.PROJECTS || [];
    var presCount = 0;
    var webCount = 0;

    projects.forEach(function (p) {
      var isPres = p.category === "presentation" || (p.tags && p.tags.indexOf("slides") !== -1);
      var target = (isPres && presRoot) ? presRoot : webRoot;
      if (!target) return;

      if (isPres) presCount++;
      else webCount++;

      var card = el("a", "labyrinth-card");
      card.href = p.url;
      if (p.url && (p.url.indexOf("http://") === 0 || p.url.indexOf("https://") === 0)) {
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      }

      var preview = el("div", "labyrinth-card-preview");
      if (p.image) {
        preview.style.backgroundImage = "url('" + p.image.replace(/'/g, "%27") + "')";
      } else {
        preview.className += " placeholder";
      }
      card.appendChild(preview);

      var body = el("div", "labyrinth-card-body");
      var header = el("div", "labyrinth-card-header");
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
