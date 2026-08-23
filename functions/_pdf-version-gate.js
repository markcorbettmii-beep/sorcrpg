// Shared by the character-sheet PDF functions. Each request's `?v=` is
// checked against pdf-versions.json (written by scripts/render-sheet-pdfs.mjs
// on every regeneration). A match falls through to the real static PDF; a
// mismatch — an old link, or the bare unversioned path — silently redirects
// straight to the current versioned URL. No interstitial, no extra click:
// the visitor just lands on the current PDF as if that's what they'd asked
// for all along.
//
// Manifest reads are fail-open: any hiccup reading it just serves the file
// rather than blocking every visitor.
export async function gatePdf(context, fileName) {
  const url = new URL(context.request.url);
  const requestedVersion = url.searchParams.get('v');

  let currentVersion = null;
  try {
    const manifestUrl = new URL('/pdf-versions.json', url.origin);
    const manifestRes = await context.env.ASSETS.fetch(manifestUrl);
    if (manifestRes.ok) {
      currentVersion = (await manifestRes.json())[fileName] ?? null;
    }
  } catch {
    // Fail open — see comment above.
  }

  if (currentVersion && requestedVersion !== currentVersion) {
    const freshUrl = new URL(`${url.pathname}?v=${currentVersion}`, url.origin);
    return Response.redirect(freshUrl.toString(), 302);
  }

  return context.next();
}
