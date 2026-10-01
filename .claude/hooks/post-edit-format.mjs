#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function readStdinJSON() {
  try {
    return JSON.parse(readFileSync(0, "utf-8"));
  } catch {
    return null;
  }
}

const input = readStdinJSON();
const filePath = input?.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const IGNORE = [
  /node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];
if (IGNORE.some((re) => re.test(filePath))) process.exit(0);

const ext = path.extname(filePath);
const JS_TS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const FORMATTABLE = [...JS_TS, ".json", ".css", ".md"];

function run(cmd) {
  try {
    execSync(cmd, {
      stdio: "pipe",
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    });
    return null;
  } catch (e) {
    return (e.stdout?.toString() || e.message || "")
      .split("\n")
      .slice(0, 3)
      .join("\n");
  }
}

const errors = [];
if (FORMATTABLE.includes(ext)) {
  // "npm run format" hardcodes "." as its target, so it can't be scoped to a
  // single file — call prettier directly instead.
  const out = run(`npx prettier --write "${filePath}"`);
  if (out) errors.push(`format: ${out}`);
}
if (JS_TS.includes(ext)) {
  // "npm run lint:fix" hardcodes a glob target, so it can't be scoped to a
  // single file either — call eslint directly.
  const out = run(`npx eslint --fix "${filePath}"`);
  if (out) errors.push(`lint: ${out}`);
}
if (errors.length) console.log(errors.join("\n"));
process.exit(0);
