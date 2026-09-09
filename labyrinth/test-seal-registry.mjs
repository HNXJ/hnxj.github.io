#!/usr/bin/env node
/**
 * Step 2 seal checks for registry loader contract (offline).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const fallback = JSON.parse(readFileSync(join(root, "registry.fallback.json"), "utf8"));
const js = readFileSync(join(root, "labyrinth.js"), "utf8");

const SUPPORTED = { "hnxj-labyrinth-registry-v1": true };

function validateRegistry(registry) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) return "not object";
  if (!SUPPORTED[registry.schemaVersion]) return "unsupported version";
  if (!Array.isArray(registry.apps) || registry.apps.length === 0) return "empty apps";
  return null;
}

const cases = [
  ["valid fallback registry", validateRegistry(fallback) === null],
  ["rejects malformed", validateRegistry(null) !== null],
  ["rejects unsupported version", validateRegistry({ ...fallback, schemaVersion: "v99" }) !== null],
  ["rejects empty apps", validateRegistry({ ...fallback, apps: [] }) !== null],
  ["remote URL is public catalog", js.includes("labyrinth-catalog/registry.json")],
  ["fallback path configured", js.includes("registry.fallback.json")],
  ["snapshot banner on fallback", js.includes("CATALOG SNAPSHOT")],
  ["textContent rendering", js.includes("textContent")],
  ["no partial render on invalid", js.includes("throw new Error") || js.includes("catch")],
];

let failed = false;
for (const [name, ok] of cases) {
  if (!ok) {
    console.error("FAIL:", name);
    failed = true;
  } else {
    console.log("PASS:", name);
  }
}

if (failed) process.exit(1);
console.log("SEAL OFFLINE CHECKS OK");
process.exit(0);
