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

  function isSha(x) {
    return typeof x === "string" && /^[0-9a-f]{40}$/.test(x);
  }

  // The generator's time format, exactly: Date.parse alone accepts trailing text.
  function isUtc(x) {
    return typeof x === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x);
  }

  // Why the snapshot cannot be trusted; an empty list means it can.
  function distrust(status, nowMs, maxAgeHours) {
    if (!isObject(status)) return ["no status snapshot"];
    var why = [];
    if (status.schema !== SCHEMA) why.push("unknown schema");
    var source = isObject(status.source) ? status.source : {};
    if (!isSha(source.sha)) why.push("no source commit");
    if (source.dirty_tracked !== false) why.push("source tree had uncommitted changes");
    var t = isUtc(status.generated_utc) ? Date.parse(status.generated_utc) : NaN;
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

  // A stage published as PASS whose own fields say otherwise: a check that is not PASS, run counts that are
  // missing or unequal, a failed consistency block, a failed phase or a failed construction gate.
  // `spec` is the generator's fixed shape for the stage (open38_status.py): its run count and check names.
  function contradictsPass(stage, spec) {
    var checks = isObject(stage.checks) ? stage.checks : {};
    var bad = spec.checks.some(function (name) { return checks[name] !== "PASS"; }) ||
      Object.keys(checks).some(function (name) { return checks[name] !== "PASS"; });
    var runs = stage.runs_expected !== spec.runs || stage.runs_exit0 !== spec.runs;
    var phases = Array.isArray(stage.phases) ? stage.phases : [];
    var phase = (spec.phases && !phases.length) || phases.some(function (p) {
      return !isObject(p) || p.status !== "PASS" || p.construction === "FAIL" || p.integrity === "FAIL";
    });
    var gate = spec.gate && !(isObject(stage.construction_gate) && stage.construction_gate.verdict === "PASS");
    return bad || runs || phase || gate || (isObject(stage.consistency) && stage.consistency.ok === false);
  }

  var STAGE1 = { runs: 15, checks: ["stage_check", "integrity", "construction_frozen", "construction_ruling_b"], phases: false, gate: false };
  var STAGE2 = { runs: 30, checks: [], phases: true, gate: true };
  var MODES = ["smoke", "rest"];

  function verdict(x) {
    return STATUSES.indexOf(x) !== -1 ? x : null;
  }

  // One generator record (a phase or an attempt): the contract's keys, each with its own type. A record whose
  // mode is not a known one is dropped.
  function record(item, withReason) {
    if (!isObject(item) || MODES.indexOf(item.mode) === -1) return null;
    var out = { mode: item.mode };
    if (count(item.attempt) !== null) out.attempt = item.attempt;
    if (verdict(item.status)) out.status = item.status;
    if (withReason && text(item.reason)) out.reason = item.reason;
    if (count(item.started) !== null) out.started = item.started;
    if (count(item.exit0) !== null) out.exit0 = item.exit0;
    if (verdict(item.construction)) out.construction = item.construction;
    if (verdict(item.integrity)) out.integrity = item.integrity;
    if (isSha(item.head)) out.head = item.head;
    if (isUtc(item.last_line_utc)) out.last_line_utc = item.last_line_utc;
    if (!withReason && text(item.stop)) out.stop = item.stop;
    return out;
  }

  function records(list, withReason) {
    if (!Array.isArray(list)) return [];
    return list.map(function (item) { return record(item, withReason); }).filter(isObject);
  }

  // The gate's multiple-comparison family: numbers under plain names.
  function numbers(obj) {
    var out = {};
    Object.keys(obj).forEach(function (k) {
      if (/^[a-z][a-z0-9_]*$/.test(k) && !/pass/.test(k) && typeof obj[k] === "number" && isFinite(obj[k])) out[k] = obj[k];
    });
    return out;
  }

  // The generator writes a blocker as "stage N: <reason>" for a stage that is BLOCKED or FAIL. One is shown only
  // when it is that line for a stage this view shows as BLOCKED or FAIL.
  function blockerViews(s, stages) {
    var listed = Array.isArray(s.blockers) ? s.blockers : null;
    if (!listed) return { items: [], known: false };
    var allowed = [];
    stages.forEach(function (st) {
      if ((st.status === "BLOCKED" || st.status === "FAIL") && st.reason) allowed.push(st.label.toLowerCase() + ": " + st.reason);
    });
    var items = listed.filter(function (b) { return allowed.indexOf(b) !== -1; });
    return { items: items, known: items.length === listed.length };
  }

  function stageView(label, stage, trusted, spec) {
    stage = isObject(stage) ? stage : {};
    // A verdict is shown only as the generator publishes it: receipts committed and the public status equal to
    // the local one. Anything else, a PASS its own checks contradict included, is UNKNOWN.
    var status = stage.committed === true && stage.public_status === stage.status ? shown(stage.public_status, trusted) : "UNKNOWN";
    if (status === "PASS" && contradictsPass(stage, spec)) status = "UNKNOWN";
    // Detail (reason, checks, run counts, gate, phases, attempts, blockers) belongs to a shown verdict. An
    // UNKNOWN stage shows no detail: its checks and reason can read PASS from machine-local files.
    var verified = status !== "UNKNOWN";
    var checks = [];
    if (verified && isObject(stage.checks)) {
      spec.checks.forEach(function (name) {
        if (verdict(stage.checks[name])) checks.push({ name: name, status: stage.checks[name] });
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
      if (!Object.prototype.hasOwnProperty.call(EVIDENCE_LABELS, key) || !path || path.indexOf("..") !== -1 || path.charAt(0) === "/" || /[\s"'<>\\?#]/.test(path)) return;
      links.push({ label: EVIDENCE_LABELS[key], url: base + "/blob/" + source.sha + "/" + path });
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
      var what = text(m.what);
      // The text must also name that stage first ("stage 1 ...", "stage 2: ...") and no other item after it.
      if (stages[i].status === "PASS" && receipt && m.evidence === receipt && what &&
          what.indexOf("stage " + (i + 1)) === 0 && !/\d/.test(what.charAt(7)) &&
          !/stage|gate|test/i.test(what.slice(7))) return what;
    }
    return null;
  }

  function view(status, nowMs, maxAgeHours) {
    var hours = typeof maxAgeHours === "number" && isFinite(maxAgeHours) && maxAgeHours > 0 ? maxAgeHours : MAX_AGE_HOURS;
    var why = distrust(status, nowMs, hours);
    var trusted = why.length === 0;
    var s = isObject(status) ? status : {};
    var source = isObject(s.source) ? s.source : {};
    var project = isObject(s.project) ? s.project : {};
    var stage1 = stageView("Stage 1", s.stage1, trusted, STAGE1);
    var stage2 = stageView("Stage 2", s.stage2, trusted, STAGE2);
    var raw2 = isObject(s.stage2) ? s.stage2 : {};
    var gate = isObject(raw2.construction_gate) ? raw2.construction_gate : {};
    var tests = isObject(s.tests) ? s.tests : {};
    var testsPublic = trusted && STATUSES.indexOf(tests.status) !== -1 && tests.public_status === tests.status &&
      !(tests.status === "PASS" && !(count(tests.passed) > 0 && tests.failed === 0));
    var blockers = trusted ? blockerViews(s, [stage1, stage2]) : { items: [], known: false };

    return {
      trusted: trusted,
      why_unknown: why,
      name: "Jomission / LANSA (OPEN-38)",
      objective: trusted ? text(project.objective) : null,
      current_stage: trusted && (s.current_stage === "stage 1" || s.current_stage === "stage 2") ? s.current_stage : null,
      stages: [stage1, stage2],
      // The gate verdict is a stage-2 detail: shown only when stage 2 is repository-verified.
      gate: {
        status: shown(stage2.verified ? gate.verdict : null, trusted),
        family: stage2.verified && isObject(gate.family) ? numbers(gate.family) : null
      },
      // The generator gives the test run no public status (it is a run on the generating machine, with no
      // committed receipt), so its verdict is shown only if a later generator publishes one as `public_status`.
      tests: {
        status: testsPublic ? tests.status : "UNKNOWN",
        passed: testsPublic ? count(tests.passed) : null,
        failed: testsPublic ? count(tests.failed) : null,
        defined: trusted ? count(tests.defined) : null,
        reason: testsPublic && /^pytest rc \d+$/.test(String(tests.reason)) ? tests.reason : null
      },
      phases: stage2.verified ? records(raw2.phases, true) : [],
      attempts: stage2.verified ? records(raw2.attempts, false) : [],
      blockers: blockers.items,
      blockers_known: blockers.known,
      milestone: trusted ? milestoneText(s, [stage1, stage2]) : null,
      links: trusted ? evidenceLinks(s) : [],
      provenance: {
        sha: isSha(source.sha) ? source.sha : null,        generated_utc: isUtc(s.generated_utc) ? s.generated_utc : null
      }
    };
  }

  // One line for a gallery card: "Stage 1 PASS · Stage 2 UNKNOWN".
  function summary(v) {
    return v.stages.map(function (st) { return st.label + " " + st.status; }).join(" · ");
  }

  return { view: view, summary: summary, STATUSES: STATUSES, MAX_AGE_HOURS: MAX_AGE_HOURS, SCHEMA: SCHEMA };
});
