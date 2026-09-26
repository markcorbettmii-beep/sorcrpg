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

for (const asset of [...logoAssets, spaceDestination]) {
  if (statSync(asset).size === 0) {
    throw new Error(`Required Worker asset was staged empty: ${asset}`);
  }
}

console.log(
  `Staged ${rootHtmlFiles.length} root HTML pages, _redirects, brand logos, and canonical Space page.`,
);
