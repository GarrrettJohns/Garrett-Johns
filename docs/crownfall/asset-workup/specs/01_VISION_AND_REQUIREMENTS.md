> Updated source note: the four original rendered concepts are now supplied under `references/approved/`. Any historical missing-reference statement below is superseded by spec 06. New regional armies and villains remain proposals pending selection.

# 01 — Vision and requirements

## Status vocabulary
**Required:** explicit user request or original supplied brief, unless superseded. **Accepted direction:** discussed direction endorsed broadly by the user, with details adjustable. **Proposed:** assistant suggestions preserved for design continuity, not individually approved. **Unverified:** repository or performance fact requiring inspection.

## Product contract
- R01 Required: runs and plays in a browser on iPhone; portrait-first, desktop also usable.
- R02 Required: larger maps and an epic adventure, not a cosmetic polish of a small arena.
- R03 Required: behind-the-king, close fighting in an RPG style, while keeping accessible mobile play.
- R04 Required: preserve everything discussed through a durable, implementation-ready handoff.
- R05 Required: the five loved character concepts become regional kings; make usable game assets and preserve their identities once source visuals are provided.
- R06 Required: Breath of the Wild world-design inspiration: elevation, exploration, layered vistas, meaningful routes and enticing landmarks. Crownfall stays original.
- R07 Accepted direction: preserve kingdom-building and warfare, combining strategy, resource collection and action adventure.
- R08 Required: bright, chunky, heroic, playful low-poly 3D; friendly proportions, flat colors, readable silhouettes, soft upper-left sun, gentle shadows, saturated not neon.
- R09 Accepted direction: Kingdom / Adventure / Combat camera states plus short discovery cinematics; seamless gameplay through camera changes.
- R10 Accepted direction: Greenwood, Eastern Mountains, Iron Hills, Sunscorch, Frostmarch, then a distinct final Warlord realm. Wilderness is a transition, not a seventh required kingdom.

## Core gameplay inventory
- R11: mounted king collects coins from fallen enemies, upgrades equipment, builds towns, recruits/trains an army, pushes a campaign road toward the enemy stronghold.
- R12: automatic shooting; axe harvesting with sweeping left/right swings; overhead pickaxe mining; mounted cargo of coins, logs, stone and iron. Include hit, victory and KO states.
- R13: player weapons: Longbow, Crossbow, Fire Arrows, Multishot (three arrows), Storm Bow (chain lightning). Five royal bow tiers and finish/gem/string/trail customization, detailed in the asset spec.
- R14: resources: gold, wood, stone, iron, people; top HUD also shows banked gold. Audit meanings of people/population and banked versus carried gold before changing economy.
- R15: friendly villagers chop, mine, farm and push wheelbarrows. Knights use swords/shields, blue tabards and iron helmets with gold crests; archers wear green hoods; raiders are fast light fighters.
- R16: enemy swordsman chases the king; bowman holds road and shoots; brute smashes gates; outrider rushes gates with spear; war hound hunts king; Elder Treant at wave 5; crowned horned Warlord boss; larger elite stronghold garrison.
- R17: friendly buildings: castle (4 levels), houses, farm, barracks (3), warehouse, blacksmith, lumber camp, quarry, gold mine, iron mine, bridge, claimed outposts, walls/gates and towers/catapult tiers.
- R18: tower chain: wooden Archer Tower → Sturdy Tower → Timber Fort → Stone Tower → Ballista. Catapult → Heavy Catapult → Trebuchet with counterweight. Wall tiers named Palisade → Reinforced → Timber → Stone → Iron. Six wall expansion levels are distinct from those five material tiers.
- R19: enemy Mountain Fort set into cliff, dark stone gate and two red-roofed towers; final Stronghold with huge dark walls, flanking gate towers, keep, spikes and red war banners.
- R20: worker/army orders, outposts claiming land with corner flags, growing settlements, wave defense and siege remain part of the gameplay contract. Exact existing mechanics require audit.
- R21: retain effects: coin bursts/fountains, wood/stone chips, resource-hit highlight, boulder impact dust rings, fire arrows, chain lightning, golden forged burst, wave arrows/red incoming-road chevrons.
- R22: preserve rounded friendly UI: dark translucent resource pills, orange-gold Start Wave, round blue Build/gold King/red Orders, cream tabbed bottom sheets. Adapt layout to touch safe areas and camera mode.

## Earlier proposals retained without overstating approval
- Perceived world size 5–10× current; no measured current dimension exists. Measure traversable routes and compare before promising a scale multiplier.
- Stable 60 FPS goal on newer supported phones, roughly 30 FPS fallback on older supported phones. These are targets, not guarantees; name the actual device/browser matrix after audit.
- Five kings unlocked through regional story arcs: alliance, rescue, restoration or a mounted duel. Exact sequence is undecided.
- Royal families of gameplay: balanced bow / mountain frost ranged / iron heavy fire melee / sun speed mounted / frost magic control. These are proposed mechanics, not established existing features.
- Regional horse stats/abilities; manual melee, dodge and abilities; optional dismount not yet agreed.
- Key opening moment: a scout warns of raiders, troops accompany king, camera drops at hill crest, battle, coin reward, camera rises and king returns home.

## Conflicts resolved and preserved
The original camera was around 55° above ground, slightly behind action. Retain it for kingdom activity; add travel and combat cameras rather than replacing all modes. Original small-unit polygon budget is superseded for close-view heroes by LOD-based art. Original world had north river and forest with an eastern mining area and road south; use that as starting continuity, not a fixed rectangular layout. Frostmarch can be cold because of latitude/elevation; a campaign path need not run literally south in every region. Avoid geographic inconsistency by defining a coordinate plan. No confirmed macro map concept is attached here.
