# SORC rules authoring guidance

## Canonical Armament Enhancements and Maintenance

Active rules must use this canonical list and wording:

- **Blessing:** A Church sanctifies a piece in exchange for Contribution.
- **Combining:** Merges two Armaments of the same Mould into one, keeping the better of each part. No materials drop. This raises the Armament's statistics. Must have two of the same.
- **Sundering:** Consumes a piece for its new enhanced version, with a chance to drop materials.
- **Enchanting:** Lays magic onto a finished piece as a layer over the craft. Enchanting can add abilities to your Armaments.
- **Inscribing:** Marks the piece with script or colour that carries an effect of its own.
- **Modifying:** Alters or swaps the physical components of a finished piece to tune its accuracy, damage output, weight, and/or balance.
- **Nesting:** Lines the inside of a piece with a second material. Typically used under heavy armor, for bonuses in colder environments.
- **Resonating:** Tunes a piece to match the spiritual echo of the Armor Core, amplifying its effects when their elements or materials align. A piece outside of the Core, such as boots or gloves, receives a random stat from the Armor Core attuned to the piece.
- **Socketing:** Sets a Jewel, Rune or like piece into a slot cut for it.

Maintenance is daily and player-controlled. Per long rest, the daily fee is `Item Value × 0.05 Gold` for each selected item. The Player chooses which items to include in daily maintenance or chooses to buy and replenish them manually; no item is charged automatically. Repair fixes the Condition and honestly worn Armaments; a Broken Armament must be Reforged. Reforging rebuilds a broken piece from its own materials and brings it back out of the boneyard. Salvaging destroys the Armament for a random part of its materials.

Do not reintroduce alternate Enhancement names, the old one-line Resonating rule, the old Enhancing & Modification Armaments list, weekly `× 7 days` Armament Maintenance wording, or automatic maintenance charges into active rules. Archives remain reference-only.

## URL host convention

Use the `www.sorcrpg.com` hostname for Evil Mode links so the mode is visible in the URL. Use the apex `sorcrpg.com` hostname for the other canonical links.

## Canonical Armament asset hierarchy

Shared Armament assets use this hierarchy:

```text
shared/armaments/<variant>/<armor-or-weapons-subtype>/<rank>/
```

The variants are `telluric`, `techad`, `cthonic`, `oxidize`, and `malign`.

The Techad subtypes are `armor-taba` and `weapons-taw`. The other variants use `armor-<variant>` and `weapons-<variant>` subtypes. Telluric, Cthonic, and Malign also use an `artifacts` Armament subtype.

Every subtype contains all eight rank folders: `common`, `uncommon`, `rare`, `unique`, `heroic`, `elite`, `legendary`, and `divine`. Empty rank folders use `.gitkeep`. Artifacts are Armament Weapon Cards, not Items.