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
const spaceFailures = [];
const bannerAssetPairs = [
  [
    join(repository, "sorc-letters-evil.png"),
    join(publicRoot, "site-presentation", "assets", "branding", "logos", "newest-sorc-redev-letters-jpeg_20260808_072206_0000.png"),
    "Evil",
  ],
  [
    join(repository, "sorc-letters-lawful.png"),
    join(publicRoot, "site-presentation", "assets", "branding", "logos", "newest-sorc-goldlaw-letters-jpeg_20260808_072143_0000.png"),
    "Lawful",
  ],
];
for (const [sourcePath, publicPath, mode] of bannerAssetPairs) {
  if (!existsSync(sourcePath) || !existsSync(publicPath)) {
    protectedFailures.push(`${mode} SORC banner source or public asset is missing`);
  } else if (!readFileSync(sourcePath).equals(readFileSync(publicPath))) {
    protectedFailures.push(`${mode} SORC banner in public assets differs from the approved banner`);
  }
}
const publicIndexPath = join(repository, "sorc-app", "public", "index.html");
if (!existsSync(publicIndexPath)) {
  protectedFailures.push("Public index page is missing");
} else {
  const indexText = readFileSync(publicIndexPath, "utf8");
  if (!indexText.includes("slayers-letters_20260510_111419_0000.jpg")) {
    protectedFailures.push("Public index page no longer uses its existing SORC banner");
  }
}
const publicSiteRoot = join(repository, "sorc-app", "public");
const indexBannerName = "slayers-letters_20260510_111419_0000.jpg";
const indexOnlyPages = new Set([publicIndexPath, join(repository, "index.html")]);
for (const pageRoot of [publicSiteRoot, sourceRoot, join(repository, "demos")]) {
  for (const pagePath of filesUnder(pageRoot)) {
    if (!pagePath.endsWith(".html") || indexOnlyPages.has(pagePath)) continue;
    if (readFileSync(pagePath, "utf8").includes(indexBannerName)) {
      protectedFailures.push(
        `${relative(repository, pagePath)} still uses the index-only SORC banner`,
      );
    }
  }
}

const canonicalSpacePath = join(sourceRoot, "features", "space.html");
const publicSpacePath = join(publicRoot, "features", "space.html");
if (!existsSync(canonicalSpacePath)) {
  spaceFailures.push("Canonical Space source is missing: content/features/space.html");
} else {
  const spaceText = readFileSync(canonicalSpacePath, "utf8");
  const requiredSpaceMarkers = [
    "property-draft.css",
    "property-draft.js",
  ];
  for (const marker of requiredSpaceMarkers) {
    if (!spaceText.includes(marker)) {
      spaceFailures.push(`Canonical Space source is missing ${marker}`);
    }
  }

  const propertyDraftJsPath = join(publicRoot, "features", "property-draft.js");
  const propertyDraftCssPath = join(publicRoot, "features", "property-draft.css");
  if (!existsSync(propertyDraftJsPath)) {
    spaceFailures.push("Canonical Space Property navigation helper is missing");
  } else {
    const propertyDraftText = readFileSync(propertyDraftJsPath, "utf8");
    for (const marker of [
      "'on-person': 'Worn'",
      "'carried-hauled': 'Carried-Hauled'",
      "Carried-Hauled PG. 2",
      "Quarters pg. 3",
    ]) {
      if (!propertyDraftText.includes(marker)) {
        spaceFailures.push(`Canonical Space Property navigation is missing ${marker}`);
      }
    }
  }
  if (!existsSync(propertyDraftCssPath)) {
    spaceFailures.push("Canonical Space Property styles are missing");
  }

  const pickerAssetDirectory = join(
    publicRoot,
    "character",
    "assets",
    "customizer",
    "pickers",
    "characters",
  );
  for (const asset of [
    "character-picker-basic-1.png",
    "character-picker-basic-2.png",
    "character-picker-pro-1.png",
    "character-picker-pro-2.png",
    "character-picker-pro-3.png",
  ]) {
    if (!existsSync(join(pickerAssetDirectory, asset))) {
      spaceFailures.push(`Space picker image is missing from public assets: ${asset}`);
    }
  }
}
if (existsSync(publicSpacePath)) {
  spaceFailures.push(
    "Stale public Space duplicate exists at sorc-app/public/content/features/space.html",
  );
}
for (const [path, label] of [
  [join(repository, "sorc-app", "public", "space.html"), "Legacy /space.html alias"],
  [join(sourceRoot, "admin", "debug-space.html"), "Source Space debugger"],
  [join(publicRoot, "admin", "debug-space.html"), "Public Space debugger"],
]) {
  if (existsSync(path)) spaceFailures.push(`${label} should not exist`);
}

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
const rootOnlyNonSpacePaths = [...sourceFiles.keys()].filter(
  (path) => !publicFiles.has(path) && path !== "features/space.html",
);
console.log(`Root-only content paths not deployed: ${rootOnlyNonSpacePaths.length}.`);

if (mismatches.length > 0) {
  console.warn(
    "\nInformational: root content copies differ from public copies; Space is built from its canonical root source.",
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

if (spaceFailures.length > 0) {
  console.error("\nSpace source selection is invalid:");
  for (const failure of spaceFailures) console.error(`- ${failure}`);
}

if (staleReferences.length || protectedFailures.length || spaceFailures.length) {
  process.exitCode = 1;
} else {
  console.log("Publish consistency check passed.");
}