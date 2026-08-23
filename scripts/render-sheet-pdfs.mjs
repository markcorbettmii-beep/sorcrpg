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
import crypto from 'crypto';

const CSS_W = 768;   // .page width  in css px
const CSS_H = 1104;  // .page height in css px
const PT = 72 / 96;  // css px -> pdf points

const DEFAULT_SHEETS = [
  'character-sheet-fem-musc.html',
  'character-sheet-male-musc.html',
];
const args = process.argv.slice(2);
// --check verifies the committed PDFs still match the current HTML instead of
// rewriting them. Byte comparison is useless here: the output embeds timestamps
// and ids, so two identical runs differ. The page count and field-name set are
// stable, so those are what get compared.
const CHECK = args.includes('--check');
const sheets = args.filter(a => !a.startsWith('--')).length
  ? args.filter(a => !a.startsWith('--'))
  : DEFAULT_SHEETS;


// Fingerprint of everything the PDF is rendered from: the HTML itself plus any
// local file it references (the frame image, the banner). Stored in the PDF and
// compared on --check, so ANY change to the source is caught, including
// text-only edits that leave the page count and field names untouched.
function sourceFingerprint(sheet) {
  const html = fs.readFileSync(sheet);
  const h = crypto.createHash('sha256').update(html);
  const dir = path.dirname(path.resolve(sheet));
  const refs = new Set();
  for (const m of html.toString().matchAll(/(?:src|url)\(?["']?([^"')\s>]+\.(?:png|jpe?g|gif|webp|svg))["')]?/gi)) {
    refs.add(m[1]);
  }
  for (const ref of [...refs].sort()) {
    if (/^(https?:)?\/\//.test(ref)) continue;      // skip remote assets
    const p = path.resolve(dir, ref);
    if (fs.existsSync(p)) h.update(ref).update(fs.readFileSync(p));
  }
  return h.digest('hex');
}

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
    const fingerprint = sourceFingerprint(sheet);
    doc.setKeywords([`sheet-src-sha256:${fingerprint}`]);

    if (CHECK) {
      const stamp = (d) =>
        (d.getKeywords() || '').match(/sheet-src-sha256:([0-9a-f]{64})/)?.[1] ?? null;
      const signature = (d) => JSON.stringify({
        pages: d.getPageCount(),
        fields: d.getForm().getFields().map((x) => x.getName()).sort(),
      });
      if (!fs.existsSync(out)) {
        console.error(`MISSING: ${out} has never been generated.`);
        failed++;
        continue;
      }
      const committed = await PDFDocument.load(fs.readFileSync(out));
      const committedStamp = stamp(committed);
      if (committedStamp !== fingerprint) {
        console.error(`STALE: ${out} was not rendered from the current ${sheet}.`);
        console.error(`  committed source fingerprint: ${committedStamp ?? '(none)'}`);
        console.error(`  current source fingerprint  : ${fingerprint}`);
        console.error('  Run: npm run render-sheets   then commit the PDFs.');
        failed++;
      } else if (signature(committed) !== signature(doc)) {
        console.error(`STALE: ${out} no longer matches ${sheet}.`);
        console.error(`  committed: ${signature(committed)}`);
        console.error(`  expected : ${signature(doc)}`);
        console.error('  Run: node scripts/render-sheet-pdfs.mjs   then commit the PDFs.');
        failed++;
      } else {
        console.log(`ok ${out} matches ${sheet}`);
      }
      continue;
    }

    fs.writeFileSync(out, await doc.save());

    const bytes = fs.readFileSync(out);
    const pages = doc.getPageCount();
    console.log(`rendered ${out} — ${pages} pages, ${added} fillable fields, ${Math.round(bytes.length / 1024)} KB`);

    // Cache-busting: stamp every link to this PDF with a hash of its own
    // bytes. A changed file gets a new URL, so browsers, Cloudflare's edge,
    // and any other cache in between can never serve stale bytes under the
    // new query string — there's nothing stale to have cached yet.
    const pdfHash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const pdfName = path.basename(out);
    for (const htmlFile of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
      const html = fs.readFileSync(htmlFile, 'utf8');
      const re = new RegExp(`(href="${pdfName})(\\?v=[0-9a-f]+)?(")`, 'g');
      if (re.test(html)) {
        re.lastIndex = 0;
        const updated = html.replace(re, `$1?v=${pdfHash}$3`);
        if (updated !== html) {
          fs.writeFileSync(htmlFile, updated);
          console.log(`  stamped ${htmlFile} link to ${pdfName} with ?v=${pdfHash}`);
        }
      }
    }

    // Record the current hash so the Pages Function (functions/*.pdf.js) can
    // tell an outdated ?v= apart from the live one at request time and show
    // the "reach the newer version" page instead of silently doing nothing.
    const manifestPath = 'pdf-versions.json';
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : {};
    manifest[pdfName] = pdfHash;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

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
