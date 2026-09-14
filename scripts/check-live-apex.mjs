#!/usr/bin/env node

const baseUrl = (process.argv[2] || "https://sorcrpg.com").replace(/\/+$/, "");

const checks = [
  {
    path: "/content/essentia_core/rules-index",
    markers: ["rules-index", "rules_combat.html", "rules_movement.html", "Armaments"],
  },
  {
    path: "/content/essentia_core/rules_combat",
    markers: ["rules_combat-movement.html#combat"],
  },
  {
    path: "/content/essentia_core/rules_movement",
    markers: ["rules_combat-movement.html#movement"],
  },
  {
    path: "/content/essentia_core/rules_equipment",
    markers: ['id="weapons"', "Artifacts"],
  },
  {
    path: "/content/essentia_core/rules_appendix",
    markers: ['id="hit-bonus-chart"', 'id="dmg-chart"'],
  },
  {
    path: "/main.js",
    markers: ["lawful-mode", "themeSelected", "sorcSyncHtmlBg"],
  },
  {
    path: "/nav-system.js",
    markers: ["evil-mode", "lawful-mode", "themeSelected"],
  },
];

let failures = 0;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  let response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    console.error(`FAIL ${url}: ${error.message}`);
    failures++;
    continue;
  }

  const body = await response.text();
  const missing = check.markers.filter((marker) => !body.includes(marker));
  if (!response.ok || missing.length) {
    const status = `${response.status} ${response.statusText}`.trim();
    console.error(
      `FAIL ${url}: ${status}${missing.length ? `; missing ${missing.join(", ")}` : ""}`,
    );
    failures++;
    continue;
  }

  console.log(`PASS ${url}: ${response.status}`);
}

if (failures) {
  console.error(`\nLive Apex check failed for ${failures} URL(s).`);
  process.exitCode = 1;
} else {
  console.log("\nLive Apex check passed.");
}