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
    name: "Space Property tab routing",
    path: "content/features/space.html",
    markers: [
      "{ id: 'property', label: 'Property', access: 'PRIVATE', pro: false }",
      "function switchTab(tabId)",
      "spaceCharacterIndex.style.display = tabId === 'property' ? 'block' : 'none';",
      "nextParams.set('tab', tabId);",
      "var initialTab = params.get('tab') || 'overview';",
      "switchTab(initialTab);",
      "renderPropertyDraft()",
    ],
  },
  {
    name: "Haven shortcut redirects to Space",
    path: "content/features/haven-hud.html",
    markers: [
      '<meta http-equiv="refresh" content="0; url=space.html">',
      'window.location.replace(new URL("space.html", window.location.href).href);',
      '<a href="space.html">Open User Space</a>',
    ],
  },
  {
    name: "Property canvas hands and Weasel companion",
    path: "sorc-app/public/content/features/property-draft.js",
    markers: [
      "{ id:'companion-weasel', type:'Companion Cards', name:'Pet Weasel'",
      "art:'/content/character/assets/customizer/pickers/companions/companion-picker-weasel.png'",
      "layerArt:'/content/character/assets/shared/companions/layers/high-res-weas.png'",
      "var HAND_FOREGROUND_ART = '/content/character/assets/female/firstborn/human/physiques/muscular/body/hands-foreground.png_20260916_163927_0000.png';",
      "function characterHandLayer(src, side)",
      "characterHandLayer(src, 'left') + characterHandLayer(src, 'right')",
      "companions.map(function(card) { return canvasLayer(card, 'property-canvas-layer-companion ' + card.id); }).join('')",
    ],
  },
  {
    name: "Space Property page flow",
    path: "sorc-app/public/content/features/property-draft.js",
    markers: [
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
      "window.selectPropertyPage = function(name)",
      "PROPERTY_TAB_PAGES.some(function(item) { return item.id === name; })",
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
const workerAssetStagingScript = join(
  repository,
  "sorc-app",
  "scripts",
  "stage-worker-assets.mjs",
);
const extraSpacePages = [
  join(repository, "sorc-app", "public", "space.html"),
  join(repository, "content", "admin", "debug-space.html"),
  join(repository, "sorc-app", "public", "content", "admin", "debug-space.html"),
].filter(existsSync);
let invalidSpaceStaging = !existsSync(workerAssetStagingScript);
if (!invalidSpaceStaging) {
  const stagingText = readFileSync(workerAssetStagingScript, "utf8");
  invalidSpaceStaging = [
    'resolve(repositoryRoot, "content/features/space.html")',
    'const spaceDestination = resolve(\n  publicRoot,\n  "content/features/space.html",\n);',
    "copyFileSync(spaceSource, spaceDestination)",
  ].some((marker) => !stagingText.includes(marker));
}
if (invalidSpaceStaging || extraSpacePages.length) {
  console.error(
    "FAIL Worker staging uses the canonical Space source and no duplicate routes remain: found " +
      [invalidSpaceStaging ? workerAssetStagingScript : null, ...extraSpacePages]
        .filter(Boolean)
        .join(", "),
  );
  failures++;
} else {
  console.log("PASS Worker stages Space from the canonical source");
}

if (failures) {
  console.error(`\nDesign regression check failed for ${failures} check(s).`);
  process.exitCode = 1;
} else {
  console.log("\nDesign regression checks passed.");
}