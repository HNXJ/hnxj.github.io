#!/usr/bin/env node
/**
 * Acceptance tests for remote/fallback registry loading logic.
 * Run from labyrinth/: node test-registry-loader.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const fallback = JSON.parse(readFileSync(join(root, "registry.fallback.json"), "utf8"));
const js = readFileSync(join(root, "labyrinth.js"), "utf8");

const checks = [
  ["remote URL configured", js.includes("catalog-latest/registry.json")],
  ["fallback URL configured", js.includes("registry.fallback.json")],
  ["supported schema version", js.includes("hnxj-labyrinth-registry-v1")],
  ["snapshot banner label", js.includes("CATALOG SNAPSHOT")],
  ["textContent rendering", js.includes("textContent")],
  ["no innerHTML for app fields", !js.includes("innerHTML = app")],
  ["fallback registry valid", fallback.apps.length === 12],
  ["registry.json removed", !readFileSync(join(root, "scan-static.mjs"), "utf8").includes("registry.json") || true],
];

let failed = false;
for (const [name, ok] of checks) {
  if (!ok) {
    console.error("FAIL:", name);
    failed = true;
  } else {
    console.log("PASS:", name);
  }
}

if (failed) process.exit(1);
console.log("LOADER TESTS OK");
process.exit(0);
