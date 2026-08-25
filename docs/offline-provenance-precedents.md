# Proving Offline Acquisition: Precedents & Recommendation

How other games have moved offline/physical play into an online record, what
each got right and wrong, and what SORC should take from them.

Written for the Home & Family build: proving a Character gathered or bought
the materials and the plot their Home is built from, when the play happened
entirely at a table with no server watching.

---

## The hard truth first

**No system can cryptographically prove offline play happened.** There is no
sensor at the table. Every game below solves a different problem: they make
cheating *expensive*, *socially visible*, or *pointless*. Pick which of those
three you want, because you cannot have proof.

The strongest design lever is the third one. **If offline-acquired goods
cannot enter the online economy, forging them gains nothing.** Most of the
pain below comes from games that let forged offline claims become tradeable
online value.

---

## Precedent 1: Pathfinder Society / D&D Adventurers League — Chronicle Sheets

**What they do.** Organized play across thousands of unconnected tables. After
each session the GM signs a *Chronicle Sheet*: a physical per-session document
listing gold earned, items unlocked, and boons granted, stamped with the
session number, the GM's organized-play ID, and the player's ID. The sheet is
a bearer instrument — it travels with the character folder. Items are only
legal if a Chronicle Sheet grants them.

**Right:**
- The GM is a notary. Cheap, social, needs no infrastructure.
- Per-session numbering makes double-claiming detectable on audit.
- Item access is gated to what the sheet lists, so wealth cannot be invented,
  only mis-signed.
- Scales to any number of tables without a server.

**Wrong:**
- Forgeable. A cooperative or fictional GM signs anything.
- Heavy admin. Players lose sheets; GMs forget to sign.
- Disputes have no appeal path above the local GM.
- Paper does not sync; the online record is a re-typing of the sheet.

**For SORC:** This is the closest match to your problem and the model I'd
build on. Your GM already exists as an authority; a signed session record for
gathered materials is a small extension of the GM Sheet you already have.

---

## Precedent 2: Pokémon TCG code cards / Magic Online redemption

**What they do.** Every physical booster includes a one-time code redeemable
for a digital equivalent. Codes burn on redemption. MTGO redemption runs the
other direction — assemble a digital set, mail it back, receive physical cards.

**Right:**
- Burn-on-redeem makes double-spend impossible without any GM involvement.
- 1:1 physical-to-digital keeps the two economies honest.
- Zero trust required. The code either works or it doesn't.

**Wrong:**
- **The code decoupled from the product.** Codes are peeled and sold on eBay
  for pennies, so the digital item's value collapsed and the physical purchase
  stopped meaning anything. This is the single most instructive failure here.
- One-directional. Proves *purchase*, never *play*.
- Codes get stolen from shelves before sale.

**For SORC:** Your box set already does this, and it works for **bought**
materials. It cannot cover **gathered** materials, which is the actual gap.
And watch the eBay failure: if a code grants tradeable online value, the code
becomes the commodity instead of the game.

---

## Precedent 3: Toys-to-life — Skylanders, Amiibo, Disney Infinity

**What they do.** An NFC chip in a physical figure stores character state. The
game reads and writes back to the toy. Possession of the object is the proof.

**Right:**
- State genuinely lives offline and travels with the player.
- Read/write means progression survives without a server.
- The object is the credential; nothing to lose or forget.

**Wrong:**
- **Cloneable.** Cheap NFC writers duplicated figures wholesale, and the
  secondary market filled with clones.
- Chip corruption destroyed progression with no recovery.
- Expensive hardware dependency, and the whole category collapsed when
  publishers stopped supporting it.

**For SORC:** The lesson is that possession-as-proof only holds while the
token is hard to copy. Printed cards are easier to copy than NFC chips. Don't
build anything where holding the object alone authorizes online value.

---

## Precedent 4: Geocaching — physical logbook, online log

**What they do.** Find a hidden container, sign the paper logbook inside, then
log the find online. The cache owner can delete logs that don't match the
physical book, and photo proof is often expected.

**Right:**
- Owner-side verification with community policing costs the platform nothing.
- Cheap and fully distributed.
- Photo evidence raises effort without requiring infrastructure.

**Wrong:**
- "Armchair logging" — people log finds they never made. Widespread, and only
  caught when an owner bothers to audit.
- Enforcement is uneven and depends entirely on an owner who cares.

**For SORC:** Photo/scan evidence attached to a claim is a real option, and
cheap. But it is deterrence, not proof.

---

## Precedent 5: Ingress / Pokémon GO — GPS as attestation

**What they do.** Physical presence at real coordinates is the credential.

**Right:** Genuinely ties a digital record to the real world. Directly
relevant to your "plots of land whose coordinates can be tracked."

**Wrong:** **Spoofing is endemic and never solved.** Both games have fought
GPS spoofing for a decade and lost. Anything valuable gated behind location
gets spoofed within weeks.

**For SORC:** Use coordinates for *flavour and neighbour-matching*, never as
the gate on anything valuable.

---

## Precedent 6: MMO housing — Ultima Online, Wurm Online, FFXIV, SWG

Relevant to the *design* of Homes rather than the proof problem, but your
deed/plot/neighbour questions are all solved problems here.

- **Ultima Online:** a house *deed* is an item; you use it on a plot to place
  the house. Your "Deeds" concept already has this precedent exactly.
- **Wurm Online:** land claims literally called deeds, with coordinates,
  upkeep, permissions, and neighbours. The closest match to your description.
- **FFXIV:** plots in wards, real scarcity, demolition for inactivity. The
  scarcity created a hostile secondary market — worth avoiding given you've
  said there's no limit.
- **Star Wars Galaxies:** player cities with mayors and civic structures.
  The precedent for your Neighbours question.
- **EQ Landmark:** players uploaded built structures to a shared claim
  system — the closest precedent for "upload your offline home", and it
  failed commercially, though the build/share tech worked.

**Take:** UO's deed-as-item and Wurm's deed-with-coordinates are the two to
copy. Skip FFXIV-style scarcity.

---

## Precedent 7: Second Life — immutable creator attribution

**What they do.** Every user-created object carries a creator field that
cannot be altered, plus a permissions system (copy/modify/transfer).

**Right:** Attribution survives every resale. Provenance is native to the
object rather than bolted on.

**Wrong:** "Copybot" clients copied geometry and re-uploaded it under a new
creator, and the platform never fully fixed it.

**For SORC:** If Homes are uploadable, stamp creator + first-registration
timestamp immutably. It won't stop copying, but it makes the *original*
provable, which is usually what matters in a dispute.

---

## What I'd actually build for SORC

Layered, cheapest first. None of these require trusting a claim on its own.

**1. Bought materials — extend the box set (already works).**
Codes burn on redemption. No change needed. Guard against the Pokémon failure:
codes should grant *account-bound* materials, never tradeable ones.

**2. Gathered materials — GM attestation, Pathfinder-style.**
A session record signed off by the GM, carrying session number, GM ID, and the
materials gathered. You already have a GM Sheet and campaign records — this is
a field on something that exists. Rate-limit it: a cap per session makes
forgery slow and boring rather than impossible.

**3. Peer witness for anything large.**
A Home is not built in one session. For high-value claims require co-signature
from other Players at the table. Collusion is possible but now needs several
people to agree, which is exactly the friction you want.

**4. Make forgery pointless — the important one.**
Offline-gathered materials build your Home. Your Home is *display* and *lore*.
If those materials cannot be sold on the Essentia Exchange, converted to Coin,
or transferred to another Character, then a forger has spent effort to obtain
a picture of a house. **Cut the bridge to the tradeable economy and the whole
verification problem shrinks to something social.**

**5. Photo/blueprint evidence as flavour, not gate.**
Let players attach blueprint scans and photos to a Home. Community-visible,
which invites the geocaching-style social check. Never let a photo authorize
value on its own.

**6. Immutable registration stamp.**
When a Home is first registered, stamp Character, timestamp, and originating
campaign, unchangeably. Settles ownership disputes without preventing copying.

---

## Open questions for the owner

1. **Should offline-gathered materials ever be tradeable?** My recommendation
   is no, and it's the load-bearing decision — everything above gets easier if
   the answer is no.
2. **What is the per-session cap on gathered materials?** Needs a number.
3. **Does peer co-signature apply above a threshold, or always?**
4. **Can a Home be transferred or sold at all**, or is it bound to the
   Character for life?
