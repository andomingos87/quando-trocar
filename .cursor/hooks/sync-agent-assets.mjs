#!/usr/bin/env node
/**
 * Cursor hook: propagate agent asset edits across .cursor, .claude, .codex and .agents.
 * Fail open — never block the agent on sync errors.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SYNC_SCRIPT = resolve(ROOT, "scripts/sync-agent-assets.mjs");

function readStdin() {
  return new Promise((resolvePromise) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolvePromise(data));
  });
}

function extractEditedPath(input) {
  const candidates = [
    input.file_path,
    input.filePath,
    input.path,
    input.file,
  ].filter(Boolean);

  if (candidates.length > 0) {
    return candidates[0];
  }

  if (Array.isArray(input.edits) && input.edits[0]?.path) {
    return input.edits[0].path;
  }

  return null;
}

async function main() {
  if (process.env.SYNC_AGENT_ASSETS_RUNNING === "1") {
    process.stdout.write("{}\n");
    return;
  }

  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const editedPath = extractEditedPath(input);

    if (!editedPath) {
      process.stdout.write("{}\n");
      return;
    }

    const result = spawnSync(
      process.execPath,
      [SYNC_SCRIPT, "--from", editedPath],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, SYNC_AGENT_ASSETS_RUNNING: "1" },
      },
    );

    if (result.status !== 0) {
      process.stderr.write(
        `[sync-agent-assets] sync failed: ${result.stderr || result.stdout || "unknown error"}\n`,
      );
      process.stdout.write("{}\n");
      return;
    }

    let payload = {};
    try {
      payload = JSON.parse((result.stdout || "").trim() || "{}");
    } catch {
      payload = {};
    }

    if (payload.copied > 0) {
      process.stdout.write(
        JSON.stringify({
          additional_context:
            "Agent assets synced across .cursor, .claude, .codex and .agents after this edit.",
        }) + "\n",
      );
      return;
    }

    process.stdout.write("{}\n");
  } catch (error) {
    process.stderr.write(
      `[sync-agent-assets] hook error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.stdout.write("{}\n");
  }
}

main();
