# SORC working rules

## DRAFTS FIRST. DO NOT CHANGE ANYTHING LIVE UNTIL THE DRAFTS ARE DONE.

Standing instruction. While drafting work is open, changes go **only** into the
draft pages:

- `ranged-mechanics-draft.html`
- `melee-mechanics-draft.html`
- `unarmed-mechanics-draft.html`

Do **not** edit the live chapters while drafting is open:

- `content/essentia_core/rules_ref_001.html` … `rules_ref_006.html`
- `content/essentia_core/rules_ref_appendix.html`
- `bare-bones.html`

When a draft is settled, Mark says so. Only then does it get carried into the
chapters, and the carry-over is its own pass, announced before it happens.

Ask before touching a live chapter for any reason. "It is only a one-line fix"
is not an exception.

## How Mark works

- Show the table every time a table changes.
- Do not change his words. If a fix needs his wording altered, say so and let
  him decide. Typos included.
- Forward only. Do not revert shipped work to get out of a problem.
- Do not add or remove rules content without being asked.
- Link a term once per file, first mention. Never link the same text twice.
- No em dashes in prose. `<td>&mdash;</td>` in a table cell is fine.
- Use `Poor`, never `Shoddy`.
- Keep repo and process commentary short. He wants the answer.

## The vocabulary, current

Rule Sets, not Play Styles. The three are **Bare Bones**, **Modular**,
**Complex**. Rank colours: Bare Bones `#0058aa` blue, Modular `#8c06a3` purple,
Complex `#92793a` gold. Colours go inline so they survive a copy-paste into a
document; class-based colour does not.

`Improvised Tools` is the one rule for anything held and used against its
design. There is no Improvised Weapon and no Improvised Projectile.

## Before pushing

1. Parse every changed HTML file for unclosed or mismatched tags.
2. Resolve every `href` against the files and ids that exist. The site carries
   113 pre-existing broken links; that number must not grow.
3. Screenshot anything visual, in **both** modes. Evil is dark ground with
   light text, Lawful is light ground with dark text.
