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
    name: "Haven HUD themes and destinations",
    path: "content/features/space.html",
    markers: [
      "havenHudTheme",
      "localStorage.setItem(themeKey, theme)",
      "window.terminalTheme.start()",
      "window.veilwoodTheme.start()",
      "default-haven-app-hud_20260927_234628_0000.png",
      "omné-terminal-haven-app-hud_20260927_222728_0000.png",
      "the-veilwood-haven-app-hud_20260927_222654_0000.png",
      "data-haven-hud-view",
      "haven-hud-only",
      ".sorc-nav-wrapper",
      "#profileBtn",
      "fitHavenHudFrame",
      "window.location.assign",
      'href="space.html" aria-label="Open full Haven"',
      'href="/content/essentia_core/rules_mapping.html#mapping"',
      'href="lobbies.html"',
      'id="trophies"',
      'id="achievements"',
    ],
  },
  {
    name: "Compact Haven HUD route",
    path: "content/features/haven-hud.html",
    markers: [
      "space.html?view=hud",
      'href="space.html?view=hud"',
    ],
  },
  {
    name: "Wanderer Haven HUD preview gate",
    path: "content/features/space.html",
    markers: [
      "haven-wanderer-view",
      'id="haven-hud-access-gate"',
      "/sorc-letters-evil.png",
      "/sorc-letters-lawful.png",
      "window.setHavenHudAccess = function(isWanderer)",
      "hudLinks.inert = isLocked",
      "button.disabled = isLocked",
      "body.haven-wanderer-view .haven-hud-links { pointer-events: none; }",
      'href="/content/auth/signin.html"',
      "body.haven-wanderer-view .haven-hud-sign-in a,",
      "Sign in to open Haven’s sections and controls.",
      "window.setHavenHudAccess(false)",
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

const canonicalSpaceSource = join(
  repository,
  "content",
  "features",
  "space.html",
);
const generatedSpaceCopy = join(
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
const staleGeneratedSpaceCopy =
  existsSync(generatedSpaceCopy) &&
  (!existsSync(canonicalSpaceSource) ||
    !readFileSync(generatedSpaceCopy).equals(readFileSync(canonicalSpaceSource)));
if (staleGeneratedSpaceCopy || extraSpacePages.length) {
  console.error(
    "FAIL The generated Space page matches its canonical source and no duplicate routes remain: found " +
      [staleGeneratedSpaceCopy ? generatedSpaceCopy : null, ...extraSpacePages]
        .filter(Boolean)
        .join(", "),
  );
  failures++;
} else {
  console.log("PASS Canonical Space source and generated Worker page agree");
}

const havenHudPath = join(repository, "content", "features", "space.html");
if (existsSync(havenHudPath)) {
  const havenHudText = readFileSync(havenHudPath, "utf8");
  const hudLinkCount = (havenHudText.match(/class="haven-hud-link"/g) || []).length;
  if (hudLinkCount !== 15) {
    console.error(`FAIL Haven HUD has 15 clickable icon targets: found ${hudLinkCount}`);
    failures++;
  } else {
    console.log("PASS Haven HUD has 15 clickable icon targets");
  }
}

if (failures) {
  console.error(`\nDesign regression check failed for ${failures} check(s).`);
  process.exitCode = 1;
} else {
  console.log("\nDesign regression checks passed.");
}