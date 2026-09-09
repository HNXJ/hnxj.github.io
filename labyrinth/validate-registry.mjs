#!/usr/bin/env node
/**
 * Validates labyrinth/registry.json against registry.schema.json and deployment policy.
 * Exit 0 on pass, 1 on failure.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(root, "registry.fallback.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(root, "registry.schema.json"), "utf8"));

const STATUSES = new Set(schema.definitions.status.enum);
const KINDS = new Set(schema.definitions.kind.enum);
const FORBIDDEN_HOST = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\.local\b/i;
const FORBIDDEN_HREF = /^(http:\/\/|https?:\/\/(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|localhost|0\.0\.0\.0|\[::1\]))/i;

function fail(msg) {
  console.error("REGISTRY VALIDATION FAILED:", msg);
  process.exit(1);
}

if (registry.schemaVersion !== schema.properties.schemaVersion.const) {
  fail(`schemaVersion must be ${schema.properties.schemaVersion.const}`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.updated)) fail("updated must be YYYY-MM-DD");
if (!Array.isArray(registry.apps) || registry.apps.length === 0) fail("apps must be non-empty array");

const ids = new Set();
for (const app of registry.apps) {
  if (ids.has(app.id)) fail(`duplicate id: ${app.id}`);
  ids.add(app.id);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(app.id)) fail(`invalid id: ${app.id}`);
  if (!STATUSES.has(app.status)) fail(`invalid status for ${app.id}`);
  if (!KINDS.has(app.kind)) fail(`invalid kind for ${app.id}`);
  if (!app.reason) fail(`${app.id} missing reason`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(app.updated)) fail(`${app.id} updated must be YYYY-MM-DD`);
  if (["live", "fixture", "degraded", "archived"].includes(app.status) && !app.href) {
    fail(`${app.id} requires href for status ${app.status}`);
  }
  if (app.href) {
    if (!app.href.startsWith("https://")) fail(`${app.id} href must be public HTTPS`);
    if (FORBIDDEN_HOST.test(app.href)) fail(`${app.id} href contains forbidden host`);
    if (FORBIDDEN_HREF.test(app.href)) fail(`${app.id} href points to private/local destination`);
  }
  if (app.image && !app.image.startsWith("https://") && !app.image.startsWith("../")) {
    fail(`${app.id} image must be HTTPS or renderer-relative`);
  }
}

console.log(`REGISTRY OK: ${registry.apps.length} apps, updated ${registry.updated}`);
process.exit(0);
