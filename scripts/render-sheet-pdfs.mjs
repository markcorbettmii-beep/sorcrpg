// Renders the character sheet HTML to print-ready PDFs.
//
// The page size is set explicitly to the .page element's own dimensions
// (768 x 1104 px). This matters: at US Letter (816 x 1056 px at 96dpi) a
// 1104px-tall sheet overflows by ~48px and each sheet spills onto a second
// physical page, which is what produced 4-page PDFs instead of 2.
//
// Run: node scripts/render-sheet-pdfs.mjs [sheet.html ...]
// With no arguments it renders the two muscular sheets.

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const PAGE_WIDTH = '768px';
const PAGE_HEIGHT = '1104px';

const DEFAULT_SHEETS = [
  'character-sheet-fem-musc.html',
  'character-sheet-male-musc.html',
];

const sheets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SHEETS;

// CHROME_PATH lets a sandbox point at a preinstalled browser; CI uses Playwright's own.
const launchOpts = process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH }
  : {};

const browser = await chromium.launch(launchOpts);
let failed = 0;

for (const sheet of sheets) {
  if (!fs.existsSync(sheet)) {
    console.error(`missing: ${sheet}`);
    failed++;
    continue;
  }
  const page = await browser.newPage();
  try {
    await page.goto('file://' + path.resolve(sheet), { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    const out = sheet.replace(/\.html$/, '.pdf');
    await page.pdf({
      path: out,
      printBackground: true,
      preferCSSPageSize: true,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });

    // A sheet is front + back. Anything else means the print CSS has drifted.
    const bytes = fs.readFileSync(out);
    const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`rendered ${out} (${pages} pages, ${Math.round(bytes.length / 1024)} KB)`);
    if (pages !== 2) {
      console.error(`  WARNING: expected 2 pages, got ${pages}. Check the print CSS.`);
      failed++;
    }
  } catch (err) {
    console.error(`failed on ${sheet}: ${err.message}`);
    failed++;
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
