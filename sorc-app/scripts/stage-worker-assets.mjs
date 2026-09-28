#!/usr/bin/env node

import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

for (const asset of [
  ...logoAssets,
  spaceDestination,
  havenHudShortcutDestination,
  ...havenHudAssets,
  ...havenMapGridAssets,
]) {
  if (statSync(asset).size === 0) {
    throw new Error(`Required Worker asset was staged empty: ${asset}`);
  }
}

console.log(
  `Staged ${rootHtmlFiles.length} root HTML pages, _redirects, brand logos, canonical Space and Haven HUD pages, three Haven HUD artworks, and seven structure-map grids.`,
);
