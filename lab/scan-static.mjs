#!/usr/bin/env node
/**
 * Static observation-plane scan for lab/ — no secrets, localhost, or mutation handlers.
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
  if (LOCAL.test(text)) {
    console.error(`SCAN FAIL ${file}: localhost/private endpoint reference`);
    failed = true;
  }
  if (file.endsWith(".html") && MUTATION.test(text)) {
    console.error(`SCAN FAIL ${file}: mutation handler detected`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`STATIC SCAN OK: ${files.length} lab files`);
process.exit(0);
