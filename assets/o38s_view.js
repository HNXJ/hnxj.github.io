// View model for the Jomission/LANSA (OPEN-38) status cards. Pure: no DOM, no network.
//
// jomission's generator (scripts/open38_status.py, schema o38s_status/1) is the only authority for a status.
// This file holds no status logic: it shows the generator's `public_status` values, or UNKNOWN, and never
// derives, upgrades or cross-checks a verdict. Whether the snapshot is what the generator writes at its source
// commit is decided before deployment by the regeneration gate (tools/o38s_status.py), which builds the artifact
// this file reads: window.O38S_ARTIFACT = { snapshot_text, verification }.
//
// The view owns provenance, freshness and presentation. A status is shown only when the artifact carries a
// verification record, the snapshot's bytes hash to the record's sha256, the snapshot has the fields the cards
// need, its source is the verified one, and the verification is not older than MAX_AGE_HOURS. Anything else
// shows UNKNOWN everywhere, with the reason.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.O38S_VIEW = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA = "o38s_status/1";
  var VERIFICATION_SCHEMA = "o38s_verification/1";
  var STATUSES = ["PASS", "FAIL", "RUNNING", "BLOCKED", "UNKNOWN"];
  // Provisional (owner, 2026-11-17): a verification older than a week shows UNKNOWN until the site is rebuilt.
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

  // The generator's and the gate's time format, exactly: Date.parse alone accepts trailing text.
  // A real UTC instant in the generator's form: a time that does not exist (month 13, 30 February) is refused,
  // since comparisons with an unparsable time are all false and would let the freshness checks pass.
  function isUtc(x) {
    if (typeof x !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)) return false;
    var ms = Date.parse(x);
    return !isNaN(ms) && new Date(ms).toISOString().slice(0, 19) + "Z" === x;
  }

  function isStatus(x) {
    return STATUSES.indexOf(x) !== -1;
  }

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  // SHA-256 of a string's UTF-8 bytes, as hex. Synchronous, so a page can check the artifact before drawing.
  function sha256(str) {
    var b = utf8(str);
    var bits = b.length * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    var hi = Math.floor(bits / 0x100000000);
    var lo = bits >>> 0;
    b.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
      (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var i = 0; i < b.length; i += 64) {
      var j;
      for (j = 0; j < 16; j++) {
        w[j] = ((b[i + 4 * j] << 24) | (b[i + 4 * j + 1] << 16) | (b[i + 4 * j + 2] << 8) | b[i + 4 * j + 3]) >>> 0;
      }
      for (j = 16; j < 64; j++) {
        var x = w[j - 15];
        var y = w[j - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      var A = h[0], B = h[1], C = h[2], D = h[3], E = h[4], F = h[5], G = h[6], H = h[7];
      for (j = 0; j < 64; j++) {
        var t1 = (H + (rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25)) + ((E & F) ^ (~E & G)) + K[j] + w[j]) >>> 0;
        var t2 = ((rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) >>> 0;
        H = G; G = F; F = E; E = (D + t1) >>> 0; D = C; C = B; B = A; A = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + A) >>> 0; h[1] = (h[1] + B) >>> 0; h[2] = (h[2] + C) >>> 0; h[3] = (h[3] + D) >>> 0;
      h[4] = (h[4] + E) >>> 0; h[5] = (h[5] + F) >>> 0; h[6] = (h[6] + G) >>> 0; h[7] = (h[7] + H) >>> 0;
    }
    return h.map(function (v) { return ("00000000" + v.toString(16)).slice(-8); }).join("");
  }

  // The fields the cards need, with the types the generator writes.
  function wellFormed(s) {
    function stage(x) {
      return isObject(x) && isStatus(x.status) && isStatus(x.public_status);
    }
    return stage(s.stage1) && stage(s.stage2) && isObject(s.tests) && isStatus(s.tests.status);
  }

  // The snapshot and its verification record, with every reason the artifact cannot be trusted (none: trusted).
  function read(artifact, nowMs, maxAgeHours) {
    var out = { why: [], status: {}, verification: {} };
    if (!isObject(artifact)) {
      out.why.push("no verified status artifact");
      return out;
    }
    var v = artifact.verification;
    if (!isObject(v) || v.schema !== VERIFICATION_SCHEMA || !/^[0-9a-f]{64}$/.test(String(v.snapshot_sha256)) ||
        typeof v.snapshot_sha256 !== "string" || !isSha(v.site_sha) || !isSha(v.source_sha) || !isUtc(v.verified_utc)) {
      out.why.push("the snapshot is not verified");
      return out;
    }
    if (typeof artifact.snapshot_text !== "string" || sha256(artifact.snapshot_text) !== v.snapshot_sha256) {
      out.why.push("the snapshot is not the verified one");
      return out;
    }
    var s;
    try {
      s = JSON.parse(artifact.snapshot_text);
    } catch (e) {
      s = null;
    }
    if (!isObject(s)) {
      out.why.push("malformed snapshot");
      return out;
    }
    out.verification = v;
    if (s.schema !== SCHEMA) out.why.push("unknown schema");
    else if (!wellFormed(s)) out.why.push("malformed snapshot");
    var source = isObject(s.source) ? s.source : {};
    if (!isSha(source.sha)) out.why.push("no source commit");
    else if (source.sha !== v.source_sha) out.why.push("the source is not the verified one");
    if (source.dirty_tracked !== false) out.why.push("source tree had uncommitted changes");
    var verified = Date.parse(v.verified_utc);
    if (!isUtc(s.generated_utc)) out.why.push("no generation time");
    else if (Date.parse(s.generated_utc) - verified > CLOCK_SKEW_MS) out.why.push("generated after its verification");
    if (typeof nowMs !== "number" || isNaN(nowMs)) out.why.push("no clock");
    else if (verified - nowMs > CLOCK_SKEW_MS) out.why.push("verification time is in the future");
    else if (nowMs - verified > maxAgeHours * 3600 * 1000) out.why.push("stale: verified more than " + maxAgeHours + " h ago");
    if (!out.why.length) out.status = s;
    return out;
  }

  // A record's plain values (strings and numbers), for rows of generator detail. No nested markup or objects.
  function plain(item) {
    var out = {};
    Object.keys(item).forEach(function (k) {
      if (typeof item[k] === "string" || (typeof item[k] === "number" && isFinite(item[k]))) out[k] = item[k];
    });
    return out;
  }

  function plainList(list) {
    return Array.isArray(list) ? list.filter(isObject).map(plain) : [];
  }

  // Cards render `public_status` (generator contract). The stage's detail is that of its local status, so it is
  // shown only when the two are the same status.
  function stageView(label, stage) {
    stage = isObject(stage) ? stage : {};
    var status = isStatus(stage.public_status) ? stage.public_status : "UNKNOWN";
    var detailed = status !== "UNKNOWN" && stage.status === stage.public_status;
    var checks = [];
    if (detailed && isObject(stage.checks)) {
      Object.keys(stage.checks).forEach(function (name) {
        if (isStatus(stage.checks[name])) checks.push({ name: name, status: stage.checks[name] });
      });
    }
    return {
      label: label,
      status: status,
      reason: detailed ? text(stage.reason) : null,
      runs_exit0: detailed ? count(stage.runs_exit0) : null,
      runs_expected: detailed ? count(stage.runs_expected) : null,
      checks: checks,
      detailed: detailed
    };
  }

  function evidenceLinks(s) {
    var base = text(s.source.repo_url);
    if (!base || base.indexOf("https://github.com/") !== 0 || !isObject(s.evidence)) return [];
    var links = [];
    Object.keys(EVIDENCE_LABELS).forEach(function (key) {
      var path = isObject(s.evidence[key]) ? text(s.evidence[key].path) : null;
      if (!path || path.indexOf("..") !== -1 || path.charAt(0) === "/" || /[\s"'<>\\?#]/.test(path)) return;
      links.push({ label: EVIDENCE_LABELS[key], url: base + "/blob/" + s.source.sha + "/" + path });
    });
    return links;
  }

  function view(artifact, nowMs, maxAgeHours) {
    var hours = typeof maxAgeHours === "number" && isFinite(maxAgeHours) && maxAgeHours > 0 ? maxAgeHours : MAX_AGE_HOURS;
    var got = read(artifact, nowMs, hours);
    var trusted = got.why.length === 0;
    var s = got.status;  // empty unless trusted
    var v = got.verification;
    var stage1 = stageView("Stage 1", s.stage1);
    var stage2 = stageView("Stage 2", s.stage2);
    var raw2 = isObject(s.stage2) ? s.stage2 : {};
    var gate = isObject(raw2.construction_gate) ? raw2.construction_gate : {};
    var tests = isObject(s.tests) ? s.tests : {};
    var milestone = isObject(s.latest_verified_milestone) ? s.latest_verified_milestone : {};
    var project = isObject(s.project) ? s.project : {};

    return {
      trusted: trusted,
      why_unknown: got.why,
      name: "Jomission / LANSA (OPEN-38)",
      objective: text(project.objective),
      current_stage: text(s.current_stage),
      stages: [stage1, stage2],
      gate: {
        status: stage2.detailed && isStatus(gate.verdict) ? gate.verdict : "UNKNOWN",
        family: stage2.detailed && isObject(gate.family) ? plain(gate.family) : null
      },
      tests: {
        status: isStatus(tests.status) ? tests.status : "UNKNOWN",
        passed: count(tests.passed),
        failed: count(tests.failed),
        defined: count(tests.defined),
        reason: text(tests.reason)
      },
      phases: stage2.detailed ? plainList(raw2.phases) : [],
      attempts: stage2.detailed ? plainList(raw2.attempts) : [],
      blockers: Array.isArray(s.blockers) ? s.blockers.filter(text) : [],
      blockers_known: Array.isArray(s.blockers),
      milestone: text(milestone.what),
      links: trusted ? evidenceLinks(s) : [],
      provenance: {
        source_sha: isSha(v.source_sha) ? v.source_sha : null,
        generated_utc: trusted ? s.generated_utc : null,
        verified_utc: isUtc(v.verified_utc) ? v.verified_utc : null,
        site_sha: isSha(v.site_sha) ? v.site_sha : null
      }
    };
  }

  // One line for a gallery card: "Stage 1 PASS · Stage 2 UNKNOWN".
  function summary(v) {
    return v.stages.map(function (st) { return st.label + " " + st.status; }).join(" · ");
  }

  return {
    view: view, summary: summary, sha256: sha256, STATUSES: STATUSES, MAX_AGE_HOURS: MAX_AGE_HOURS,
    SCHEMA: SCHEMA, VERIFICATION_SCHEMA: VERIFICATION_SCHEMA
  };
});
