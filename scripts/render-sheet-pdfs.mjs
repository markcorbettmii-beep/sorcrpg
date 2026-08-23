// Renders the character sheet HTML to fillable PDFs.
//
// Two steps:
//   1. Chromium prints the sheet to a flat PDF. Page size is set to the .page
//      element's own dimensions (768 x 1104 px). This matters: at US Letter
//      (816 x 1056 px at 96dpi) a 1104px-tall sheet overflows by ~48px and each
//      sheet spills onto a second physical page, which produced 4-page PDFs.
//   2. pdf-lib adds real AcroForm text fields on top, positioned from the live
//      geometry of each input. Chromium's print-to-PDF does not carry HTML form
//      fields into the PDF, so without this the file is flat and can only be
//      written on with Adobe's Fill & Sign rather than actually filled in.
//
// Run: node scripts/render-sheet-pdfs.mjs [sheet.html ...]

import { chromium } from 'playwright';
import { PDFDocument, rgb } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

const CSS_W = 768;   // .page width  in css px
const CSS_H = 1104;  // .page height in css px
const PT = 72 / 96;  // css px -> pdf points

const DEFAULT_SHEETS = [
  'character-sheet-fem-musc.html',
  'character-sheet-male-musc.html',
];
const sheets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SHEETS;

const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
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

    // Collect each field's geometry relative to the .page it sits in.
    const fields = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.page').forEach((pageEl, pageIndex) => {
        const pr = pageEl.getBoundingClientRect();
        pageEl.querySelectorAll('input, select, textarea').forEach((el, i) => {
          if (el.type === 'button' || el.type === 'submit') return;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 6) return;   // skip anything invisible
          out.push({
            pageIndex,
            name: el.id || `${el.tagName.toLowerCase()}_p${pageIndex}_${i}`,
            multiline: el.tagName.toLowerCase() === 'textarea',
            x: r.left - pr.left,
            y: r.top - pr.top,
            w: r.width,
            h: r.height,
          });
        });
      });
      return out;
    });

    const out = sheet.replace(/\.html$/, '.pdf');
    const flat = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      width: `${CSS_W}px`,
      height: `${CSS_H}px`,
    });

    // Overlay real form fields.
    const doc = await PDFDocument.load(flat);
    const form = doc.getForm();
    const pdfPages = doc.getPages();
    const used = new Set();
    let added = 0;

    for (const f of fields) {
      const target = pdfPages[f.pageIndex];
      if (!target) continue;
      let name = f.name;
      while (used.has(name)) name += '_';   // AcroForm names must be unique
      used.add(name);

      const tf = form.createTextField(name);
      if (f.multiline) tf.enableMultiline();
      tf.addToPage(target, {
        x: f.x * PT,
        // PDF origin is bottom-left; HTML is top-left.
        y: (CSS_H - f.y - f.h) * PT,
        width: f.w * PT,
        height: f.h * PT,
        borderWidth: 0,
        backgroundColor: undefined,
        textColor: rgb(0.2, 0.2, 0.2),
      });
      added++;
    }

    // Make filled values visible without the reader having to click each field.
    form.updateFieldAppearances();
    fs.writeFileSync(out, await doc.save());

    const bytes = fs.readFileSync(out);
    const pages = doc.getPageCount();
    console.log(`rendered ${out} — ${pages} pages, ${added} fillable fields, ${Math.round(bytes.length / 1024)} KB`);

    // A sheet is front + back. Anything else means the print CSS has drifted.
    if (pages !== 2) {
      console.error(`  WARNING: expected 2 pages, got ${pages}. Check the print CSS.`);
      failed++;
    }
    if (added === 0) {
      console.error('  WARNING: no fillable fields were added.');
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
