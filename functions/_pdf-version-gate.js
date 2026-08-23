// Shared by the character-sheet PDF functions. Each request's `?v=` is
// checked against pdf-versions.json (written by scripts/render-sheet-pdfs.mjs
// on every regeneration). A match falls through to the real static PDF; a
// mismatch — an old link, or the bare unversioned path — redirects to the
// static outdated-pdf-link.html interstitial instead of silently serving
// nothing useful.
//
// This redirects rather than returning the interstitial's HTML directly at
// the PDF's own path: _headers forces Content-Type: application/pdf and
// Content-Disposition: inline on anything served from /character-sheet-*.pdf,
// which would clobber an HTML response returned at that same path. Sending
// the browser to a different path sidesteps that entirely.
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
    const freshUrl = `${url.pathname}?v=${currentVersion}`;
    const redirectTo = `/outdated-pdf-link.html?fresh=${encodeURIComponent(freshUrl)}`;
    return Response.redirect(new URL(redirectTo, url.origin).toString(), 302);
  }

  return context.next();
}
