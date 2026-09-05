# SORC open items

Working list. Nothing here is live unless it says so.

## Rules collisions, deep scan

1. **CLOSED.** Charge speed 3x vs 2x. Charge deleted, RAOO built, RAOO cut,
   Botch capped at 5 ft.

2. **Run / Dash speed, 3x vs 2x**
   - `rules_ref_005:235` Movement table, Run / Dash 3x
   - `rules_ref_appendix:1346` Movement table, Run / Dash 3x
   - `rules_ref_005:301` Movement rules, "Standard 2x speed movement"

3. **Critical Window, flat 96-100 vs Rank-scaled**
   - `rules_ref_005:709,715` scales by Rank
   - `rules_ref_005:785`, `:819`, `rules_ref_appendix:603` all say 96-100 flat

4. **Armor Condition, two mechanics**
   - `rules_ref_004:793` flat points. Excellent +1, Fair -2, Broken halved
   - `rules_ref_appendix:901` percent of Grade. Excellent +5%, Fair -30%, Broken -50%

5. **Weapon Condition, same problem**
   - `rules_ref_004:1128` "-Xd4 damage by rank (see below)"
   - `rules_ref_appendix:931` "Rank-based penalty (see below)"
   - Each "below" says something different

6. **Bound and trade status**
   - `rules_ref_004:1217` "Can be traded within the party at home"
   - `rules_ref_appendix:994` "Can be traded online"
   - Bound triggers differ. 004 says equipped or enhanced, Appendix adds
     inscribed and socketed

7. **Weapon Type Damage Modifiers, one is a subset**
   - `rules_ref_004:1170` four creature columns only
   - `rules_ref_appendix:827` five armor columns plus the same four
   - Same numbers where they overlap. Softer than first scanned

8. **Hit Results chart**
   - `rules_ref_005:729` "1-5 (Fumble = martial, Fizzle = spell)"
   - `rules_ref_appendix:516` "1-5", no split, and still reads "Open to counter
     attack and AoO on every square entered"

9. **Actions table**
   - `rules_ref_005:1259` has the dual-wield row, `rules_ref_appendix:753` does not
   - `rules_ref_005:1265` "Free, 5 ft." vs `rules_ref_appendix:762` "Free, +5 ft."

10. **DMG chart header, three spellings**
    - `rules_ref_005:1554` "Off Hand"
    - `rules_ref_appendix:550` "Off Hand (1H)"
    - `rules_ref_005:753` "1h Off"

11. **Armor Scr. vs Rank Bonus**
    - `rules_ref_005:676` PROTS formula, no Rank Bonus in it
    - `rules_ref_005:1407` "Base Armor Scr. + Rank Bonus = Total Armor Scr."

12. **Material rarity vs Rank**
    - `rules_ref_004:689` and `:1097` "material rarity must match rank"
    - `rules_ref_004:1445` Armament Rank, "Materials carry no Rank"

13. **Visibility wording**
    - `rules_ref_005:553` "-10 to ranged attacks"
    - `rules_ref_appendix:1428` "-10 to Range attacks"

14. **Materials listed twice in one file**
    - `rules_ref_004:1709` and `:1760`
    - `rules_ref_appendix:1536` and `:1565`

15. **Spell range bands**
    - `rules_ref_005:861, 881, 898` last band "Beyond Long"
    - `rules_ref_appendix:632` last band "Dead Zone"

16. **Variant vs Type, five labels for one axis**
    - `rules_ref_004:661` "Armament Variants" is the official term
    - `rules_ref_004:656` "three variants", and says "Advanced" where the rest
      of the book says TAW
    - `rules_ref_005:833` "Weapon Families" and "three power sources"
    - `rules_ref_005:780` "four primary categories based on their origin"
    - `rules_ref_appendix:1032` "Type" is Tactical, Magic, TAW, Chthonic.
      Telluric is not on it. Tactical and Magic are not Variants
    - `rules_ref_004:1053` Weapon Grade & Materials says "Tactical" where the
      rest says "Telluric"

## Planet and TAW cleanup, found in the world-building scan

17. **"the eight inner worlds, Ignis through Zailister"**
    - `rules_ref_004:1075` and `melee-mechanics-draft.html:199`
    - Wrong twice. Ignis through Zailister is four planets. The Adoria-lit band
      is nine. Needs Mark's wording

18. **TAG vs TAA, what Zail inherited**
    - `sorc-cards-overview.html:190` TAG
    - `rules_ref_004:969` TAA

19. **Eight stale copies under `sorc-app/public/`**
    - index, into-essentia, library, prologue, zail, loot-table, forum,
      empty-char-sheet. None carry any of tonight's edits

## World building, open

20. **The Hexagonum curse Variant has no name.** The Grafted Variant text
    points at it, so it cannot ship with a hole in the sentence

21. **The Hexagonum undead playable race has no name and no card**

22. **The Angeligla alchemy / corrosion / gas-scooping race has no name and no
    card.** Its planet was never settled either, since Angeligla went to the
    Aberrations

23. **Grafted Variant row is not live.** Approved by name only. Needs the
    `rules_ref_004:661` row, the Gear & Item row, the Enhancements callout
    line ("Grafted has one, Modification. It may be Salvaged"), and the DMG
    Mod chart row

24. **Caelen race card is live** in `rules_ref_002`. It references a Grafted
    Armament that does not exist yet, see 23

25. **`into-essentia.html:176` and `:297`** still read "not a playable race in
    these rules" for the Cyborgs

26. **MAC leather and cloth types** for Hexagonum and Angeligla, never written

27. **Telluric grenade, Chthonic Geode, Placed delivery row.** Discussed,
    approved in principle, none written. The Thrown Chart at
    `rules_ref_appendix:608` zeroes damage past 26 ft., which is wrong for a
    blast

28. **Traps have no anchors** and the two halves do not reference each other.
    `rules_ref_005:598` and `:1115`

## Older parked items

29. Slam as a Brawler Ability, deleted from the rules, never written on pg. 3
30. Counter and Reactions, drafted, parked
31. The six Trait gaps, standing reminder
32. Site-wide rank palette conversion, 5,615 literals across 225 files
33. Chthonic and TAW materials tables do not exist
34. "Biotics" at `rules_ref_004:1095` is now meaningless
