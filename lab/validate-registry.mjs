#!/usr/bin/env node
/**
 * Legacy lab validator — delegates to labyrinth/registry.json (canonical).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(root, "../labyrinth/validate-registry.mjs")], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
