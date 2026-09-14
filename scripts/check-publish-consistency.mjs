#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = join(repository, "content");
const publicRoot = join(repository, "sorc-app", "public", "content");

function filesUnder(directory) {
  const files = [];
  if (!existsSync(directory)) return files;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else if (entry.isFile()) files.push(path);
  }

  return files;
}

function relativeFiles(directory) {
  return new Map(
    filesUnder(directory).map((path) => [relative(directory, path), path]),
  );
}

const sourceFiles = relativeFiles(sourceRoot);
const publicFiles = relativeFiles(publicRoot);
const commonPaths = [...sourceFiles.keys()]
  .filter((path) => publicFiles.has(path))
  .sort();

const mismatches = [];
for (const path of commonPaths) {
  const source = readFileSync(sourceFiles.get(path));
  const published = readFileSync(publicFiles.get(path));
  if (!source.equals(published)) mismatches.push(path);
}

const staleReferences = [];
for (const path of publicFiles.keys()) {
  if (!path.endsWith(".html")) continue;

  const fullPath = publicFiles.get(path);
  const text = readFileSync(fullPath, "utf8");
  const searchableText = text.replace(/<!--[\s\S]*?-->/g, "");
  const lines = searchableText.split("\n");
  const destinationPattern =
    /(?:href|src)\s*=\s*["'][^"']*(?:rules_ref_|SORC-Basic-Rules\.html)[^"']*["']|(?:url|URL)\s*[:=]\s*["'][^"']*(?:rules_ref_|SORC-Basic-Rules\.html)[^"']*["']/gi;

  lines.forEach((line, index) => {
    for (const match of line.matchAll(destinationPattern)) {
      staleReferences.push({
        path,
        line: index + 1,
        value: match[0],
      });
    }
  });
}

const protectedFiles = {
  "sorc-app/public/main.js": ["lawful-mode", "themeSelected", "sorcSyncHtmlBg"],
  "sorc-app/public/nav-system.js": ["evil-mode", "lawful-mode", "themeSelected"],
  "sorc-app/public/styles.css": ["body.evil-mode", "body.lawful-mode"],
};

const protectedFailures = [];
for (const [relativePath, markers] of Object.entries(protectedFiles)) {
  const path = join(repository, relativePath);
  if (!existsSync(path)) {
    protectedFailures.push(`${relativePath}: file is missing`);
    continue;
  }

  const text = readFileSync(path, "utf8");
  for (const marker of markers) {
    if (!text.includes(marker)) {
      protectedFailures.push(`${relativePath}: missing ${marker}`);
    }
  }
}

console.log(`Compared ${commonPaths.length} common content paths.`);
console.log(
  `Root-only content paths allowed: ${[...sourceFiles.keys()].filter((path) => !publicFiles.has(path)).length}.`,
);

if (mismatches.length > 0) {
  console.warn(
    "\nInformational: root content copies differ from deployed public copies; root content is not deployed.",
  );
  for (const path of mismatches) console.error(`- ${path}`);
}

if (staleReferences.length > 0) {
  console.error("\nDeployed content contains stale legacy-rule destinations:");
  for (const reference of staleReferences) {
    console.error(`- ${reference.path}:${reference.line} (${reference.value})`);
  }
}

if (protectedFailures.length > 0) {
  console.error("\nProtected reader behavior is incomplete:");
  for (const failure of protectedFailures) console.error(`- ${failure}`);
}

if (staleReferences.length || protectedFailures.length) {
  process.exitCode = 1;
} else {
  console.log("Publish consistency check passed.");
}