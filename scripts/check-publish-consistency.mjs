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
  // Archived rules retain their historical filenames and cross-links.
  if (!path.endsWith(".html") || path.startsWith("archived-rules/")) continue;

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
  "sorc-app/public/nav-system.js": [
    "evil-mode",
    "lawful-mode",
    "themeSelected",
    "sorc-nav-plain-item",
    "sorc-nav-item-lock-status",
  ],
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
const havenWatermarkLogoPairs = [
  ["sorc-letters-evil.png", "Evil"],
  ["sorc-letters-lawful.png", "Lawful"],
];
for (const [asset, mode] of havenWatermarkLogoPairs) {
  const sourcePath = join(repository, asset);
  const publicPath = join(repository, "sorc-app", "public", asset);
  if (!existsSync(sourcePath) || !existsSync(publicPath)) {
    protectedFailures.push(`Haven ${mode} SORC watermark artwork is missing`);
  } else if (!readFileSync(sourcePath).equals(readFileSync(publicPath))) {
    protectedFailures.push(`Haven ${mode} SORC watermark artwork differs from its source`);
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
const required404LogoPaths = [
  "/content/site-presentation/assets/branding/logos/newest-sorc-redev-letters-jpeg_20260808_072206_0000.png",
  "/content/site-presentation/assets/branding/logos/newest-sorc-goldlaw-letters-jpeg_20260808_072143_0000.png",
];
for (const [path, label] of [
  [join(repository, "404.html"), "Root 404 page"],
  [join(repository, "sorc-app", "public", "404.html"), "Worker 404 page"],
]) {
  if (!existsSync(path)) {
    protectedFailures.push(`${label} is missing`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  for (const logoPath of required404LogoPaths) {
    if (!text.includes(logoPath)) {
      protectedFailures.push(`${label} is missing the deployed paired logo path ${logoPath}`);
    }
  }
}
for (const logoPath of required404LogoPaths) {
  const workerAssetPath = join(
    repository,
    "sorc-app",
    "public",
    logoPath.slice(1),
  );
  if (!existsSync(workerAssetPath)) {
    protectedFailures.push(`Worker logo asset is missing: ${logoPath}`);
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
const canonicalHavenHudPath = join(sourceRoot, "features", "haven-hud.html");
const publicHavenHudPath = join(publicRoot, "features", "haven-hud.html");
if (!existsSync(canonicalSpacePath)) {
  spaceFailures.push("Canonical Space source is missing: content/features/space.html");
} else {
  const spaceText = readFileSync(canonicalSpacePath, "utf8");
  const requiredSpaceMarkers = [
    "property-draft.css",
    "property-draft.js",
    "{ id: 'property', label: 'Property', access: 'PRIVATE', pro: false }",
    "spaceCharacterIndex.style.display = tabId === 'property' ? 'block' : 'none';",
    "nextParams.set('tab', tabId);",
    "var initialTab = params.get('tab') || 'overview';",
    "switchTab(initialTab);",
    "renderPropertyDraft()",
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
      "{ id:'on-person', title:'Worn'",
      "{ id:'carried-hauled', title:'Carried-Hauled'",
      "{ id:'quarters', title:'Quarters'",
      "{ id:'vaults', title:'Vault'",
      "{ id:'force-station', title:'Force Station'",
      "if (pageName === 'vaults')",
      "<h5>Home Storage</h5>",
      "<h5>Rented Storage</h5>",
      "<h5>Stash</h5>",
      'aria-label="Property pages"',
      'class="property-page-nav"',
      "<h4>Vehicles</h4>",
      "window.selectPropertyPage = function(name)",
      "PROPERTY_TAB_PAGES.some(function(item) { return item.id === name; })",
    ]) {
      if (!propertyDraftText.includes(marker)) {
        spaceFailures.push(`Canonical Space Property navigation is missing ${marker}`);
      }
    }
    if (propertyDraftText.includes("property-page-current") || propertyDraftText.includes('aria-current="page"')) {
      spaceFailures.push("Canonical Space Property navigation repeats the current page label");
    }
    if (propertyDraftText.includes("property-container-size")) {
      spaceFailures.push("Canonical Space Property navigation retains removed container size labels");
    }
  }
  if (!existsSync(propertyDraftCssPath)) {
    spaceFailures.push("Canonical Space Property styles are missing");
  }

  const stageWorkerAssetsPath = join(
    repository,
    "sorc-app",
    "scripts",
    "stage-worker-assets.mjs",
  );
  if (!existsSync(stageWorkerAssetsPath)) {
    spaceFailures.push("Worker asset staging script is missing");
  } else {
    const stageWorkerAssetsText = readFileSync(stageWorkerAssetsPath, "utf8");
    for (const marker of [
      'resolve(repositoryRoot, "content/features/space.html")',
      '"content/features/space.html"',
      "copyFileSync(spaceSource, spaceDestination)",
    ]) {
      if (!stageWorkerAssetsText.includes(marker)) {
        spaceFailures.push(`Worker staging does not copy canonical Space source: ${marker}`);
      }
    }
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

  for (const [asset, label] of [
    [
      "character/assets/female/firstborn/human/physiques/muscular/body/hands-foreground.png_20260916_163927_0000.png",
      "Character hand foreground",
    ],
    [
      "character/assets/customizer/pickers/companions/companion-picker-weasel.png",
      "Weasel picker",
    ],
    [
      "character/assets/shared/companions/layers/high-res-weas.png",
      "Weasel companion layer",
    ],
  ]) {
    const sourceAsset = join(sourceRoot, asset);
    const publicAsset = join(publicRoot, asset);
    if (!existsSync(sourceAsset)) {
      spaceFailures.push(`${label} source artwork is missing`);
    }
    if (!existsSync(publicAsset)) {
      spaceFailures.push(`${label} Worker artwork is missing`);
    } else if (
      existsSync(sourceAsset) &&
      !readFileSync(sourceAsset).equals(readFileSync(publicAsset))
    ) {
      spaceFailures.push(`${label} Worker artwork differs from source`);
    }
  }

  const havenHudAssetDirectory = join(
    sourceRoot,
    "character",
    "assets",
    "shared",
    "haven-app",
  );
  const publicHavenHudAssetDirectory = join(
    publicRoot,
    "character",
    "assets",
    "shared",
    "haven-app",
  );
  for (const asset of [
    "default-haven-app-hud_20260927_234628_0000.png",
    "omné-terminal-haven-app-hud_20260927_222728_0000.png",
    "the-veilwood-haven-app-hud_20260927_222654_0000.png",
  ]) {
    const sourceAsset = join(havenHudAssetDirectory, asset);
    const publicAsset = join(publicHavenHudAssetDirectory, asset);
    if (!existsSync(sourceAsset)) {
      spaceFailures.push(`Haven HUD source artwork is missing: ${asset}`);
    }
    if (!existsSync(publicAsset)) {
      spaceFailures.push(`Haven HUD Worker artwork is missing: ${asset}`);
    } else if (
      existsSync(sourceAsset) &&
      !readFileSync(sourceAsset).equals(readFileSync(publicAsset))
    ) {
      spaceFailures.push(`Haven HUD Worker artwork differs from source: ${asset}`);
    }
  }
}
if (!existsSync(canonicalHavenHudPath)) {
  spaceFailures.push("Compact Haven HUD shortcut is missing");
} else if (!existsSync(publicHavenHudPath)) {
  spaceFailures.push("Compact Haven HUD shortcut is missing from Worker assets");
} else if (
  !readFileSync(canonicalHavenHudPath).equals(readFileSync(publicHavenHudPath))
) {
  spaceFailures.push("Compact Haven HUD Worker shortcut differs from source");
}

const mapGridDirectory = join(sourceRoot, "maps", "assets", "grids");
const publicMapGridDirectory = join(publicRoot, "maps", "assets", "grids");
for (const asset of [
  "5x5-graph-paper_20260903_135837_0000.png",
  "close-qtr-grph-dark_20260928_010415_0000.png",
  "close-qtr-grph-dim_20260928_010448_0000.png",
  "close-qtr-grph-full-light_20260928_010025_0000.png",
  "close-qtr-grph-hazy_20260928_010527_0000.png",
  "close-qtr-grph-pitch-black_20260928_010059_0000.png",
  "close-qtr-grph-very-dark_20260928_010339_0000.png",
]) {
  const sourceAsset = join(mapGridDirectory, asset);
  const publicAsset = join(publicMapGridDirectory, asset);
  if (!existsSync(sourceAsset)) {
    spaceFailures.push(`Structure-map grid source artwork is missing: ${asset}`);
  }
  if (!existsSync(publicAsset)) {
    spaceFailures.push(`Structure-map grid Worker artwork is missing: ${asset}`);
  } else if (
    existsSync(sourceAsset) &&
    !readFileSync(sourceAsset).equals(readFileSync(publicAsset))
  ) {
    spaceFailures.push(`Structure-map grid Worker artwork differs from source: ${asset}`);
  }
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

const navigationPath = join(repository, "sorc-app", "public", "nav-system.js");
if (existsSync(navigationPath)) {
  const navigationText = readFileSync(navigationPath, "utf8");
  const bareBonesEntry = [...navigationText.matchAll(/<li\b[\s\S]*?<\/li>/gi)]
    .map((match) => match[0])
    .find((entry) => entry.includes("Bare Bones Rules"));
  if (!bareBonesEntry) {
    protectedFailures.push("Bare Bones Rules menu entry is missing");
  } else {
    if (/<a\b/i.test(bareBonesEntry)) {
      protectedFailures.push("Bare Bones Rules menu entry must remain plain text");
    }
    if (!/class="sorc-nav-item-lock-status">Locked<\/span>/i.test(bareBonesEntry)) {
      protectedFailures.push("Bare Bones Rules menu entry must be marked Locked");
    }
  }
}

const requiredRulesIndexAnchors = [
  ["rules_time.html", "aura"],
  ["rules_prestige.html", "legacy"],
  ["rules_combat-movement.html", "game-engine-cards"],
];
for (const [contentDirectory, label] of [
  [sourceRoot, "Canonical"],
  [publicRoot, "Worker public"],
]) {
  const rulesIndexPath = join(contentDirectory, "essentia_core", "rules-index.html");
  if (!existsSync(rulesIndexPath)) {
    protectedFailures.push(`${label} Rules Index is missing`);
    continue;
  }
  const rulesIndexText = readFileSync(rulesIndexPath, "utf8");
  for (const [target, id] of requiredRulesIndexAnchors) {
    const link = `href="${target}#${id}"`;
    if (!rulesIndexText.includes(link)) {
      protectedFailures.push(`${label} Rules Index is missing ${link}`);
    }

    const targetPath = join(contentDirectory, "essentia_core", target);
    if (!existsSync(targetPath)) {
      protectedFailures.push(`${label} Rules Index target is missing: ${target}`);
      continue;
    }
    const targetText = readFileSync(targetPath, "utf8");
    if (!targetText.includes(`id="${id}"`)) {
      protectedFailures.push(`${label} Rules Index target ${target} is missing #${id}`);
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