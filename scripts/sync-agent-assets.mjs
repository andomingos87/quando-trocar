#!/usr/bin/env node
/**
 * Keeps agent skills and prompt briefs in sync across Cursor, Claude Code and Codex paths.
 *
 * Skills:  .cursor/skills/<name>/SKILL.md
 *           .claude/skills/<name>/SKILL.md
 *           .agents/skills/<name>/SKILL.md
 *
 * Prompts: .cursor/prompts/*.md
 *           .codex/prompts/*.md
 *
 * Usage:
 *   node scripts/sync-agent-assets.mjs           # reconcile all groups (newest wins)
 *   node scripts/sync-agent-assets.mjs --from <path>  # propagate one edited file
 */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKILL_DIRS = [
  ".cursor/skills",
  ".claude/skills",
  ".agents/skills",
];

const PROMPT_DIRS = [".cursor/prompts", ".codex/prompts"];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeIfChanged(destPath, content) {
  const current = readIfExists(destPath);
  if (current === content) {
    return false;
  }
  ensureDir(dirname(destPath));
  writeFileSync(destPath, content, "utf8");
  return true;
}

function listSkillRelPaths() {
  const relPaths = new Set();
  for (const dir of SKILL_DIRS) {
    const absDir = join(ROOT, dir);
    if (!existsSync(absDir)) continue;
    for (const name of readdirSync(absDir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const skillPath = join(absDir, name.name, "SKILL.md");
      if (existsSync(skillPath)) {
        relPaths.add(`${name.name}/SKILL.md`);
      }
    }
  }
  return [...relPaths].sort();
}

function listPromptRelPaths() {
  const relPaths = new Set();
  for (const dir of PROMPT_DIRS) {
    const absDir = join(ROOT, dir);
    if (!existsSync(absDir)) continue;
    for (const name of readdirSync(absDir, { withFileTypes: true })) {
      if (!name.isFile() || !name.name.endsWith(".md")) continue;
      relPaths.add(name.name);
    }
  }
  return [...relPaths].sort();
}

function absPathsForSkill(relPath) {
  return SKILL_DIRS.map((dir) => join(ROOT, dir, relPath));
}

function absPathsForPrompt(relPath) {
  return PROMPT_DIRS.map((dir) => join(ROOT, dir, relPath));
}

function pickCanonical(paths) {
  const existing = paths
    .filter((path) => existsSync(path))
    .map((path) => ({
      path,
      mtimeMs: statSync(path).mtimeMs,
      content: readFileSync(path, "utf8"),
    }));

  if (existing.length === 0) {
    return null;
  }

  existing.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return existing[0];
}

function syncRelPaths(relPaths, toAbsPaths) {
  const report = { copied: 0, skipped: 0, groups: relPaths.length };

  for (const relPath of relPaths) {
    const canonical = pickCanonical(toAbsPaths(relPath));
    if (!canonical) continue;

    for (const dest of toAbsPaths(relPath)) {
      if (writeIfChanged(dest, canonical.content)) {
        report.copied += 1;
      } else {
        report.skipped += 1;
      }
    }
  }

  return report;
}

function detectGroup(absPath) {
  const rel = relative(ROOT, absPath).replaceAll("\\", "/");

  if (/^\.(?:cursor|claude|agents)\/skills\/[^/]+\/SKILL\.md$/.test(rel)) {
    return { kind: "skill", relPath: rel.split("/").slice(-2).join("/") };
  }

  if (/^\.(?:cursor|codex)\/prompts\/[^/]+\.md$/.test(rel)) {
    return { kind: "prompt", relPath: rel.split("/").pop() };
  }

  return null;
}

function syncFromEditedFile(absPath) {
  const group = detectGroup(absPath);
  if (!group) {
    return { ok: true, ignored: true, reason: "not a synced agent asset" };
  }

  if (!existsSync(absPath)) {
    return { ok: true, ignored: true, reason: "source missing" };
  }

  const content = readFileSync(absPath, "utf8");
  const targets =
    group.kind === "skill"
      ? absPathsForSkill(group.relPath)
      : absPathsForPrompt(group.relPath);

  let copied = 0;
  let skipped = 0;

  for (const dest of targets) {
    if (resolve(dest) === resolve(absPath)) {
      skipped += 1;
      continue;
    }
    if (writeIfChanged(dest, content)) {
      copied += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    ok: true,
    ignored: false,
    kind: group.kind,
    relPath: group.relPath,
    copied,
    skipped,
  };
}

function syncAll() {
  const skillReport = syncRelPaths(listSkillRelPaths(), absPathsForSkill);
  const promptReport = syncRelPaths(listPromptRelPaths(), absPathsForPrompt);

  return {
    ok: true,
    skills: skillReport,
    prompts: promptReport,
  };
}

function parseArgs(argv) {
  const fromIndex = argv.indexOf("--from");
  if (fromIndex === -1) {
    return { mode: "all" };
  }

  const fromPath = argv[fromIndex + 1];
  if (!fromPath) {
    throw new Error("Missing value for --from");
  }

  return {
    mode: "from",
    fromPath: resolve(fromPath.startsWith("/") ? fromPath : join(process.cwd(), fromPath)),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result =
    args.mode === "from" ? syncFromEditedFile(args.fromPath) : syncAll();

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
