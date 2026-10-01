#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "..");
const publicRoot = resolve(appRoot, "public");
const excludedRootHtml = new Set(["brunn_build.html", "build-brunn-flip.html"]);

mkdirSync(publicRoot, { recursive: true });

const rootHtmlFiles = readdirSync(repositoryRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".html") &&
      !excludedRootHtml.has(entry.name),
  )
  .map((entry) => entry.name)
  .sort();

for (const file of rootHtmlFiles) {
  copyFileSync(resolve(repositoryRoot, file), resolve(publicRoot, file));
}

copyFileSync(
  resolve(repositoryRoot, "_redirects"),
  resolve(publicRoot, "_redirects"),
);

const logoAssets = ["sorc-letters-evil.png", "sorc-letters-lawful.png"].map(
  (logo) => {
    const source = resolve(repositoryRoot, logo);
    const destination = resolve(publicRoot, logo);
    copyFileSync(source, destination);
    return destination;
  },
);

const spaceSource = resolve(repositoryRoot, "content/features/space.html");
const spaceDestination = resolve(
  publicRoot,
  "content/features/space.html",
);
mkdirSync(dirname(spaceDestination), { recursive: true });
copyFileSync(spaceSource, spaceDestination);

const havenHudShortcutSource = resolve(
  repositoryRoot,
  "content/features/haven-hud.html",
);
const havenHudShortcutDestination = resolve(
  publicRoot,
  "content/features/haven-hud.html",
);
copyFileSync(havenHudShortcutSource, havenHudShortcutDestination);

const havenHudAssets = [
  "default-haven-app-hud_20260927_234628_0000.png",
  "omné-terminal-haven-app-hud_20260927_222728_0000.png",
  "the-veilwood-haven-app-hud_20260927_222654_0000.png",
].map((file) => {
  const source = resolve(
    repositoryRoot,
    "content/character/assets/shared/haven-app",
    file,
  );
  const destination = resolve(
    publicRoot,
    "content/character/assets/shared/haven-app",
    file,
  );
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return destination;
});

const havenMapGridAssets = [
  "5x5-graph-paper_20260903_135837_0000.png",
  "close-qtr-grph-dark_20260928_010415_0000.png",
  "close-qtr-grph-dim_20260928_010448_0000.png",
  "close-qtr-grph-full-light_20260928_010025_0000.png",
  "close-qtr-grph-hazy_20260928_010527_0000.png",
  "close-qtr-grph-pitch-black_20260928_010059_0000.png",
  "close-qtr-grph-very-dark_20260928_010339_0000.png",
].map((file) => {
  const source = resolve(repositoryRoot, "content/maps/assets/grids", file);
  const destination = resolve(
    publicRoot,
    "content/maps/assets/grids",
    file,
  );
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return destination;
});

const raceContentPaths = [
  "content/essentia_core/rules-index.html",
  "content/essentia_core/rules_playable-races.html",
  "content/essentia_core/rules_race-caelen.html",
  "content/essentia_core/rules_race-pinkling.html",
  "content/essentia_core/rusalkas.html",
  "content/reference/all-races.html",
  "content/character/assets/reference/races/playable/litbits/litbit-height-demo_20260930_152758_0000.png",
];
const raceContentAssets = raceContentPaths.map((relativePath) => {
  const source = resolve(repositoryRoot, relativePath);
  const destination = resolve(publicRoot, relativePath);
  if (!existsSync(source)) {
    throw new Error(`Canonical race asset is missing: ${relativePath}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return { source, destination };
});

const archivedRulesSourceRoot = resolve(
  repositoryRoot,
  "content/archived-rules",
);
const archivedRulesDestinationRoot = resolve(
  publicRoot,
  "content/archived-rules",
);
if (
  !existsSync(archivedRulesSourceRoot) ||
  !statSync(archivedRulesSourceRoot).isDirectory()
) {
  throw new Error("Canonical archived-rules directory is missing.");
}

function collectArchivedRulesFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectArchivedRulesFiles(path);
    return entry.isFile() ? [path] : [];
  });
}

const archivedRulesAssets = collectArchivedRulesFiles(
  archivedRulesSourceRoot,
)
  .sort()
  .map((source) => {
    const destination = resolve(
      archivedRulesDestinationRoot,
      relative(archivedRulesSourceRoot, source),
    );
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    return { source, destination };
  });
if (archivedRulesAssets.length === 0) {
  throw new Error("Canonical archived-rules directory contains no files.");
}

const notableRacePageSource = resolve(
  repositoryRoot,
  "content/essentia_core/rules_notable-races.html",
);
const notableRacePageDestination = resolve(
  publicRoot,
  "content/essentia_core/rules_notable-races.html",
);
if (existsSync(notableRacePageSource)) {
  mkdirSync(dirname(notableRacePageDestination), { recursive: true });
  copyFileSync(notableRacePageSource, notableRacePageDestination);
} else {
  rmSync(notableRacePageDestination, { force: true });
}

for (const { source, destination } of [
  ...raceContentAssets,
  ...archivedRulesAssets,
]) {
  if (!readFileSync(source).equals(readFileSync(destination))) {
    throw new Error(`Canonical Worker asset differs after staging: ${destination}`);
  }
}

for (const asset of [
  ...logoAssets,
  spaceDestination,
  havenHudShortcutDestination,
  ...havenHudAssets,
  ...havenMapGridAssets,
  ...raceContentAssets.map(({ destination }) => destination),
  ...archivedRulesAssets.map(({ destination }) => destination),
]) {
  if (statSync(asset).size === 0) {
    throw new Error(`Required Worker asset was staged empty: ${asset}`);
  }
}

console.log(
  `Staged ${rootHtmlFiles.length} root HTML pages, _redirects, brand logos, canonical Space and Haven HUD pages, three Haven HUD artworks, seven structure-map grids, ${archivedRulesAssets.length} canonical archived-rules files, and ${raceContentAssets.length} canonical playable-race pages and artwork.`,
);
