#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));

const checks = [
  {
    name: "Haven role row source",
    path: "content/features/haven.html",
    markers: [
      ".space-role-membership-line",
      "flex-wrap: nowrap",
      "white-space: nowrap",
      '<div class="space-role-membership-line">',
      "Roles &amp; membership",
    ],
  },
  {
    name: "Haven Property page flow",
    path: "sorc-app/public/content/features/property-draft.js",
    markers: [
      "var PROPERTY_TAB_PAGES = [",
      "{ id:'on-person', title:'Worn'",
      "{ id:'carried-hauled', title:'Carried/Hauled', navigationTitle:'Carried-Hauled'",
      "{ id:'quarters', title:'Quarters'",
      "{ id:'vaults', title:'Vault'",
      "{ id:'storage-stash', title:'Stash/Stored'",
      "{ id:'force-station', title:'Force Station'",
      "property-page-prev",
      "property-page-next",
      "PROPERTY_TAB_PAGES.length - 1",
      "nextPageNumber = pageIndex + 2",
      "' PG. ' + nextPageNumber + ' »»'",
      "esc(pageInfo.title) + '</h4></div>'",
    ],
    forbiddenMarkers: ["function pageNavigation()", 'aria-label="Property pages"'],
  },
  {
    name: "Property card rows have independent pagination",
    path: "sorc-app/public/content/features/property-draft.js",
    markers: [
      "var rowPages = {};",
      "var rowCards = propertyRowCards(row.id), pageSize = 5;",
      "Math.ceil(rowCards.length / pageSize)",
      "rowPages[row.id] || 0",
      "pageNumber === pageCount - 1 ? ' disabled' : ''",
      "pageNumber + direction",
    ],
    forbiddenMarkers: ["(pageNumber + direction + pageCount) % pageCount"],
  },
  {
    name: "Legacy Property page-strip styles are removed",
    path: "sorc-app/public/content/features/property-draft.css",
    markers: [".property-page-prev", ".property-page-next"],
    forbiddenMarkers: [".property-page-nav"],
  },
  {
    name: "Carried/Hauled uses its companion rules page",
    path: "sorc-app/public/content/features/property-draft.js",
    markers: [
      "/content/essentia_core/rules_companions.html#draft-animals",
      "return pageFrame(haulingSection());",
    ],
    forbiddenMarkers: ["rows(selected) + haulingSection()"],
  },
  {
    name: "Haven map-first HUD is connected",
    path: "content/features/haven.html",
    markers: [
      "space-hud.css?v=20260926-hud1",
      "space-hud.js?v=20260926-hud1",
      "{ id: 'hud-z', label: 'Haven'",
      "window.renderSpaceHud(user, isPro, isWanderer, PROFILE_TABS)",
      "window.bindSpaceHud()",
      "params.get('tab') || 'hud-z'",
    ],
  },
  {
    name: "HUD uses the uploaded map assets",
    path: "sorc-app/public/content/features/space-hud.js",
    markers: [
      "/content/maps/assets/hud/zailister-map.png",
      "/content/maps/assets/hud/nivis-continent.png",
      "/content/maps/assets/hud/holds-keep-valley.png",
    ],
  },
  {
    name: "HKV marker opens the separate valley map",
    path: "sorc-app/public/content/features/space-hud.js",
    markers: [
      "{ id:'nivis', name:'Nivis', x:448, y:350, level:'nivis' }",
      "{ id:7, name:\"Hold's Keep Valley\", x:350, y:480, level:'valley' }",
      "window.selectSpaceHudPoint(",
      "if (point.level) { transition(point.level); return; }",
    ],
  },
  {
    name: "Haven copy uses the canonical name",
    path: "content/features/haven.html",
    markers: [
      "<title>Character Haven | Slayers of Rings",
      "Your Haven brings together everything tied to your profile:",
      "manage your inventory across your Haven tabs.",
    ],
    forbiddenMarkers: ["Your User Space tracks", "various User Space tabs"],
  },
  {
    name: "Legacy Haven URLs redirect to the canonical page",
    path: "_redirects",
    markers: [
      "/content/features/space.html   /content/features/haven   301",
      "/content/features/space        /content/features/haven   301",
      "/content/features/haven        /content/features/haven.html   200",
    ],
  },
  {
    name: "Signed-in profile opens the Property tab",
    path: "sorc-app/public/main.js",
    markers: [
      "var propertyHavenPath = '/content/features/haven?tab=property';",
      "window.location.href = propertyHavenPath;",
    ],
  },
  {
    name: "Property query stays on Haven",
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
  const missing = (check.markers || []).filter((marker) =>
    !text.includes(marker),
  );
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

const requiredHudMaps = [
  "zailister-map.png",
  "nivis-continent.png",
  "holds-keep-valley.png",
].map((name) =>
  join(repository, "sorc-app", "public", "content", "maps", "assets", "hud", name),
);
const missingHudMaps = requiredHudMaps.filter((path) => !existsSync(path));
if (missingHudMaps.length) {
  console.error("FAIL HUD map assets are present: missing " + missingHudMaps.join(", "));
  failures++;
} else {
  console.log("PASS HUD map assets are present");
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
  join(repository, "content", "features", "space.html"),
  join(repository, "sorc-app", "public", "space.html"),
].filter(existsSync);
if (existsSync(staleSpaceCopy) || extraSpacePages.length) {
  console.error(
    "FAIL Only the canonical Haven page remains: found " +
      [staleSpaceCopy, ...extraSpacePages].filter(existsSync).join(", "),
  );
  failures++;
} else {
  console.log("PASS Only the canonical Haven page remains");
}

if (failures) {
  console.error(`\nDesign regression check failed for ${failures} check(s).`);
  process.exitCode = 1;
} else {
  console.log("\nDesign regression checks passed.");
}