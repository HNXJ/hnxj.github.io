(function () {
  "use strict";

  var STATUS_LABEL = {
    live: "live",
    fixture: "fixture",
    degraded: "degraded",
    unavailable: "unavailable",
    planned: "planned",
    archived: "archived",
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderDegraded(root, message, detail) {
    root.innerHTML = "";
    var notice = el("div", "labyrinth-notice");
    notice.appendChild(el("strong", null, message));
    if (detail) {
      var p = el("p", "labyrinth-reason", detail);
      p.style.marginTop = "0.5rem";
      notice.appendChild(p);
    }
    root.appendChild(notice);
  }

  function renderRegistry(root, registry) {
    root.innerHTML = "";
    var grid = el("div", "labyrinth-grid");

    registry.apps.forEach(function (app) {
      var card = el("article", "labyrinth-card");

      var preview = el("div", "labyrinth-card-preview" + (app.image ? "" : " placeholder"));
      if (app.image) preview.style.backgroundImage = "url('" + app.image + "')";
      card.appendChild(preview);

      var body = el("div", "labyrinth-card-body");
      var header = el("div", "labyrinth-card-header");
      header.appendChild(el("h3", null, app.title));
      header.appendChild(el("span", "labyrinth-status " + app.status, STATUS_LABEL[app.status] || app.status));
      body.appendChild(header);
      body.appendChild(el("div", "labyrinth-kind", app.kind));
      body.appendChild(el("p", "labyrinth-desc", app.description));
      if (app.reason) body.appendChild(el("p", "labyrinth-reason", app.reason));
      body.appendChild(el("div", "labyrinth-meta", app.provenance + " · updated " + app.updated));

      if (app.href && (app.status === "live" || app.status === "fixture" || app.status === "degraded" || app.status === "archived")) {
        var link = el("a", "labyrinth-action", app.status === "archived" ? "View archive →" : "Open →");
        link.href = app.href;
        link.rel = "noopener noreferrer";
        body.appendChild(link);
      } else if (app.href && (app.status === "unavailable" || app.status === "planned")) {
        var inspect = el("a", "labyrinth-action", "View →");
        inspect.href = app.href;
        inspect.rel = "noopener noreferrer";
        body.appendChild(inspect);
      } else {
        body.appendChild(el("div", "labyrinth-action disabled", "No public route yet"));
      }

      card.appendChild(body);
      grid.appendChild(card);
    });

    root.appendChild(grid);
  }

  function basicValidate(registry) {
    if (!registry || typeof registry !== "object") return "Registry is not an object.";
    if (registry.schemaVersion !== "hnxj-labyrinth-registry-v1") return "Unsupported schemaVersion.";
    if (!Array.isArray(registry.apps) || registry.apps.length === 0) return "Registry apps array is empty.";
    var allowed = { live: 1, fixture: 1, degraded: 1, archived: 1, unavailable: 1, planned: 1 };
    for (var i = 0; i < registry.apps.length; i++) {
      var app = registry.apps[i];
      if (!app.id || !app.title || !app.status || !allowed[app.status]) return "Invalid app entry at index " + i;
      if ((app.status === "live" || app.status === "fixture" || app.status === "degraded" || app.status === "archived") && !app.href) {
        return "App " + app.id + " requires href for status " + app.status;
      }
      if (!app.reason) return "App " + app.id + " requires reason.";
      if (app.href && !/^https:\/\//i.test(app.href)) return "App " + app.id + " href must be public HTTPS.";
    }
    return null;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("labyrinth-gallery");
    if (!root) return;

    fetch("registry.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (registry) {
        var err = basicValidate(registry);
        if (err) {
          renderDegraded(root, "Labyrinth registry degraded", err);
          return;
        }
        renderRegistry(root, registry);
      })
      .catch(function (error) {
        renderDegraded(
          root,
          "Labyrinth registry unavailable",
          error && error.message ? error.message : "Could not load registry.json",
        );
      });
  });
})();
