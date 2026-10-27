#!/usr/bin/env node
/**
 * Copies the API contract from a euron-open-ai-chat checkout into src/api/vendor:
 *   packages/types/src/*.ts            -> src/api/vendor/types/
 *   packages/api-client/src/**\/*.ts    -> src/api/vendor/client/
 * The client is copied whole and unchanged (only the `@open-chat/types` import is pointed
 * at the vendored copy): it has no DOM dependencies and already speaks native token mode
 * and streams over XMLHttpRequest, so the app uses it as is. The admin endpoint group
 * comes along unused; copying everything keeps the drift check exact.
 *
 *   node scripts/sync-types.mjs [path-to-euron-open-ai-chat]          copy
 *   node scripts/sync-types.mjs --check [path-to-euron-open-ai-chat]  fail if anything differs
 *
 * The server checkout defaults to ../euron-open-ai-chat. The commit it was copied from is
 * written to src/api/vendor/SOURCE so a reviewer can see which server version the app targets.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const server = resolve(args.find((a) => !a.startsWith("--")) ?? join(root, "..", "euron-open-ai-chat"));
const out = join(root, "src/api/vendor");

if (!existsSync(join(server, "packages/types/src"))) {
  console.error(`euron-open-ai-chat not found at ${server}. Pass its path: node scripts/sync-types.mjs <path>`);
  // In CI without the server checkout the check is skipped, not failed.
  process.exit(check ? 0 : 1);
}

const HEADER = "// Copied from euron-open-ai-chat by scripts/sync-types.mjs. Do not edit: change it there and run `pnpm sync-types`.\n";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name.endsWith(".ts") ? [p] : [];
  });
}

/** Points the types package import at the vendored copy, `depth` folders up from client/. */
function rewrite(src, depth) {
  return HEADER + src.replace(/from "@open-chat\/types"/g, `from "${"../".repeat(depth)}types"`);
}

const files = new Map();
const typesDir = join(server, "packages/types/src");
for (const f of walk(typesDir)) files.set(`types/${relative(typesDir, f)}`, rewrite(readFileSync(f, "utf8"), 0));
const clientDir = join(server, "packages/api-client/src");
for (const f of walk(clientDir)) {
  const rel = relative(clientDir, f);
  files.set(`client/${rel}`, rewrite(readFileSync(f, "utf8"), rel.split("/").length));
}

let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", server, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["-C", server, "status", "--porcelain", "packages/types", "packages/api-client"], { encoding: "utf8" }).trim();
  if (dirty) commit += " (with uncommitted changes)";
} catch {
  /* not a git checkout */
}

if (check) {
  const drift = [];
  for (const [rel, content] of files) {
    const p = join(out, rel);
    if (!existsSync(p) || readFileSync(p, "utf8") !== content) drift.push(rel);
  }
  if (drift.length) {
    console.error(`API contract drift against ${server}:\n  ${drift.join("\n  ")}\nRun: pnpm sync-types`);
    process.exit(1);
  }
  console.log(`api contract: in sync with euron-open-ai-chat ${commit} (${files.size} files)`);
} else {
  rmSync(out, { recursive: true, force: true });
  for (const [rel, content] of files) {
    const p = join(out, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  writeFileSync(join(out, "SOURCE"), `euron-open-ai-chat ${commit}\n`);
  console.log(`copied ${files.size} files from euron-open-ai-chat ${commit}`);
}
