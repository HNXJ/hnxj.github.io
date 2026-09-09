(function () {
  "use strict";

  var SUPPORTED_SCHEMA_VERSIONS = { "hnxj-labyrinth-registry-v1": true };
  var REMOTE_REGISTRY_URL =
    "https://github.com/HNXJ/labyrinth/releases/download/catalog-latest/registry.json";
  var FALLBACK_REGISTRY_URL = "registry.fallback.json";

  var STATUS_LABEL = {
    live: "live",
    fixture: "fixture",
    degraded: "degraded",
    unavailable: "unavailable",
    planned: "planned",
    archived: "archived",
  };

  var ALLOWED_STATUS = {
    live: 1,
    fixture: 1,
    degraded: 1,
    archived: 1,
    unavailable: 1,
    planned: 1,
  };

  var ALLOWED_KIND = {
    application: 1,
    surface: 1,
    experiment: 1,
    catalog: 1,
  };

  var FORBIDDEN_HOST = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\.local\b/i;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isSafeHttpsUrl(value) {
    if (typeof value !== "string" || !value) return false;
    if (!/^https:\/\//i.test(value)) return false;
    if (FORBIDDEN_HOST.test(value)) return false;
    if (/[\s<>"']/.test(value)) return false;
    return true;
  }

  function validateRegistry(registry) {
    if (!isPlainObject(registry)) return "Registry is not an object.";
    if (!SUPPORTED_SCHEMA_VERSIONS[registry.schemaVersion]) {
      return "Unsupported schemaVersion: " + String(registry.schemaVersion);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.updated)) return "Invalid registry updated date.";
    if (!Array.isArray(registry.apps) || registry.apps.length === 0) return "Registry apps array is empty.";

    var ids = {};
    for (var i = 0; i < registry.apps.length; i++) {
      var app = registry.apps[i];
      if (!isPlainObject(app)) return "Invalid app entry at index " + i;
      if (!app.id || !/^[a-z0-9][a-z0-9-]*$/.test(app.id)) return "Invalid app id at index " + i;
      if (ids[app.id]) return "Duplicate app id: " + app.id;
      ids[app.id] = true;
      if (!app.title || typeof app.title !== "string") return "App " + app.id + " requires title.";
      if (!app.description || typeof app.description !== "string") return "App " + app.id + " requires description.";
      if (!ALLOWED_STATUS[app.status]) return "App " + app.id + " has invalid status.";
      if (!ALLOWED_KIND[app.kind]) return "App " + app.id + " has invalid kind.";
      if (!app.reason || typeof app.reason !== "string") return "App " + app.id + " requires reason.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(app.updated)) return "App " + app.id + " has invalid updated date.";
      if (!app.provenance || typeof app.provenance !== "string") return "App " + app.id + " requires provenance.";
      if (app.href !== undefined && (typeof app.href !== "string" || !isSafeHttpsUrl(app.href))) {
        return "App " + app.id + " href must be public HTTPS.";
      }
      if (app.image !== undefined) {
        if (typeof app.image !== "string") return "App " + app.id + " image must be a string when present.";
        if (/^https:\/\//i.test(app.image)) {
          if (!isSafeHttpsUrl(app.image)) return "App " + app.id + " image must be public HTTPS.";
        } else if (!/^(\.\.\/|\/)/.test(app.image) || /[\s<>"']/.test(app.image)) {
          return "App " + app.id + " image must be HTTPS or renderer-relative.";
        }
      }
      if (
        (app.status === "live" || app.status === "fixture" || app.status === "degraded" || app.status === "archived") &&
        !app.href
      ) {
        return "App " + app.id + " requires href for status " + app.status;
      }
    }
    return null;
  }

  function renderNotice(root, message, detail) {
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

  function renderSourceBanner(root, label) {
    var banner = el("div", "labyrinth-source-banner", label);
    root.appendChild(banner);
  }

  function resolveImageUrl(image) {
    if (!image) return null;
    if (/^https:\/\//i.test(image)) return image;
    if (image.indexOf("/") === 0) return image;
    return image;
  }

  function renderRegistry(root, registry, sourceLabel) {
    root.innerHTML = "";
    if (sourceLabel) renderSourceBanner(root, sourceLabel);

    var grid = el("div", "labyrinth-grid");

    registry.apps.forEach(function (app) {
      var card = el("article", "labyrinth-card");

      var preview = el("div", "labyrinth-card-preview" + (app.image ? "" : " placeholder"));
      var imageUrl = resolveImageUrl(app.image);
      if (imageUrl) preview.style.backgroundImage = "url('" + imageUrl.replace(/'/g, "%27") + "')";
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

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    }).then(function (text) {
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error("Invalid JSON");
      }
    });
  }

  function loadRegistry() {
    return fetchJson(REMOTE_REGISTRY_URL).then(function (registry) {
      var err = validateRegistry(registry);
      if (err) throw new Error(err);
      return { registry: registry, sourceLabel: null };
    }).catch(function () {
      return fetchJson(FALLBACK_REGISTRY_URL).then(function (registry) {
        var err = validateRegistry(registry);
        if (err) throw new Error(err);
        return { registry: registry, sourceLabel: "CATALOG SNAPSHOT" };
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("labyrinth-gallery");
    if (!root) return;

    loadRegistry()
      .then(function (result) {
        renderRegistry(root, result.registry, result.sourceLabel);
      })
      .catch(function (error) {
        renderNotice(
          root,
          "Labyrinth registry unavailable",
          error && error.message ? error.message : "Could not load a valid registry.",
        );
      });
  });
})();
