#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));

const checks = [
  {
    name: "Space role row source",
    path: "content/features/space.html",
    markers: [
      ".space-role-membership-line",
      "flex-wrap: nowrap",
      "white-space: nowrap",
      '<div class="space-role-membership-line">',
      "Roles &amp; membership",
    ],
  },
  {
    name: "Space Property page flow",
    path: "sorc-app/public/content/features/property-draft.js",
    markers: [
      "'on-person': 'Worn'",
      "'carried-hauled': 'Carried-Hauled'",
      "Carried-Hauled PG. 2",
      "Quarters pg. 3",
      "label: 'Worn'",
      "label: 'Carried-Hauled'",
      "label: 'Quarters'",
      'aria-label="Property pages"',
      'aria-current="page"',
    ],
  },
  {
    name: "Signed-in profile opens the Property tab",
    path: "sorc-app/public/main.js",
    markers: [
      "var propertySpacePath = '/content/features/space.html?tab=property';",
      "window.location.href = propertySpacePath;",
    ],
  },
  {
    name: "Property URL serves the Space page",
    path: "sorc-app/src/index.ts",
    markers: ["let assetResponse = await c.env.ASSETS.fetch(c.req.raw);"],
    forbiddenMarkers: [
      "isDuplicatePropertyRoute",
      "c.redirect('/content', 302)",
    ],
  },
];

let failures = 0;

for (const check of checks) {
  const path = join(repository, check.path);
  if (!existsSync(path)) {
    console.error(`FAIL ${check.name}: missing ${check.path}`);
    failures++;
    continue;
  }

  const text = readFileSync(path, "utf8");
  const missing = check.markers.filter((marker) => !text.includes(marker));
  const forbidden = (check.forbiddenMarkers || []).filter((marker) =>
    text.includes(marker),
  );
  if (missing.length) {
    console.error(`FAIL ${check.name}: missing ${missing.join(", ")}`);
    failures++;
    continue;
  }
  if (forbidden.length) {
    console.error(`FAIL ${check.name}: found ${forbidden.join(", ")}`);
    failures++;
    continue;
  }

  console.log(`PASS ${check.name}`);
}

const staleSpaceCopy = join(
  repository,
  "sorc-app",
  "public",
  "content",
  "features",
  "space.html",
);
const extraSpacePages = [
  join(repository, "sorc-app", "public", "space.html"),
  join(repository, "content", "admin", "debug-space.html"),
  join(repository, "sorc-app", "public", "content", "admin", "debug-space.html"),
].filter(existsSync);
if (existsSync(staleSpaceCopy) || extraSpacePages.length) {
  console.error(
    "FAIL Only the canonical Space page remains: found " +
      [staleSpaceCopy, ...extraSpacePages].filter(existsSync).join(", "),
  );
  failures++;
} else {
  console.log("PASS Only the canonical Space page remains");
}

if (failures) {
  console.error(`\nDesign regression check failed for ${failures} check(s).`);
  process.exitCode = 1;
} else {
  console.log("\nDesign regression checks passed.");
}