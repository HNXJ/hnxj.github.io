#!/usr/bin/env node
/**
 * Static observation-plane scan for labyrinth/ — no secrets, localhost, or mutation handlers.
 */
import { readFileSync, readdirSync } from "node:fs";
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
  if (file !== "labyrinth.js" && LOCAL.test(text)) {
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

if (failed) process.exit(1);
console.log(`STATIC SCAN OK: ${files.length} labyrinth files, ${jchatFiles.length} jchat files`);
process.exit(0);
