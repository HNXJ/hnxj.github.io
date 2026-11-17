// View model for the Jomission/LANSA (OPEN-38) status cards. Pure: no DOM, no network.
// Input: the JSON written by jomission `scripts/open38_status.py` (schema o38s_status/1), as stored in
// assets/data/o38s_status.js by tools/refresh_o38s_status.py. This file holds no status logic of its own: it
// shows the generator's `public_status` values, or UNKNOWN. It never upgrades a status.
//
// A snapshot is trusted only when its schema, source SHA and time are readable, the source tree was clean and
// the snapshot is not older than MAX_AGE_HOURS. An untrusted snapshot shows UNKNOWN everywhere and no milestone.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.O38S_VIEW = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA = "o38s_status/1";
  var STATUSES = ["PASS", "FAIL", "RUNNING", "BLOCKED", "UNKNOWN"];
  var MAX_AGE_HOURS = 168;
  var CLOCK_SKEW_MS = 5 * 60 * 1000;
  var EVIDENCE_LABELS = {
    spec: "Specification",
    stage1_receipt: "Stage 1 receipt",
    stage2_receipt: "Stage 2 receipt",
    gate_ruling: "Construction-gate ruling"
  };

  function isObject(x) {
    return x !== null && typeof x === "object" && !Array.isArray(x);
  }

  function text(x) {
    return typeof x === "string" && x ? x : null;
  }

  function count(x) {
    return typeof x === "number" && isFinite(x) && x >= 0 ? x : null;
  }

  // Why the snapshot cannot be trusted; an empty list means it can.
  function distrust(status, nowMs, maxAgeHours) {
    if (!isObject(status)) return ["no status snapshot"];
    var why = [];
    if (status.schema !== SCHEMA) why.push("unknown schema");
    var source = isObject(status.source) ? status.source : {};
    if (!/^[0-9a-f]{40}$/.test(String(source.sha))) why.push("no source commit");
    if (source.dirty_tracked !== false) why.push("source tree had uncommitted changes");
    var t = text(status.generated_utc) ? Date.parse(status.generated_utc) : NaN;
    if (isNaN(t)) {
      why.push("no generation time");
    } else if (typeof nowMs !== "number" || isNaN(nowMs)) {
      why.push("no clock");
    } else if (t - nowMs > CLOCK_SKEW_MS) {
      why.push("generation time is in the future");
    } else if (nowMs - t > maxAgeHours * 3600 * 1000) {
      why.push("stale: generated more than " + maxAgeHours + " h ago");
    }
    return why;
  }

  function shown(value, trusted) {
    return trusted && STATUSES.indexOf(value) !== -1 ? value : "UNKNOWN";
  }

  function stageView(label, stage, trusted) {
    stage = isObject(stage) ? stage : {};
    var status = shown(stage.public_status, trusted);
    // Detail (reason, checks, run counts) is repository-verified only when the public status is the local one.
    var verified = trusted && stage.public_status === stage.status;
    var checks = [];
    if (verified && isObject(stage.checks)) {
      Object.keys(stage.checks).forEach(function (name) {
        checks.push({ name: name, status: shown(stage.checks[name], true) });
      });
    }
    return {
      label: label,
      status: status,
      reason: verified ? text(stage.reason) : null,
      runs_exit0: verified ? count(stage.runs_exit0) : null,
      runs_expected: verified ? count(stage.runs_expected) : null,
      checks: checks,
      verified: verified
    };
  }

  function evidenceLinks(status) {
    var source = status.source;
    var base = text(source.repo_url);
    if (!base || base.indexOf("https://github.com/") !== 0 || !isObject(status.evidence)) return [];
    var links = [];
    Object.keys(status.evidence).forEach(function (key) {
      var path = isObject(status.evidence[key]) ? text(status.evidence[key].path) : null;
      if (!path || path.indexOf("..") !== -1 || path.charAt(0) === "/" || /[\s"'<>\\]/.test(path)) return;
      links.push({ label: EVIDENCE_LABELS[key] || key, url: base + "/blob/" + source.sha + "/" + path });
    });
    return links;
  }

  // The generator's milestone text names a passed stage ("... receipts PASS"), so it is shown only when its
  // evidence is the receipt of a stage this view shows as PASS; otherwise the snapshot contradicts itself.
  function milestoneText(s, stages) {
    var m = isObject(s.latest_verified_milestone) ? s.latest_verified_milestone : {};
    var evidence = isObject(s.evidence) ? s.evidence : {};
    var keys = ["stage1_receipt", "stage2_receipt"];
    for (var i = 0; i < stages.length; i++) {
      var receipt = isObject(evidence[keys[i]]) ? text(evidence[keys[i]].path) : null;
      if (stages[i].status === "PASS" && receipt && m.evidence === receipt) return text(m.what);
    }
    return null;
  }

  function view(status, nowMs, maxAgeHours) {
    var hours = typeof maxAgeHours === "number" ? maxAgeHours : MAX_AGE_HOURS;
    var why = distrust(status, nowMs, hours);
    var trusted = why.length === 0;
    var s = isObject(status) ? status : {};
    var source = isObject(s.source) ? s.source : {};
    var project = isObject(s.project) ? s.project : {};
    var stage1 = stageView("Stage 1", s.stage1, trusted);
    var stage2 = stageView("Stage 2", s.stage2, trusted);
    var raw2 = isObject(s.stage2) ? s.stage2 : {};
    var gate = isObject(raw2.construction_gate) ? raw2.construction_gate : {};
    var tests = isObject(s.tests) ? s.tests : {};

    return {
      trusted: trusted,
      why_unknown: why,
      name: text(project.name) || "Jomission / LANSA (OPEN-38)",
      objective: text(project.objective),
      current_stage: trusted ? text(s.current_stage) : null,
      stages: [stage1, stage2],
      // The gate verdict is a stage-2 detail: shown only when stage 2 is repository-verified.
      gate: {
        status: shown(stage2.verified ? gate.verdict : null, trusted),
        family: stage2.verified && isObject(gate.family) ? gate.family : null
      },
      tests: {
        status: shown(tests.status, trusted),
        passed: trusted ? count(tests.passed) : null,
        failed: trusted ? count(tests.failed) : null,
        defined: trusted ? count(tests.defined) : null,
        reason: trusted ? text(tests.reason) : null
      },
      phases: stage2.verified && Array.isArray(raw2.phases) ? raw2.phases.filter(isObject) : [],
      attempts: stage2.verified && Array.isArray(raw2.attempts) ? raw2.attempts.filter(isObject) : [],
      blockers: trusted && Array.isArray(s.blockers) ? s.blockers : [],
      blockers_known: trusted && Array.isArray(s.blockers),
      milestone: trusted ? milestoneText(s, [stage1, stage2]) : null,
      links: trusted ? evidenceLinks(s) : [],
      provenance: {
        sha: /^[0-9a-f]{40}$/.test(String(source.sha)) ? source.sha : null,
        branch: text(source.branch),
        generated_utc: text(s.generated_utc)
      }
    };
  }

  // One line for a gallery card: "Stage 1 PASS · Stage 2 UNKNOWN".
  function summary(v) {
    return v.stages.map(function (st) { return st.label + " " + st.status; }).join(" · ");
  }

  return { view: view, summary: summary, STATUSES: STATUSES, MAX_AGE_HOURS: MAX_AGE_HOURS, SCHEMA: SCHEMA };
});
