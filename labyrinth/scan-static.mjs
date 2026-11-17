#!/usr/bin/env node
/**
 * Static observation-plane scan for labyrinth/ — no secrets, localhost, or mutation handlers.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(root).filter((f) => /\.(html|css|js|json)$/.test(f) && !f.endsWith(".schema.json"));

const SECRET = /(api[_-]?key|secret|password|token|sk-[A-Za-z0-9_-]{10,})/i;
const LOCAL = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)\b/i;
const MUTATION = /\bon(click|submit|change)\s*=|addEventListener\s*\(\s*['"](click|submit)['"]/i;

let failed = false;
for (const file of files) {
  const text = readFileSync(join(root, file), "utf8");
  if (SECRET.test(text)) {
    console.error(`SCAN FAIL ${file}: possible secret pattern`);
    failed = true;
  }
  if (LOCAL.test(text)) {
    console.error(`SCAN FAIL ${file}: localhost/private endpoint reference`);
    failed = true;
  }
  if (file.endsWith(".html") && MUTATION.test(text)) {
    console.error(`SCAN FAIL ${file}: mutation handler detected`);
    failed = true;
  }
}

// labyrinth/jchat/ is the one public page that signs in to a hub (AGENTS.md, "Single exception"). Its own rules:
// no literal secret values, URL literals name only loopback hosts, and no innerHTML or outerHTML writes.
const jchatDir = join(root, "jchat");
const jchatFiles = readdirSync(jchatDir).filter((f) => /\.(html|css|js)$/.test(f));
const HEX48 = /(?<![0-9a-fA-F])[0-9a-fA-F]{48,}(?![0-9a-fA-F])/;
const SK_KEY = /\bsk-[A-Za-z0-9_-]{10,}/;
const BEARER_VALUE = /Bearer\s+[A-Za-z0-9._~+\/-]{16,}/;
const URL_AUTHORITY = /\b(?:https?|wss?):\/\/([^\/\s"'`<>\\?#]+)/gi;
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost)$/i;
const INNER_HTML = /\.(?:innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(/;

for (const file of jchatFiles) {
  const text = readFileSync(join(jchatDir, file), "utf8");
  if (HEX48.test(text) || SK_KEY.test(text) || BEARER_VALUE.test(text)) {
    console.error(`SCAN FAIL jchat/${file}: literal secret value`);
    failed = true;
  }
  for (const m of text.matchAll(URL_AUTHORITY)) {
    const host = m[1].split("@").pop().replace(/:(\d+|\*)$/, "");
    if (!LOOPBACK_HOST.test(host)) {
      console.error(`SCAN FAIL jchat/${file}: URL literal names a host other than 127.0.0.1 or localhost`);
      failed = true;
      break;
    }
  }
  if (INNER_HTML.test(text)) {
    console.error(`SCAN FAIL jchat/${file}: innerHTML or outerHTML write (message text is inserted as text)`);
    failed = true;
  }
}

// The Jomission/LANSA (OPEN-38) status page, its scripts and its committed snapshot: render-only, so the
// labyrinth rules apply, plus no network call and no markup write.
const o38sFiles = ["o38s/index.html", "../assets/o38s_view.js", "../assets/o38s_card.js", "../data/o38s/status.json"];
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bimport\s*\(/;
for (const file of o38sFiles) {
  const text = readFileSync(join(root, file), "utf8");
  const found = [
    [SECRET, "possible secret pattern"],
    [LOCAL, "localhost/private endpoint reference"],
    [MUTATION, "mutation handler detected"],
    [NETWORK, "network call"],
    [INNER_HTML, "markup write (status text is inserted as text)"]
  ].filter(([pattern]) => pattern.test(text));
  for (const [, what] of found) {
    console.error(`SCAN FAIL ${file}: ${what}`);
    failed = true;
  }
}

// The status artifact is built by the regeneration gate, never committed, and nothing committed may define it:
// a committed artifact or an inline definition would be shown without the gate. A name assembled at run time
// escapes this scan; review of the default branch is the control for that.
const repo = join(root, "..");
const ARTIFACT_FILE = "assets/data/o38s_status.js";
const MAY_NAME_ARTIFACT = /^(assets\/o38s_(view|card)\.js|labyrinth\/scan-static\.mjs)$/;
let tracked = null;
try {
  tracked = execFileSync("git", ["-C", repo, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
} catch (err) {
  console.error("SCAN FAIL: the tracked files are unreadable (git ls-files), so the artifact rule is unchecked");
  failed = true;
}
for (const file of tracked || []) {
  if (file === ARTIFACT_FILE) {
    console.error(`SCAN FAIL ${file}: the status artifact is committed (it is built by the gate only)`);
    failed = true;
  } else if (/\.(x?html?|[cm]?js|svg)$/.test(file) && !MAY_NAME_ARTIFACT.test(file) && existsSync(join(repo, file)) &&
             /O38S_ARTIFACT/.test(readFileSync(join(repo, file), "utf8"))) {
    console.error(`SCAN FAIL ${file}: names O38S_ARTIFACT (only the built artifact defines it)`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`STATIC SCAN OK: ${files.length} labyrinth files, ${jchatFiles.length} jchat files, ${o38sFiles.length} o38s files`);
process.exit(0);
