# Space Tabs: Open Questions & Suggestions

## 1. NESTED TAB DISPLAY STRUCTURE
**Question**: "I'm not sure how the displays of each tab will work. I think, for instance, 'Rooms' tab would need its own tabs within it, in cases there are many rooms."

**Uncertainties**: 
- How many levels of nesting?
- How to avoid "complicated" feel?
- How do "Rooms" tabs display when many exist?

**Options**:

A. **Tab-within-tab approach** (cleanest if few rooms)
   - Home & Family > Rooms > [List of room tabs]
   - Problem: gets complex if player has 10+ rooms
   - Good for: players with 1-5 rooms

B. **Grid + Detail panel** (scales better)
   - Home & Family > Rooms shows grid of room cards
   - Click card to see details in panel on right
   - No nested tabs, cleaner UX
   - Good for: unlimited rooms without complexity

C. **Collapsible sections**
   - Home & Family > Rooms as accordion/collapsible list
   - Trophy Room, Closet, Stash expand inline
   - Hybrid approach
   - Good for: 3-8 rooms

**Recommendation**: B (Grid + Detail) avoids tab explosion and feels less complicated

---

## 2. CONTRIBUTIONS TAB
**Question**: "I'm not sure what Contributions is or where it came from?"

**Current State**: In the tab list but origin unclear

**Options**:

A. **Remove it** - if it was placeholder/error
B. **Define it as**: Community contributions (posts, guides, help given)
C. **Define it as**: Account contributions (payments, purchases, support)
D. **Define it as**: Content contributions (user-generated content submitted)
E. **Something else entirely**

**Needs clarification**: What should this tab actually track/display?

---

## 3. GAMES TAB
**Question**: Unclear if this is confirmed or needs definition

**Current understanding**: General games/activities?

**Options**:

A. **Trials of Combat** - tournament/battle records
B. **Fishing/Hunting** - game records and catches
C. **All games** - aggregated records
D. **Remove** - if not planned for Phase 1
E. **Different name**: [suggestion?]

**Needs clarification**: What games should this tab contain?

---

## 4. DEEDS & BLUEPRINTS SYSTEM
**Question**: "Help me with Deeds and Blue Prints. Other games transfer THIS TYPE of offline data to a server?"

**Uncertainties**:
- How to store offline-built homes?
- How to verify ownership/authenticity?
- How to prevent fraud?
- Technical approach?

**Options**:

A. **Image-based verification**
   - Players upload photos of deed/blueprint
   - Manually verified by mods
   - Slower but human-verified

B. **Hash/certificate system**
   - Export offline home as signed certificate
   - Server validates against public key
   - Automatic verification
   - More complex technically

C. **Inventory codes**
   - Generate unique redemption codes when offline home created
   - Player inputs code in online
   - Ties proof to account
   - Similar to box set codes

D. **Social proof**
   - GM/other players verify in campaign
   - No automatic verification
   - Relies on community

E. **Offline homes are view-only**
   - Can't be uploaded as "official"
   - Display as "offline build" label
   - Simplest solution

**Recommendation**: C (Inventory codes) or E (view-only) - avoid complexity

---

## 5. HOME OFFLINE VS ONLINE
**Question**: "Can players upload their offline homes? If so how do they prove they built them? Deeds, prints etc?"

**Related to #4 above**

**Options**:

A. **Offline homes stay offline**
   - Share via images/screenshots only
   - Never part of official online account
   - Simplest

B. **One-time import**
   - Upload once with proof
   - Becomes official online home
   - No re-importing or editing after

C. **Continuous sync**
   - Can update offline home and re-upload anytime
   - Same verification each time
   - Most flexible but complex

D. **Offline = read-only display**
   - Show photos but can't build/edit online
   - Different from official online homes

**Recommendation**: A or B (avoid endless verification complexity)

---

## 6. NEIGHBORS SYSTEM
**Question**: "How does neighbors work? You know how online sessions work."

**Context**: Multiple players on same land coordinates during online campaigns

**Uncertainties**:
- How visible are neighbors to each other?
- Can they interact?
- Do they see each other's homes?
- Phasing mechanic? Separate instances?

**Options**:

A. **Separate instances** (cleanest)
   - Each player sees their own home on that coordinate
   - No neighbor interaction
   - Works like different realities
   - Simplest to implement

B. **Shared space with visibility toggle**
   - Players see each other's homes by choice
   - Can interact/visit
   - More social, more complex

C. **Campaign-aware phasing**
   - Different campaigns show different homes
   - Within campaign, see campaign neighbors only
   - Medium complexity

D. **No neighbor homes visible**
   - You know neighbors are there
   - Don't see their builds
   - Privacy-focused

**Recommendation**: C (Campaign-aware phasing) - matches online session model you mentioned

---

## 7. SHOWCASE LIMITS & SLOTS
**Questions**: How many showcase slots? Unlocked how?

**Current understanding**:
- Limited showcase slots (TBD number)
- One room type of each shown publicly (even if own multiple)
- Unlock more through exclusive Achievements

**Options**:

A. **Three showcase slots** (conservative)
   - Show 3 room types publicly
   - Room #1, Room #2, Room #3
   - Plus Home Lore slot = 4 total
   - Easy to understand

B. **Five showcase slots** (generous)
   - Show 5 room types
   - More variety for endgame players
   - Risk: too much

C. **Tiered system**
   - Tier 1 (basic): 2 slots
   - Tier 2 (achievements): 3 slots
   - Tier 3 (hardcore): 5 slots
   - Progression feels good

D. **Unlimited but curated**
   - Show all owned room types
   - But public listing shows "Featured" first
   - Manual curation by player

**Recommendation**: C (Tiered) - gives progression goals and feels rewarding

---

## 8. STORAGE SECURITY (UNGUARDED ITEMS)
**Question**: "If items are stolen or lost..."

**Context**: Wanderers and those without guarded homes can have items stolen

**Uncertainties**:
- What triggers theft?
- How visible is theft to player?
- Can items be recovered?
- Insurance/protection mechanics?

**Options**:

A. **Random NPC theft events**
   - Periodic checks if items unguarded
   - Notification when theft occurs
   - Items lost permanently
   - High risk/reward

B. **PvP theft mechanics**
   - Other players can raid unguarded storage
   - Notification system
   - Items transferable/recoverable in dispute
   - Very social but controversial

C. **Time-decay system**
   - Unguarded items decay over time
   - Eventually disappear
   - Warning notifications
   - Forgiving but still risky

D. **Guardians/Companions protect**
   - Hire NPC guard or use Guardian Companion
   - Costs coin per period
   - Complete protection if hired
   - Economic sink

E. **Insurance system**
   - Players pay for protection
   - Theft covered/compensated
   - Simpler, safer for new players

**Recommendation**: D (Guardians) + E (Insurance) - creates economy and choice

---

## 9. FAMILY SYSTEM SCOPE
**Question**: "Characters can start and grow their families... Family members each have their own Character Sheets and stats."

**Uncertainties**:
- How many family members?
- What activities create family?
- Full character sheets or simplified?
- Are they playable?

**Options**:

A. **Love Quests only** (constrained)
   - Marriage through Love Quests
   - Children possible after marriage
   - Limited to 1 spouse + N children
   - Simplified stats

B. **Broader relationships** (expansive)
   - Spouses, siblings, parents, cousins
   - Multiple Love Quests unlock different relationships
   - Full character sheets for all
   - Complex but rich

C. **Roster system** (scalable)
   - Family members are character roster slots
   - Uses existing character sheet system
   - Play as any family member in campaigns
   - Leverages existing mechanics

D. **NPCs only** (simpler)
   - Family members are NPCs you control
   - Display only, not independently playable
   - Simplified stats, narrative focus

**Recommendation**: C (Roster) - reuses character sheet system, most flexible

---

## 10. LOST/DECEASED FAMILY
**Question**: Implied but not explicit - mechanics for lost family members

**Current understanding**: 
- Photos persist in home
- Scripted recovery quests possible
- GM can help develop find quests

**Options**:

A. **Permanent memorial**
   - Family member slots become memorial
   - Display only
   - Can create new family members to replace
   - Closure-based

B. **Recovery quest line**
   - Scripted quests to find lost members
   - Success = reunion with stat changes (aged, trauma, etc.)
   - Or permanent loss
   - Narrative depth

C. **GM-driven stories**
   - Flexible based on campaign
   - No hard mechanics
   - Ad-hoc approach

D. **Hybrid**
   - Default: memorial + photo display
   - Optional: GM-run recovery quests
   - Player choice in narrative direction

**Recommendation**: D (Hybrid) - respects player agency and GM flexibility

---

## 11. WANDERER DISPLAY SYSTEM
**Question**: How exactly do Wanderers display items "Toting"?

**Current understanding**: 
- Can carry without encumbrance
- Use Pack Animals/Wagons for storage
- Display as "Toting" category

**Options**:

A. **Simple list view**
   - Items shown in organized list
   - Companion/Wagon shown separately
   - Text-based, clean

B. **Visual avatar with items**
   - Character drawn with gear/items visually shown
   - Like character sheet portrait
   - More immersive
   - More work to implement

C. **Package/Bundle view**
   - Show Wanderer + Pack Animals as "package"
   - Expandable detail
   - Card-based interface
   - Scalable design

D. **Travel log/Journal**
   - Items displayed as journal entries
   - Narrative approach
   - Fits "Online Journal" theme
   - Unique feel

**Recommendation**: C (Package/Bundle) - scales well, clear hierarchy

---

## SUMMARY: HIGHEST PRIORITY CLARIFICATIONS NEEDED

1. **Nested tab display** (sections 1) → Choose approach
2. **Contributions tab** (section 2) → Define purpose or remove
3. **Games tab** (section 3) → Define scope
4. **Deeds/Blueprints** (sections 4-5) → Pick verification method
5. **Showcase slots** (section 7) → Choose slot count and unlock method
6. **Theft/security** (section 8) → Define protection mechanics
