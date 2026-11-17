// Tests of assets/o38s_view.js: provenance, freshness and presentation of a verified artifact.
// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const V = require("../assets/o38s_view.js");

const NOW = Date.parse("2026-11-17T21:00:00Z");
const SHA = "568e659a9e6d1f810b6ad05bf070f659d86bbba0";
const SITE = "18c1e229ae3c09f8cff066f1ede567b52fab4c7b";
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// A snapshot in the generator's shape (o38s_status/1): stage 1 passed and committed, stage 2 not started.
function snapshot(change) {
  const s = {
    schema: "o38s_status/1",
    generated_utc: "2026-11-17T19:32:37Z",
    source: { sha: SHA, branch: "_temp_o38s-status", dirty_tracked: false, repo_url: "https://github.com/HNXJ/jomission" },
    project: { name: "Jomission / LANSA (OPEN-38)", objective: "objective text" },
    current_stage: "stage 1",
    stage1: {
      status: "PASS", public_status: "PASS", committed: true, reason: "DONE; checks PASS",
      runs_exit0: 15, runs_expected: 15,
      checks: { stage_check: "PASS", integrity: "PASS", construction_frozen: "PASS", construction_ruling_b: "PASS" }
    },
    stage2: {
      status: "UNKNOWN", public_status: "UNKNOWN", reason: "no stage-2 log", runs_expected: 30,
      attempts: [{ attempt: 1, mode: "smoke", construction: "FAIL", stop: "STOP: construction invariance failed" }],
      construction_gate: { verdict: "UNKNOWN", family: null }, phases: []
    },
    tests: { files: 7, defined: 57, status: "UNKNOWN", reason: "not run (--run-tests not given)" },
    latest_verified_milestone: { what: "stage 1 positive controls: 15/15 runs", evidence: "docs/laminar_motif/S1.md" },
    blockers: [],
    evidence: { spec: { path: "docs/laminar_motif/SPEC.md", sha256: "0" }, stage1_receipt: { path: "docs/laminar_motif/S1.md", sha256: "1" } }
  };
  if (change) change(s);
  return s;
}

// The artifact the gate builds for a snapshot: its text and a verification record bound to that text.
// `seal` changes the artifact after it was sealed, the way nothing in the pipeline does.
function artifact(change, seal) {
  const text = JSON.stringify(snapshot(change), null, 1) + "\n";
  const a = {
    snapshot_text: text,
    verification: {
      schema: "o38s_verification/1", snapshot_sha256: sha256(text), site_sha: SITE, source_sha: SHA,
      source_repo: "https://github.com/HNXJ/jomission", source_ref: "refs/heads/_temp_o38s-status",
      python: "3.14", verified_utc: "2026-11-17T20:00:00Z"
    }
  };
  if (seal) seal(a);
  return a;
}

const view = (change, seal, now = NOW, maxAge) => V.view(artifact(change, seal), now, maxAge);
const hasPass = (v) => JSON.stringify(v).includes("PASS");
const stage2Is = (status) => (s) => {
  s.stage2 = { status, public_status: status, committed: true, reason: "generator reason", runs_exit0: 30, runs_expected: 30,
    construction_gate: { verdict: status, family: { alpha: 0.05, n_tests: 780, nested: { x: 1 } } },
    phases: [{ mode: "smoke", status: "PASS", exit0: 15, extra: ["x"] }, { mode: "rest", status, exit0: 15 }], attempts: [] };
};

test("sha256 matches the reference implementation at block boundaries and on the committed snapshot", () => {
  assert.equal(V.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
    const text = "a".repeat(n);
    assert.equal(V.sha256(text), sha256(text), `length ${n}`);
  }
  assert.equal(V.sha256("é → 🙂"), sha256("é → 🙂"));
  const committed = readFileSync(new URL("../data/o38s/status.json", import.meta.url), "utf8");
  assert.ok(committed.length > 3000, "the committed snapshot spans many blocks");
  assert.equal(V.sha256(committed), sha256(committed));
});

test("a verified artifact shows the generator's public statuses and detail", () => {
  const v = view();
  assert.equal(v.trusted, true);
  assert.deepEqual(v.why_unknown, []);
  assert.deepEqual(v.stages.map((s) => s.status), ["PASS", "UNKNOWN"]);
  assert.equal(V.summary(v), "Stage 1 PASS · Stage 2 UNKNOWN");
  assert.equal(v.stages[0].reason, "DONE; checks PASS");
  assert.equal(v.stages[0].runs_exit0, 15);
  assert.equal(v.stages[0].checks.length, 4);
  assert.equal(v.milestone, "stage 1 positive controls: 15/15 runs");
  assert.equal(v.current_stage, "stage 1");
  assert.equal(v.objective, "objective text");
  assert.deepEqual(v.provenance, { source_sha: SHA, generated_utc: "2026-11-17T19:32:37Z", verified_utc: "2026-11-17T20:00:00Z", site_sha: SITE });
});

for (const status of ["PASS", "FAIL", "RUNNING", "BLOCKED", "UNKNOWN"]) {
  test(`stage 2, gate and tests ${status} are shown as ${status}, without reinterpretation`, () => {
    const v = view((s) => { stage2Is(status)(s); s.tests.status = status; s.tests.passed = 50; s.tests.failed = 7; });
    assert.equal(v.stages[1].status, status);
    assert.equal(v.tests.status, status);
    assert.equal(v.tests.passed, 50);
    assert.equal(v.gate.status, status);
    assert.equal(v.stages[1].reason, status === "UNKNOWN" ? null : "generator reason");
    assert.equal(v.stages[0].status, "PASS", "stage 1 is not touched");
  });
}

// The view holds no verdict rules: a snapshot the gate verified is shown as the generator wrote it. The gate,
// not this file, refuses the contradictory fixtures (tests/test_o38s_status.py).
test("the view does not second-guess a verified snapshot", () => {
  const cases = JSON.parse(readFileSync(new URL("./fixtures/o38s_contradictions.json", import.meta.url), "utf8")).cases;
  const smokeOnly = cases.find((c) => c.name === "stage 2 PASS with only a smoke phase");
  const v = view((s) => {
    for (const [path, value] of Object.entries(smokeOnly.set)) {
      const parts = path.split("/");
      parts.slice(0, -1).reduce((node, key) => node[key], s)[parts.at(-1)] = value;
    }
  });
  assert.equal(v.stages[1].status, "PASS");
});

test("a contradictory snapshot swapped in under a genuine verification record shows nothing", () => {
  const cases = JSON.parse(readFileSync(new URL("./fixtures/o38s_contradictions.json", import.meta.url), "utf8")).cases;
  assert.ok(cases.length >= 11);
  // A frozen genuine snapshot (stage 1 PASS, stage 2 UNKNOWN) under its own verification record, as the gate
  // builds it; frozen so the cases and the clock below do not depend on the live snapshot.
  const genuine = readFileSync(new URL("./fixtures/o38s_genuine.json", import.meta.url), "utf8");
  const sealed = () => artifact(null, (a) => {
    a.snapshot_text = genuine;
    a.verification.snapshot_sha256 = sha256(genuine);
    a.verification.source_sha = JSON.parse(genuine).source.sha;
  });
  const at = Date.parse("2026-11-17T20:30:00Z");
  assert.equal(V.view(sealed(), at).trusted, true, "the genuine artifact is trusted");
  assert.equal(V.view(sealed(), at).stages[0].status, "PASS", "and shows its PASS");
  for (const c of cases) {
    const forged = JSON.parse(genuine);
    for (const [path, value] of Object.entries(c.set || {})) {
      const parts = path.split("/");
      parts.slice(0, -1).reduce((node, key) => (node[key] ??= {}), forged)[parts.at(-1)] = value;
    }
    for (const path of c.delete || []) {
      const parts = path.split("/");
      delete parts.slice(0, -1).reduce((node, key) => node[key], forged)[parts.at(-1)];
    }
    const text = JSON.stringify(forged, null, 1) + "\n";
    const a = sealed();
    a.snapshot_text = text;
    const v = V.view(a, at);
    assert.notEqual(text, genuine, c.name);
    assert.equal(v.trusted, false, c.name);
    assert.deepEqual(v.why_unknown, ["the snapshot is not the verified one"], c.name);
    assert.equal(hasPass(v), false, c.name);
  }
});

test("a local status that is not the public one is UNKNOWN, with no detail", () => {
  const v = view((s) => {
    stage2Is("PASS")(s);
    s.stage2.public_status = "UNKNOWN";
  });
  assert.equal(v.stages[1].status, "UNKNOWN");
  assert.equal(v.stages[1].reason, null);
  assert.deepEqual(v.stages[1].checks, []);
  assert.equal(v.stages[1].runs_exit0, null);
  assert.equal(v.gate.status, "UNKNOWN");
  assert.equal(v.gate.family, null);
  assert.deepEqual(v.phases, []);
  assert.deepEqual(v.attempts, []);
  assert.equal(hasPass({ stage2: v.stages[1], gate: v.gate, phases: v.phases, attempts: v.attempts }), false);
  const running = view((s) => { stage2Is("RUNNING")(s); s.stage2.public_status = "UNKNOWN"; });
  assert.equal(running.stages[1].status, "UNKNOWN");
});

// Every way an artifact can fail provenance or freshness: all statuses UNKNOWN, no detail, no "PASS" anywhere.
const UNTRUSTED = {
  "no artifact": [() => undefined, "no verified status artifact"],
  "an artifact that is not an object": [() => "PASS", "no verified status artifact"],
  "the bare snapshot, as the old page loaded it": [() => snapshot(), "not verified"],
  "no verification record": [() => artifact(null, (a) => { delete a.verification; }), "not verified"],
  "another verification schema": [() => artifact(null, (a) => { a.verification.schema = "o38s_verification/2"; }), "not verified"],
  "no site commit": [() => artifact(null, (a) => { delete a.verification.site_sha; }), "not verified"],
  "no verification time": [() => artifact(null, (a) => { a.verification.verified_utc = "2026-11-17"; }), "not verified"],
  "verification time with trailing text": [() => artifact(null, (a) => { a.verification.verified_utc += " (Stage 2 PASS)"; }), "not verified"],
  "a hash that is not 64 hex": [() => artifact(null, (a) => { a.verification.snapshot_sha256 = "PASS"; }), "not verified"],
  "a hash given as an array": [() => artifact(null, (a) => { a.verification.snapshot_sha256 = [a.verification.snapshot_sha256]; }), "not verified"],
  "snapshot text changed after verification": [() => artifact(null, (a) => { a.snapshot_text = a.snapshot_text.replace('"UNKNOWN"', '"PASS"'); }), "not the verified one"],
  "snapshot text with one more byte": [() => artifact(null, (a) => { a.snapshot_text += " "; }), "not the verified one"],
  "snapshot given as an object": [() => artifact(null, (a) => { a.snapshot_text = snapshot(); }), "not the verified one"],
  "snapshot text that is not JSON": [() => artifact(null, (a) => { a.snapshot_text = "PASS"; a.verification.snapshot_sha256 = sha256("PASS"); }), "malformed"],
  "snapshot that is an array": [() => artifact(null, (a) => { a.snapshot_text = '["PASS"]'; a.verification.snapshot_sha256 = sha256('["PASS"]'); }), "malformed"],
  "unknown schema": [() => artifact((s) => { s.schema = "o38s_status/2"; }), "schema"],
  "no schema": [() => artifact((s) => { delete s.schema; }), "schema"],
  "a missing stage block": [() => artifact((s) => { delete s.stage2; }), "malformed"],
  "a stage status that is not one of the five": [() => artifact((s) => { s.stage1.public_status = "pass"; }), "malformed"],
  "a stage status with whitespace": [() => artifact((s) => { s.stage1.status = " PASS"; }), "malformed"],
  "a stage status given as an array": [() => artifact((s) => { s.stage1.public_status = ["PASS"]; }), "malformed"],
  "no tests block": [() => artifact((s) => { delete s.tests; }), "malformed"],
  "source that is not the verified one": [() => artifact(null, (a) => { a.verification.source_sha = "0".repeat(40); }), "not the verified one"],
  "no source commit": [() => artifact((s) => { s.source.sha = "c9b9224"; }), "source commit"],
  "source sha given as an array": [() => artifact((s) => { s.source.sha = [SHA]; }), "source commit"],
  "uncommitted source tree": [() => artifact((s) => { s.source.dirty_tracked = true; }), "uncommitted"],
  "dirty flag missing": [() => artifact((s) => { delete s.source.dirty_tracked; }), "uncommitted"],
  "no generation time": [() => artifact((s) => { delete s.generated_utc; }), "generation time"],
  "generation time with trailing text": [() => artifact((s) => { s.generated_utc += " (Stage 2 PASS)"; }), "generation time"],
  "generated after its verification": [() => artifact((s) => { s.generated_utc = "2026-11-17T20:10:00Z"; }), "after its verification"],
  "stale: verified more than the limit ago": [() => artifact(null, (a) => { a.verification.verified_utc = "2026-11-10T20:59:59Z"; }), "stale"],
  "verification time that does not exist": [() => artifact(null, (a) => { a.verification.verified_utc = "2026-13-99T99:99:99Z"; }), "not verified"],
  "verification on 30 February": [() => artifact(null, (a) => { a.verification.verified_utc = "2026-02-30T00:00:00Z"; }), "not verified"],
  "generation time that does not exist": [() => artifact((s) => { s.generated_utc = "2026-02-30T00:00:00Z"; }), "generation time"],
  "verification time in the future": [() => artifact(null, (a) => { a.verification.verified_utc = "2026-11-17T21:06:00Z"; }), "future"],
};

for (const [name, [make, reason]] of Object.entries(UNTRUSTED)) {
  test(`untrusted artifact: ${name}`, () => {
    const a = make();
    assert.ok(JSON.stringify(a ?? "PASS").includes("PASS"), "the fixture must carry a PASS to hide");
    const v = V.view(a, NOW);
    assert.equal(v.trusted, false);
    assert.ok(v.why_unknown.some((w) => w.includes(reason)), `${JSON.stringify(v.why_unknown)} should mention ${reason}`);
    assert.deepEqual(v.stages.map((s) => s.status), ["UNKNOWN", "UNKNOWN"]);
    assert.equal(v.gate.status, "UNKNOWN");
    assert.equal(v.tests.status, "UNKNOWN");
    assert.equal(v.milestone, null);
    assert.equal(v.objective, null);
    assert.equal(v.current_stage, null);
    assert.deepEqual(v.links, []);
    assert.deepEqual(v.blockers, []);
    assert.equal(v.blockers_known, false);
    assert.equal(hasPass(v), false, "no PASS anywhere in the view");
  });
}

test("freshness is measured from the verification time, with a boundary at the limit", () => {
  const at = (utc) => (a) => { a.verification.verified_utc = utc; };
  assert.equal(view((s) => { s.generated_utc = "2026-11-10T20:00:00Z"; }, at("2026-11-10T21:00:00Z")).trusted, true, "exactly 168 h");
  assert.equal(view((s) => { s.generated_utc = "2026-11-10T20:00:00Z"; }, at("2026-11-10T20:59:59Z")).trusted, false, "one second over");
  // An old generation time under a recent verification is fresh: the gate re-proved it against the generator.
  assert.equal(view((s) => { s.generated_utc = "2026-10-01T00:00:00Z"; }).trusted, true);
  assert.equal(view(null, null, NOW, 1).trusted, true, "1 h after a 1 h limit");
  assert.equal(view(null, null, NOW + 1000, 1).trusted, false);
  for (const limit of [NaN, Infinity, 0, -1, "1"]) {
    assert.equal(view(null, at("2026-11-01T00:00:00Z"), NOW, limit).trusted, false, `limit ${String(limit)} falls back to the default`);
  }
  assert.equal(view(null, null, NaN).trusted, false, "no clock");
  assert.equal(view(null, at("2026-11-17T21:04:00Z")).trusted, true, "within clock skew");
});

test("rows carry plain values only, and blockers strings only", () => {
  const v = view((s) => {
    stage2Is("BLOCKED")(s);
    s.stage2.attempts = [{ attempt: 1, mode: "smoke", nested: { a: 1 }, list: [1], flag: true }, "text", null];
    s.blockers = ["stage 2: generator reason", { not: "text" }, 3];
  });
  assert.deepEqual(v.phases, [{ mode: "smoke", status: "PASS", exit0: 15 }, { mode: "rest", status: "BLOCKED", exit0: 15 }]);
  assert.deepEqual(v.attempts, [{ attempt: 1, mode: "smoke" }]);
  assert.deepEqual(v.gate.family, { alpha: 0.05, n_tests: 780 });
  assert.deepEqual(v.blockers, ["stage 2: generator reason"]);
  assert.equal(v.blockers_known, true);
});

test("evidence links point at the verified source commit; unknown keys, unsafe paths and other hosts are dropped", () => {
  const v = view((s) => {
    s.evidence["Stage 2 PASS"] = { path: "a.md" };
    s.evidence.stage2_receipt = { path: "../secret.md" };
    s.evidence.gate_ruling = { path: "docs/x.md?plain=1" };
  });
  assert.deepEqual(v.links, [
    { label: "Specification", url: `https://github.com/HNXJ/jomission/blob/${SHA}/docs/laminar_motif/SPEC.md` },
    { label: "Stage 1 receipt", url: `https://github.com/HNXJ/jomission/blob/${SHA}/docs/laminar_motif/S1.md` },
  ]);
  assert.deepEqual(view((s) => { s.source.repo_url = "javascript:alert(1)"; }).links, []);
  assert.deepEqual(view((s) => { s.source.repo_url = "https://example.com/x"; }).links, []);
});
