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

## 1. Game Modes — NOT its own tab
"Games" is the wrong name. It is **Game Modes**, and it already exists on the
home page. Folded into **Leaderboards** as a sub-tab area, with each mode a
sub-category, taken from the live home-page list:

  Campaign Mode · Trials of Combat · Trials of Zailister ·
  Omne Chronicles · Crownmaster · Legend (Pro)

Leaderboards also links to the Character's Home **Trophy Room**, where wins,
ranks, and awards are displayed.
*Implemented in `space.html` (`switchGameMode`, `GAME_MODES`).*

## 2. Contributions — REPLACED by "Family"
Contributions is removed as a tab. **Family** replaces it, and Contributions
becomes a tag carried by each Family sub-category.

Family has five sub-categories:
- **Household** — direct nuclear family; each member has their own Character Sheet
- **Affiliations** — formal faction membership held by the Household
- **Companions** — Pets, Guardians, mounts, pack animals
- **Campaign** — campaigns the Family has run
- **Fellowships** — Fellowships and the parties they ride with

**Each sub-category carries its own Standing tag and its own Contributions
tag.** Standing and Contributions are therefore attributes of each area, not
areas themselves. (Note: Wellness was in the earlier four-area list and is not
in this one — it remains its own system under Wellness, pg. 2.)

The tab and the rules both point the reader to the Journal booklet or the
**Online Journal** tab for the full record.

*Implemented in `space.html` (Family case, `.fam-tag`) and Basic Rules
"Family" under Prestige (`rules_ref_002.html`).*

## 2b. Session History renamed
**Session History → Online Journal** (owner answer 8, to avoid confusion with
the Journal booklet). Tab id `session-history` → `online-journal`.
The Family tab links to it.

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
