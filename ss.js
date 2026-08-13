const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Take screenshot of index.html badge
  await page.goto('http://localhost:8000/index.html');
  await page.waitForTimeout(1000); // Wait for JS to render badge

  const badgeElement = await page.querySelector('#navRoleBadge');
  if (badgeElement) {
    const box = await badgeElement.boundingBox();
    console.log('index.html badge box:', box);

    // Take screenshot of badge area with some padding
    await page.screenshot({
      path: '/tmp/badge_index.png',
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: box.width + 40,
        height: box.height + 40
      }
    });
    console.log('Screenshot saved: /tmp/badge_index.png');
  } else {
    console.log('Badge element not found on index.html');
  }

  // Take screenshot of talents.html badge
  await page.goto('http://localhost:8000/talents.html');
  await page.waitForTimeout(1000); // Wait for JS to render badge

  const badgeElement2 = await page.querySelector('#navRoleBadge');
  if (badgeElement2) {
    const box = await badgeElement2.boundingBox();
    console.log('talents.html badge box:', box);

    await page.screenshot({
      path: '/tmp/badge_talents.png',
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: box.width + 40,
        height: box.height + 40
      }
    });
    console.log('Screenshot saved: /tmp/badge_talents.png');
  } else {
    console.log('Badge element not found on talents.html');
  }

  // Also take full header screenshots for context
  const navElement = await page.querySelector('nav');
  if (navElement) {
    const box = await navElement.boundingBox();
    await page.screenshot({
      path: '/tmp/nav_talents_full.png',
      clip: {
        x: 0,
        y: Math.max(0, box.y - 20),
        width: page.viewportSize().width,
        height: box.height + 40
      }
    });
    console.log('Screenshot saved: /tmp/nav_talents_full.png');
  }

  await browser.close();
  console.log('Done!');
})().catch(console.error);
