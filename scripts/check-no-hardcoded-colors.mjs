#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

const PALETTES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "gray", "slate", "zinc", "neutral", "stone",
];

const PREFIXES = [
  "bg", "text", "border", "from", "to", "via", "ring", "outline",
  "fill", "stroke", "divide", "placeholder", "caret", "accent",
  "shadow", "decoration", "ring-offset",
];

const PATTERN = new RegExp(
  String.raw`(?<![A-Za-z0-9_-])(${PREFIXES.join("|")})-(${PALETTES.join("|")})-(?:50|[1-9]00|950)\b`,
  "g",
);

const SCAN_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".mdx", ".html", ".htm",
  ".css", ".scss", ".sass", ".less", ".pcss", ".postcss",
  ".vue", ".svelte", ".astro",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", ".turbo", ".cache",
  "coverage", ".vercel", ".local", ".upm", "out", "public",
]);

const ALLOWLIST = new Set([
  join("app", "globals.css"),
  "tailwind.config.ts",
]);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function shouldScan(absPath) {
  const rel = relative(ROOT, absPath);
  if (!rel || rel.startsWith("..")) return false;
  if (ALLOWLIST.has(rel)) return false;
  const parts = rel.split(sep);
  if (parts.some((p) => IGNORE_DIRS.has(p))) return false;
  const dot = rel.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = rel.slice(dot);
  return SCAN_EXTS.has(ext);
}

const violations = [];

for (const file of walk(ROOT)) {
  if (!shouldScan(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!PATTERN.test(text)) continue;
  PATTERN.lastIndex = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const localRe = new RegExp(PATTERN.source, "g");
    let m;
    while ((m = localRe.exec(line)) !== null) {
      violations.push({
        file: relative(ROOT, file),
        line: i + 1,
        col: m.index + 1,
        match: m[0],
        snippet: line.trim(),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    "\n\u2716 Hardcoded Tailwind palette classes are not allowed.\n" +
      "  Use semantic design tokens (primary, accent, muted, chart-1..5,\n" +
      "  destructive, warning, secondary) defined in app/globals.css and\n" +
      "  tailwind.config.ts instead.\n",
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.col}  ${v.match}`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\n${violations.length} violation(s) found.\n`);
  process.exit(1);
}

console.log("\u2713 No hardcoded Tailwind palette classes found.");
