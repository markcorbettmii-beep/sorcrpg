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
    name: "Space role row published copy",
    path: "sorc-app/public/content/features/space.html",
    markers: [
      ".space-role-membership-line",
      "flex-wrap: nowrap",
      "white-space: nowrap",
      '<div class="space-role-membership-line">',
      "Roles &amp; membership",
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
  if (missing.length) {
    console.error(`FAIL ${check.name}: missing ${missing.join(", ")}`);
    failures++;
    continue;
  }

  console.log(`PASS ${check.name}`);
}

if (failures) {
  console.error(`\nDesign regression check failed for ${failures} check(s).`);
  process.exitCode = 1;
} else {
  console.log("\nDesign regression checks passed.");
}