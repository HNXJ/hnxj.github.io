// Tests of assets/o38s_view.js: the cards show the generator's public status or UNKNOWN, never a false PASS.
// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const V = require("../assets/o38s_view.js");

const NOW = Date.parse("2026-11-17T19:00:00Z");
const SHA = "c9b92249d1622a0f6f9d05a60717ab0a912321fa";

// A snapshot in the generator's shape (o38s_status/1), stage 1 passed and committed, stage 2 not started.
function snapshot(change) {
  const s = {
    schema: "o38s_status/1",
    generated_utc: "2026-11-17T18:30:34Z",
    source: { sha: SHA, branch: "_temp_o38s-status", dirty_tracked: false, repo_url: "https://github.com/HNXJ/jomission" },
    project: { name: "Jomission / LANSA (OPEN-38)", objective: "objective text" },
    current_stage: "stage 1",
    stage1: {
      status: "PASS", public_status: "PASS", committed: true, reason: "DONE; checks PASS",
      runs_exit0: 15, runs_expected: 15, checks: { stage_check: "PASS", integrity: "PASS" }
    },
    stage2: {
      status: "UNKNOWN", public_status: "UNKNOWN", reason: "no stage-2 log", runs_expected: 30,
      attempts: [{ attempt: 1, mode: "smoke", construction: "FAIL", stop: "STOP: construction invariance failed" }],
      construction_gate: { verdict: "UNKNOWN", family: null }, phases: []
    },
    tests: { files: 7, defined: 53, status: "UNKNOWN", reason: "not run" },
    latest_verified_milestone: { what: "stage 1 positive controls: 15/15 runs", evidence: "docs/laminar_motif/S1.md" },
    blockers: [],
    evidence: { spec: { path: "docs/laminar_motif/SPEC.md", sha256: "0" }, stage1_receipt: { path: "docs/laminar_motif/S1.md", sha256: "1" } }
  };
  if (change) change(s);
  return s;
}

const view = (change, now = NOW, maxAge) => V.view(snapshot(change), now, maxAge);
const hasPass = (v) => JSON.stringify(v).includes("PASS");

test("trusted snapshot shows the generator's public statuses", () => {
  const v = view();
  assert.equal(v.trusted, true);
  assert.deepEqual(v.stages.map((s) => s.status), ["PASS", "UNKNOWN"]);
  assert.equal(V.summary(v), "Stage 1 PASS · Stage 2 UNKNOWN");
  assert.equal(v.milestone, "stage 1 positive controls: 15/15 runs");
  assert.equal(v.stages[0].runs_exit0, 15);
  assert.equal(v.provenance.sha, SHA);
  assert.equal(v.provenance.generated_utc, "2026-11-17T18:30:34Z");
});

for (const status of ["PASS", "FAIL", "RUNNING", "BLOCKED", "UNKNOWN"]) {
  test(`stage 2 public status ${status} is shown as ${status}`, () => {
    const v = view((s) => { s.stage2.status = status; s.stage2.public_status = status; s.stage2.committed = true; s.stage2.runs_exit0 = 30; });
    assert.equal(v.stages[1].status, status);
    assert.equal(v.stages[1].verified, status !== "UNKNOWN");
    assert.equal(v.stages[1].reason, status !== "UNKNOWN" ? "no stage-2 log" : null);
  });
  test(`tests status ${status} is shown as ${status} only when the generator publishes it`, () => {
    const published = view((s) => { s.tests.status = status; s.tests.public_status = status; s.tests.passed = 53; s.tests.failed = 0; });
    assert.equal(published.tests.status, status);
    assert.equal(published.tests.passed, 53);
    const local = view((s) => { s.tests.status = status; s.tests.passed = 53; s.tests.failed = 0; });
    assert.equal(local.tests.status, "UNKNOWN");
    assert.equal(local.tests.passed, null);
    assert.equal(local.tests.failed, null);
    assert.equal(local.tests.defined, 53);
  });
}

// The generator's output for a stage whose receipts exist on its machine but are not committed
// (open38_status.py: public_status UNKNOWN, committed false, checks read from local files).
test("a stage without committed receipts shows no detail, even when both statuses are UNKNOWN", () => {
  for (const committed of [false, null, undefined, "true", 1]) {
    const v = view((s) => {
      s.stage1 = { status: "UNKNOWN", public_status: "UNKNOWN", committed, reason: "DONE; checks PASS",
        runs_exit0: 15, runs_expected: 15, checks: { stage_check: "PASS", integrity: "PASS" } };
      s.stage2 = { status: "UNKNOWN", public_status: "UNKNOWN", committed, reason: "DONE; checks PASS",
        construction_gate: { verdict: "PASS", family: { alpha: 0.05 } },
        phases: [{ mode: "full", status: "PASS" }], attempts: [{ attempt: 2, construction: "PASS" }] };
    });
    assert.equal(v.trusted, true);
    assert.deepEqual(v.stages.map((s) => s.verified), [false, false]);
    assert.equal(v.gate.status, "UNKNOWN");
    assert.equal(hasPass({ stages: v.stages, gate: v.gate, phases: v.phases, attempts: v.attempts, milestone: v.milestone }), false,
      `committed ${String(committed)}`);
  }
});

test("a stage with no status fields, or a published verdict without committed receipts, is UNKNOWN with no detail", () => {
  const bare = view((s) => { s.stage1 = { committed: true, checks: { stage_check: "PASS" }, reason: "checks PASS" }; });
  assert.equal(bare.stages[0].status, "UNKNOWN");
  assert.equal(bare.stages[0].verified, false);
  assert.equal(hasPass(bare.stages[0]), false);
  const uncommitted = view((s) => { s.stage1.committed = false; });
  assert.equal(uncommitted.stages[0].status, "UNKNOWN");
  assert.equal(uncommitted.milestone, null);
  assert.equal(hasPass({ stage: uncommitted.stages[0], milestone: uncommitted.milestone }), false);
});

test("a source sha that is not a string, and a staleness limit that is not a positive number, are not accepted", () => {
  assert.equal(view((s) => { s.source.sha = [SHA]; }).trusted, false);
  const stale = (s) => { s.generated_utc = "2026-10-01T00:00:00Z"; };
  for (const limit of [NaN, Infinity, 0, -1]) {
    assert.equal(view(stale, NOW, limit).trusted, false, `limit ${limit}`);
  }
});

test("a local PASS that is not the public status is UNKNOWN, with no detail", () => {
  const v = view((s) => {
    s.stage2.status = "PASS"; s.stage2.public_status = "UNKNOWN"; s.stage2.reason = "DONE; checks PASS";
    s.stage2.checks = { stage_check: "PASS" }; s.stage2.runs_exit0 = 30;
    s.stage2.construction_gate = { verdict: "PASS", family: { alpha: 0.05 } };
    s.stage2.phases = [{ mode: "full", status: "PASS" }];
    s.stage2.attempts = [{ attempt: 2, construction: "PASS" }];
  });
  const stage2 = v.stages[1];
  assert.equal(stage2.status, "UNKNOWN");
  assert.equal(stage2.reason, null);
  assert.deepEqual(stage2.checks, []);
  assert.equal(stage2.runs_exit0, null);
  assert.equal(v.gate.status, "UNKNOWN");
  assert.equal(v.gate.family, null);
  assert.deepEqual(v.phases, []);
  assert.deepEqual(v.attempts, []);
  assert.equal(hasPass({ stage2, gate: v.gate, phases: v.phases, attempts: v.attempts }), false);
});

test("the milestone is shown only with the receipt of a stage shown as PASS", () => {
  const text = "stage 1 positive controls: 15/15 runs";
  assert.equal(view().milestone, text);
  for (const status of ["FAIL", "RUNNING", "BLOCKED", "UNKNOWN"]) {
    const v = view((s) => { s.stage1.status = status; s.stage1.public_status = status; });
    assert.equal(v.milestone, null, `stage 1 ${status}`);
  }
  assert.equal(view((s) => { s.stage1.public_status = "UNKNOWN"; }).milestone, null, "local-only PASS");
  assert.equal(view((s) => { s.latest_verified_milestone.evidence = "docs/other.md"; }).milestone, null, "other evidence");
  assert.equal(view((s) => { delete s.evidence.stage1_receipt; }).milestone, null, "no receipt path");
  // Stage 2 passed, stage 1 did not: a stage-1 milestone is not carried by the stage-2 PASS.
  const crossed = view((s) => {
    s.stage1.status = "FAIL"; s.stage1.public_status = "FAIL";
    s.stage2.status = "PASS"; s.stage2.public_status = "PASS"; s.stage2.committed = true; s.stage2.runs_exit0 = 30;
    s.evidence.stage2_receipt = { path: "docs/laminar_motif/S2.md" };
  });
  assert.equal(crossed.stages[1].status, "PASS");
  assert.equal(crossed.milestone, null);
  const stage2 = view((s) => {
    s.stage2.status = "PASS"; s.stage2.public_status = "PASS"; s.stage2.committed = true; s.stage2.runs_exit0 = 30;
    s.evidence.stage2_receipt = { path: "docs/laminar_motif/S2.md" };
    s.latest_verified_milestone = { what: "stage 2: 30/30 runs", evidence: "docs/laminar_motif/S2.md" };
  });
  assert.equal(stage2.milestone, "stage 2: 30/30 runs");
});

test("a local RUNNING is never shown as repository-verified", () => {
  const v = view((s) => { s.stage2.status = "RUNNING"; s.stage2.public_status = "UNKNOWN"; });
  assert.equal(v.stages[1].status, "UNKNOWN");
});

test("gate verdict is shown only with a verified stage 2", () => {
  const ok = view((s) => { s.stage2.status = "PASS"; s.stage2.public_status = "PASS"; s.stage2.committed = true; s.stage2.runs_exit0 = 30; s.stage2.construction_gate = { verdict: "PASS", family: { alpha: 0.05, n_tests: 780 } }; });
  assert.equal(ok.gate.status, "PASS");
  assert.equal(ok.gate.family.n_tests, 780);
  const fail = view((s) => { s.stage2.status = "FAIL"; s.stage2.public_status = "FAIL"; s.stage2.committed = true; s.stage2.construction_gate = { verdict: "FAIL", family: null }; });
  assert.equal(fail.gate.status, "FAIL");
});

// Every way a snapshot can be untrustworthy: all statuses UNKNOWN, no milestone, no "PASS" anywhere in the view.
const UNTRUSTED = {
  "stale evidence (older than the limit)": [(s) => { s.generated_utc = "2026-11-10T18:59:59Z"; }, "stale"],
  "generation time in the future": [(s) => { s.generated_utc = "2026-11-17T19:05:01Z"; }, "future"],
  "no generation time": [(s) => { delete s.generated_utc; }, "generation time"],
  "unparseable generation time": [(s) => { s.generated_utc = "yesterday"; }, "generation time"],
  "uncommitted source tree": [(s) => { s.source.dirty_tracked = true; }, "uncommitted"],
  "dirty flag missing": [(s) => { delete s.source.dirty_tracked; }, "uncommitted"],
  "no source commit": [(s) => { delete s.source.sha; }, "source commit"],
  "short source commit": [(s) => { s.source.sha = "c9b9224"; }, "source commit"],
  "no source block": [(s) => { delete s.source; }, "source commit"],
  "another schema": [(s) => { s.schema = "o38s_status/2"; }, "schema"]
};
for (const [name, [change, word]] of Object.entries(UNTRUSTED)) {
  test(`untrusted snapshot: ${name}`, () => {
    const s = snapshot((x) => {
      x.stage2.status = "PASS"; x.stage2.public_status = "PASS";
      x.stage2.construction_gate = { verdict: "PASS", family: null };
      x.tests.status = "PASS"; x.tests.passed = 53;
      change(x);
    });
    assert.equal(s.stage1.public_status, "PASS", "fixture must carry a PASS to hide");
    const v = V.view(s, NOW);
    assert.equal(v.trusted, false);
    assert.ok(v.why_unknown.some((w) => w.includes(word)), `${v.why_unknown}`);
    assert.deepEqual(v.stages.map((st) => st.status), ["UNKNOWN", "UNKNOWN"]);
    assert.equal(v.gate.status, "UNKNOWN");
    assert.equal(v.tests.status, "UNKNOWN");
    assert.equal(v.milestone, null);
    assert.equal(v.current_stage, null);
    assert.deepEqual(v.links, []);
    assert.equal(hasPass(v), false);
  });
}

test("the staleness limit is a boundary: just inside is trusted, just outside is not", () => {
  const generated = Date.parse("2026-11-17T18:30:34Z");
  const limit = V.MAX_AGE_HOURS * 3600 * 1000;
  assert.equal(view(null, generated + limit).trusted, true);
  assert.equal(view(null, generated + limit + 1).trusted, false);
  assert.equal(view(null, NOW, 0.25).trusted, false);  // 28 minutes old against a 15 minute limit
  assert.equal(view(null, NaN).trusted, false);
});

for (const [name, value] of Object.entries({ null: null, undefined: undefined, string: "PASS", array: ["PASS"], number: 1 })) {
  test(`no snapshot (${name}) is UNKNOWN`, () => {
    const v = V.view(value, NOW);
    assert.equal(v.trusted, false);
    assert.deepEqual(v.stages.map((s) => s.status), ["UNKNOWN", "UNKNOWN"]);
    assert.equal(hasPass(v), false);
  });
}

for (const bad of ["pass", "PASS ", "Pass", "PASSED", "OK", "", null, 1, true, ["PASS"], { status: "PASS" }]) {
  test(`a status that is not one of the five (${JSON.stringify(bad)}) is UNKNOWN`, () => {
    const v = view((s) => { s.stage1.public_status = bad; s.stage1.status = bad; s.tests.status = bad; });
    assert.equal(v.stages[0].status, "UNKNOWN");
    assert.equal(v.tests.status, "UNKNOWN");
  });
}

test("missing stage blocks are UNKNOWN", () => {
  const v = view((s) => { delete s.stage1; delete s.stage2; delete s.tests; });
  assert.deepEqual(v.stages.map((s) => s.status), ["UNKNOWN", "UNKNOWN"]);
  assert.equal(v.gate.status, "UNKNOWN");
  assert.equal(v.tests.status, "UNKNOWN");
});

test("evidence links point at the source commit, and unsafe paths or hosts are dropped", () => {
  const v = view();
  assert.deepEqual(v.links.map((l) => l.url), [
    `https://github.com/HNXJ/jomission/blob/${SHA}/docs/laminar_motif/SPEC.md`,
    `https://github.com/HNXJ/jomission/blob/${SHA}/docs/laminar_motif/S1.md`
  ]);
  assert.equal(v.links[0].label, "Specification");
  assert.deepEqual(view((s) => { s.source.repo_url = "javascript:alert(1)"; }).links, []);
  assert.deepEqual(view((s) => { s.source.repo_url = "https://example.org/x"; }).links, []);
  const unsafe = view((s) => { s.evidence = { a: { path: "../secret" }, b: { path: "/abs" }, c: { path: "x y" }, d: { path: 'x"y' }, e: {} }; });
  assert.deepEqual(unsafe.links, []);
});

test("a blocker is shown only as the generator's line for a stage shown as BLOCKED or FAIL", () => {
  const blocked = (s) => {
    s.stage2 = { status: "BLOCKED", public_status: "BLOCKED", committed: true, reason: "construction gate ruling pending" };
    s.blockers = ["stage 2: construction gate ruling pending"];
  };
  const v = view(blocked);
  assert.deepEqual(v.blockers, ["stage 2: construction gate ruling pending"]);
  assert.equal(v.blockers_known, true);
  assert.equal(view().blockers_known, true, "an empty list is known");
  // The generator builds blockers from the local status: a stage that is not committed must not leak its reason.
  const local = view((s) => {
    s.stage2 = { status: "BLOCKED", public_status: "UNKNOWN", committed: false, reason: "smoke PASS; rest phase not launched" };
    s.blockers = ["stage 2: smoke PASS; rest phase not launched"];
  });
  assert.deepEqual(local.blockers, []);
  assert.equal(local.blockers_known, false);
  assert.equal(hasPass({ b: local.blockers, s: local.stages[1] }), false);
  const other = view((s) => { blocked(s); s.blockers.push("all stages PASS"); });
  assert.deepEqual(other.blockers, ["stage 2: construction gate ruling pending"]);
  assert.equal(other.blockers_known, false);
  const stale = view((s) => { blocked(s); s.source.dirty_tracked = true; });
  assert.deepEqual(stale.blockers, []);
  assert.equal(stale.blockers_known, false);
});

// Committed receipts with both statuses UNKNOWN (e.g. an integrity receipt that reads UNKNOWN): no verdict is
// shown, so no detail is either.
test("a committed stage whose verdict is UNKNOWN shows no detail and no gate verdict", () => {
  const v = view((s) => {
    s.stage1 = { status: "UNKNOWN", public_status: "UNKNOWN", committed: true, reason: "DONE; checks PASS",
      runs_exit0: 15, runs_expected: 15, checks: { stage_check: "PASS" } };
    s.stage2 = { status: "UNKNOWN", public_status: "UNKNOWN", committed: true, reason: "checks PASS",
      construction_gate: { verdict: "PASS", family: { ruling: "PASS" } },
      phases: [{ mode: "smoke", status: "PASS" }], attempts: [{ construction: "PASS" }] };
  });
  assert.equal(v.trusted, true);
  assert.deepEqual(v.stages.map((s) => s.verified), [false, false]);
  assert.equal(v.gate.status, "UNKNOWN");
  assert.equal(hasPass(v), false);
});

test("a published PASS that the stage's own fields contradict is UNKNOWN", () => {
  for (const [name, change] of Object.entries({
    "a check that is not PASS": (s) => { s.stage1.checks.integrity = "FAIL"; },
    "runs that did not all exit 0": (s) => { s.stage1.runs_exit0 = 3; },
    "a failed consistency block": (s) => { s.stage1.consistency = { ok: false }; },
  })) {
    const v = view(change);
    assert.equal(v.stages[0].status, "UNKNOWN", name);
    assert.equal(v.milestone, null, name);
    assert.equal(hasPass(v), false, name);
  }
});

const stage2Pass = (s) => {
  s.stage2 = { status: "PASS", public_status: "PASS", committed: true, reason: "rest DONE; integrity PASS",
    runs_exit0: 30, runs_expected: 30, construction_gate: { verdict: "PASS", family: { alpha: 0.05, note: "x PASS" } },
    phases: [{ mode: "smoke", status: "PASS", extra: "y PASS" }, { mode: "rest", status: "PASS" }], attempts: [] };
  s.evidence.stage2_receipt = { path: "docs/laminar_motif/S2.md" };
};

test("a published stage-2 PASS with a failed phase, a failed gate or missing run counts is UNKNOWN", () => {
  assert.equal(view(stage2Pass).stages[1].status, "PASS");
  for (const [name, change] of Object.entries({
    "a failed phase": (s) => { s.stage2.phases[0].status = "FAIL"; },
    "a failed gate": (s) => { s.stage2.construction_gate.verdict = "FAIL"; },
    "no run count": (s) => { delete s.stage2.runs_exit0; },
    "a run count that is a string": (s) => { s.stage2.runs_exit0 = "30"; },
    "no expected count": (s) => { delete s.stage2.runs_expected; },
  })) {
    const v = view((s) => { stage2Pass(s); change(s); });
    assert.equal(v.stages[1].status, "UNKNOWN", name);
    assert.equal(v.gate.status, "UNKNOWN", name);
    assert.deepEqual(v.phases, [], name);
  }
});

test("records carry the contract's keys only, and the gate family numbers only", () => {
  const v = view(stage2Pass);
  assert.deepEqual(v.phases, [{ mode: "smoke", status: "PASS" }, { mode: "rest", status: "PASS" }]);
  assert.deepEqual(v.gate.family, { alpha: 0.05 });
});

test("the milestone text must name the stage whose receipt it cites", () => {
  const crossed = view((s) => { s.latest_verified_milestone.what = "stage 2: 30/30 runs, integrity PASS"; });
  assert.equal(crossed.stages[1].status, "UNKNOWN");
  assert.equal(crossed.milestone, null);
  assert.equal(view((s) => { s.latest_verified_milestone.what = "stage 12 PASS"; }).milestone, null);
  assert.equal(view((s) => { s.latest_verified_milestone.what = "all stages PASS"; }).milestone, null);
});

test("provenance shows a 40-hex commit and the generator's exact time format, nothing else", () => {
  const v = view((s) => { s.generated_utc = "2026-11-17T18:30:34Z (Stage 2 PASS)"; s.source.branch = "Stage 2 PASS"; });
  assert.equal(v.trusted, false);
  assert.equal(v.provenance.generated_utc, null);
  assert.equal(hasPass(v), false);
  assert.deepEqual(Object.keys(view().provenance).sort(), ["generated_utc", "sha"]);
  assert.equal(view((s) => { s.generated_utc = "2026-11-17"; }).trusted, false, "date only");
});

test("evidence links use known keys only, and a tests PASS needs passed > 0 and failed 0", () => {
  const v = view((s) => { s.evidence["Stage 2 PASS"] = { path: "a.md" }; });
  assert.deepEqual(v.links.map((l) => l.label), ["Specification", "Stage 1 receipt"]);
  const t = view((s) => { s.tests = { status: "PASS", public_status: "PASS", passed: 0, failed: 9, defined: 9 }; });
  assert.equal(t.tests.status, "UNKNOWN");
});

test("free text outside a shown verdict is not carried: objective, current stage, test reason, project name", () => {
  const untrusted = view((s) => { s.source.dirty_tracked = true; s.project.objective = "all stages PASS"; });
  assert.equal(untrusted.objective, null);
  const v = view((s) => {
    s.project.name = "PASS"; s.current_stage = "stage 2 PASS"; s.tests.status = "PASS"; s.tests.reason = "all PASS";
  });
  assert.equal(v.name, "Jomission / LANSA (OPEN-38)");
  assert.equal(v.current_stage, null);
  assert.equal(v.tests.reason, null);
  assert.equal(view().current_stage, "stage 1");
  assert.equal(view().objective, "objective text");
});
