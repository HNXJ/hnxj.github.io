// Draws the Jomission/LANSA (OPEN-38) status from window.O38S_ARTIFACT (assets/data/o38s_status.js, built by the
// regeneration gate) through window.O38S_VIEW (assets/o38s_view.js). Without the artifact every status is UNKNOWN.
// Read-only: textContent and safe attributes only, no network, no handlers.
// window.O38S_CARD.lines() gives the gallery card its status lines; a page with #o38s-dashboard gets the full board.
(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  // Without the view model nothing is shown as a status: the snapshot is never read directly.
  function currentView() {
    if (!window.O38S_VIEW) throw new Error("o38s_view.js did not load");
    return window.O38S_VIEW.view(window.O38S_ARTIFACT, Date.now());
  }

  var UNAVAILABLE = "Status unknown: the status viewer did not load";

  function pill(status) {
    return el("span", "o38s-pill o38s-" + status.toLowerCase(), status);
  }

  function provenanceText(v) {
    var p = v.provenance;
    return "Source " + (p.source_sha ? p.source_sha.slice(0, 10) : "unknown") +
      " · generated " + (p.generated_utc || "unknown") +
      " · verified " + (p.verified_utc || "never") + (p.site_sha ? " at site " + p.site_sha.slice(0, 10) : "");
  }

  // Lines for the Labyrinth gallery card: status, latest verified milestone, provenance.
  function lines() {
    if (!window.O38S_VIEW) return [UNAVAILABLE];
    var v = currentView();
    var out = [window.O38S_VIEW.summary(v)];
    out.push("Latest verified milestone: " + (v.milestone || "unknown"));
    if (!v.trusted) out.push("Status unknown: " + v.why_unknown.join("; "));
    out.push(provenanceText(v));
    return out;
  }

  function row(table, label, status, detail) {
    var tr = el("tr");
    tr.appendChild(el("th", null, label));
    var cell = el("td");
    cell.appendChild(pill(status));
    tr.appendChild(cell);
    tr.appendChild(el("td", "o38s-detail", detail || ""));
    table.appendChild(tr);
  }

  function stageDetail(stage) {
    var parts = [];
    if (stage.reason) parts.push(stage.reason);
    if (stage.runs_expected !== null && stage.runs_exit0 !== null) {
      parts.push("runs " + stage.runs_exit0 + "/" + stage.runs_expected + " exited 0");
    }
    stage.checks.forEach(function (c) { parts.push(c.name + " " + c.status); });
    return parts.join(" · ");
  }

  function keyValues(obj) {
    return Object.keys(obj).filter(function (k) { return obj[k] !== null && typeof obj[k] !== "object"; })
      .map(function (k) { return k + " " + obj[k]; }).join(" · ");
  }

  function list(root, title, items, empty) {
    root.appendChild(el("h3", "o38s-h", title));
    if (!items.length) {
      root.appendChild(el("p", "o38s-note", empty));
      return;
    }
    var ul = el("ul", "o38s-list");
    items.forEach(function (item) {
      ul.appendChild(el("li", null, typeof item === "string" ? item : keyValues(item)));
    });
    root.appendChild(ul);
  }

  function dashboard(root) {
    if (!window.O38S_VIEW) {
      root.appendChild(el("p", "o38s-warning", UNAVAILABLE + "."));
      return;
    }
    var v = currentView();
    root.appendChild(el("h2", "o38s-title", v.name));
    if (v.objective) root.appendChild(el("p", "o38s-objective", v.objective));
    if (!v.trusted) {
      root.appendChild(el("p", "o38s-warning", "Status unknown: " + v.why_unknown.join("; ") + "."));
    }
    if (v.current_stage) root.appendChild(el("p", "o38s-note", "Current stage: " + v.current_stage));

    var table = el("table", "o38s-table");
    v.stages.forEach(function (stage) { row(table, stage.label, stage.status, stageDetail(stage)); });
    row(table, "Construction gate", v.gate.status, v.gate.family ? keyValues(v.gate.family) : "");
    var t = v.tests;
    var counts = [];
    if (t.passed !== null) counts.push(t.passed + " passed");
    if (t.failed !== null) counts.push(t.failed + " failed");
    if (t.defined !== null) counts.push(t.defined + " defined");
    if (t.reason) counts.push(t.reason);
    row(table, "Tests", t.status, counts.join(" · "));
    root.appendChild(table);

    root.appendChild(el("h3", "o38s-h", "Latest verified milestone"));
    root.appendChild(el("p", "o38s-note", v.milestone || "unknown"));
    list(root, "Stage 2 phases", v.phases, v.trusted ? "none recorded: a running stage is visible only where it runs, until its log is committed" : "unknown");
    list(root, "Earlier attempts", v.attempts, v.trusted ? "none" : "unknown");
    list(root, "Blockers", v.blockers, v.blockers_known ? "none recorded" : "unknown");

    root.appendChild(el("h3", "o38s-h", "Evidence"));
    if (v.links.length) {
      var ul = el("ul", "o38s-list");
      v.links.forEach(function (link) {
        var li = el("li");
        var a = el("a", null, link.label);
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.appendChild(a);
        ul.appendChild(li);
      });
      root.appendChild(ul);
    } else {
      root.appendChild(el("p", "o38s-note", "unavailable"));
    }
    root.appendChild(el("p", "o38s-provenance", provenanceText(v)));
    root.appendChild(el("p", "o38s-provenance",
      "Statuses come from checker receipts in the repository. They are not a scientific verdict; a launched run is never a pass."));
  }

  window.O38S_CARD = { lines: lines, dashboard: dashboard };

  function start() {
    var root = document.getElementById("o38s-dashboard");
    if (root) dashboard(root);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
