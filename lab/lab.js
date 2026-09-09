(function () {
  "use strict";

  var STATUS_LABEL = {
    live: "live",
    fixture: "fixture",
    degraded: "degraded",
    unavailable: "unavailable",
    planned: "planned",
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderDegraded(root, message, detail) {
    root.innerHTML = "";
    var notice = el("div", "lab-notice");
    notice.appendChild(el("strong", null, message));
    if (detail) {
      var p = el("p", "lab-reason", detail);
      p.style.marginTop = "0.5rem";
      notice.appendChild(p);
    }
    root.appendChild(notice);
  }

  function renderRegistry(root, registry) {
    root.innerHTML = "";
    var grid = el("div", "lab-grid");

    registry.apps.forEach(function (app) {
      var card = el("article", "lab-card");
      var header = el("div", "lab-card-header");
      header.appendChild(el("h2", null, app.title));
      header.appendChild(el("span", "lab-status " + app.status, STATUS_LABEL[app.status] || app.status));
      card.appendChild(header);
      card.appendChild(el("div", "lab-kind", app.kind));
      card.appendChild(el("p", "lab-desc", app.description));
      if (app.reason) card.appendChild(el("p", "lab-reason", app.reason));

      card.appendChild(
        el(
          "div",
          "lab-meta",
          app.provenance + " · updated " + app.updated,
        ),
      );

      if (app.href && (app.status === "live" || app.status === "fixture" || app.status === "degraded")) {
        var link = el("a", "lab-action", "Open →");
        link.href = app.href;
        link.rel = "noopener noreferrer";
        card.appendChild(link);
      } else if (app.href && app.status === "unavailable") {
        var inspect = el("a", "lab-action", "View unavailable surface →");
        inspect.href = app.href;
        inspect.rel = "noopener noreferrer";
        card.appendChild(inspect);
      } else {
        card.appendChild(el("div", "lab-action disabled", "No public route yet"));
      }

      grid.appendChild(card);
    });

    root.appendChild(grid);
  }

  function basicValidate(registry) {
    if (!registry || typeof registry !== "object") return "Registry is not an object.";
    if (registry.schemaVersion !== "hnxj-lab-registry-v1") return "Unsupported schemaVersion.";
    if (!Array.isArray(registry.apps) || registry.apps.length === 0) return "Registry apps array is empty.";
    var allowed = { live: 1, fixture: 1, degraded: 1, unavailable: 1, planned: 1 };
    for (var i = 0; i < registry.apps.length; i++) {
      var app = registry.apps[i];
      if (!app.id || !app.title || !app.status || !allowed[app.status]) return "Invalid app entry at index " + i;
      if ((app.status === "live" || app.status === "fixture" || app.status === "degraded") && !app.href) {
        return "App " + app.id + " requires href for status " + app.status;
      }
      if (!app.reason) return "App " + app.id + " requires reason.";
      if (app.href && !/^https:\/\//i.test(app.href)) return "App " + app.id + " href must be public HTTPS.";
    }
    return null;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("lab-app-grid");
    if (!root) return;

    fetch("registry.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (registry) {
        var err = basicValidate(registry);
        if (err) {
          renderDegraded(root, "Lab registry degraded", err);
          return;
        }
        renderRegistry(root, registry);
      })
      .catch(function (error) {
        renderDegraded(
          root,
          "Lab registry unavailable",
          error && error.message ? error.message : "Could not load registry.json",
        );
      });
  });
})();
