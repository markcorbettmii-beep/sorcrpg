import { gatePdf } from './_pdf-version-gate.js';

export async function onRequest(context) {
  return gatePdf(context, 'character-sheet-male-musc.pdf');
}
