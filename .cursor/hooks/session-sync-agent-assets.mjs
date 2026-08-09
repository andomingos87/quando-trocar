#!/usr/bin/env node
/**
 * Cursor sessionStart hook: reconcile all agent asset mirrors once per session.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SYNC_SCRIPT = resolve(ROOT, "scripts/sync-agent-assets.mjs");

const result = spawnSync(process.execPath, [SYNC_SCRIPT], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, SYNC_AGENT_ASSETS_RUNNING: "1" },
});

if (result.status !== 0) {
  process.stderr.write(
    `[sync-agent-assets] session sync failed: ${result.stderr || result.stdout || "unknown error"}\n`,
  );
}

process.stdout.write("{}\n");
