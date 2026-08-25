# Space Tabs Specification - LOCKED

**CRITICAL**: This is the authoritative specification for Character Space tabs and Home system. Do not lose.

## Tab Corrections & Clarifications

1. **General Trade** (not "Trading Post") - replaces Trading Post name in Exchange tab
2. **Home & Family** (not just "Home") - is its own tab with nested sub-tabs
3. **Vault** (not "Inventory") - correct name for storage tab
4. **Achievements, Trophies & Collectables** - combine into single tab
5. **Mailbox** (not "Inbox") - can display actual home mailbox images when TSB opens
6. **Online Journal** (not "Journal") - to avoid confusion with Journal booklet
7. **Essentia Exchange is NOT in profile** - it's separate; General Trade/Bazaar/Black Market are tabs WITHIN it
8. **Contributions** - unclear origin, needs clarification

## Home & Family Tab (Nested Structure)

### Home Overview
- Various forms: tent, hut, studio, apartment, house, mansion, estate (rented or owned)
- One location at a time on plot of land with coordinates
- Rooms include: Trophy Room, Closet, Stash, Safe, Aquarium, Garden, Farm, Kennel, Stable, etc.
- Players choose to display one type of each (one room, one stable, one kennel, etc.) publicly even if they own more
- Unlocked room types through exclusive Achievements

### Home Sub-Tabs (Unknown exact display structure)
- **Rooms** (needs own nested tabs if many rooms exist)
- **Trophy Room** - Achievements, Trophies, Collectables, Rewards from hunting/fishing/collecting
- **Family** - Family members have own Character Sheets; can display photos of lost/deceased members
- **Companions** - Pets, Guardians, Pack Animals, Wagons for storage/carrying
- **Deeds & Blueprints** - Documentation of home (unclear how stored/verified)
- **Mailbox** - Image upload of actual home mailbox (when TSB opens)

### Showcase System
- Players get limited slots to show off public rooms/categories
- Home Lore slot for room/mansion lore
- One of each room type shown publicly at a time (even if own multiple)
- Players can hide entire home or hide categories individually

### Property Types & Limits
- **Homeowners**: Plot of land with home + storage/display (valuables can be stolen if unguarded)
- **Wanderers**: No plot; carry items as "Toting" (without encumbrance); use Pack Animals/Wagons
- **Neighbors**: Multiple players on same coordinates during online sessions (campaign-specific)
- **No limit** on empire building if capable

### Unresolved: Deeds & Blueprints
- How stored/transferred (offline data to server)?
- How to verify offline homes were actually built?
- Can players upload offline homes? How prove ownership?

### Unresolved: Offline vs Online Homes
- Can offline homes be imported to online?
- If yes, what's the verification process?

## Non-Home Tabs (Confirmed)

- Overview
- Achievements, Trophies & Collectables (combined)
- Characters
- Leaderboards
- Fellowship
- Games (?)
- Vault
- Session History
- General Trade (within Essentia Exchange, NOT profile)
- Mailbox (not Inbox)
- Online Journal (not Journal)
- Space Settings

## Open Questions & Uncertainties

See QUESTIONS.md section below.

---

# RESOLVED — Owner answers (session 2026-08-25)

Supersedes the corresponding open questions. Verbatim source:
`space-tabs-original-post.md` plus the follow-up answering points 1-5.

## 1. Games — NOT its own tab
Folded into **Leaderboards** as a sub-tab area. Opens with **Trials of
Combat**; further games join as they open. Leaderboards also carries a link
to the Character's Home **Trophy Room**, where wins and awards are displayed.
*Implemented in `space.html` (`switchGameBoard`).*

## 2. Contributions — REPLACED by "Family"
Contributions had no clear origin and is removed. In its place a **Family**
tab (PUBLIC), which separates Family from Home everywhere on the site.
A Home is a place; a Family is people.

Four contribution areas:
- **a. Household** — direct nuclear family; each member has their own
  Character Sheet and stats
- **b. Affiliations** — see rules
- **c. Standing** — see rules
- **d. Wellness** — see rules

These four are what a Character contributes to.
*Implemented in `space.html`, and written into Basic Rules as
"Contribution & Family" under Prestige (`rules_ref_002.html`), placed
directly after Standing Tiers per owner instruction.*

## 3 & 4. Offline acquisition and Home upload — PROOF PROBLEM
Box set codes already cover **bought** materials. The open gap is **gathered**
materials from strictly offline play, and proving an offline-built Home.
Full precedent analysis with several real game examples, what each got right
and wrong, and a layered recommendation: **`offline-provenance-precedents.md`**.

Headline: offline play cannot be proven, only made expensive, visible, or
pointless. Recommended path is GM attestation (Pathfinder Society Chronicle
Sheet model) + peer co-signature + **severing offline-gathered materials from
the tradeable economy**, which makes forgery worthless.

Four decisions still needed from owner — see that doc's closing section.

## 5. Neighbours — CONFIRMED, extended
- A neighbour's Home, or part of it, may appear on your **offline maps**
- Neighbours may be sent a **Fellowship request** and campaign together
  regularly
- **Standing applies to Friends who party together and to neighbours** —
  written into the Basic Rules Contribution & Family section under Standing
