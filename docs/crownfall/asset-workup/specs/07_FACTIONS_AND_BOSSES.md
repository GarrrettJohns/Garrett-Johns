# 07 — Royal armies, villains and enemy soldiers

## Shared military language
Allies use rounded shields, clear readable gold/silver crests, visible blue alliance sash or small badge and friendly selection ring. Enemies use angular equipment, red identification cloth and hostile marker; shape and HUD identity supplement color. Particularly in Iron Hills, friendly rusty red is not sufficient to identify enemies. Only kings have full royal crown/cape treatment. Soldier kit A/B changes appearance, not core role.

Core allied roles: guard/knight fronts and protects; archer supplies ranged pressure; raider flanks and moves quickly. Default guard sword/shield comes from original brief; Mountain spear/Desert curved sword are proposed weapon variants using the same role. Regional army sheets may show different raider weapons; selected weapon and animation must be made consistent before final modeling. Add civilians separately: laborer, woodcutter, miner, farmer, courier/wheelbarrow and smith.

Core enemies: swordsman pursues king, bowman holds road and shoots, brute attacks gates, mounted outrider rushes objectives, war hound hunts king. Promote elite stronghold garrison from the same archetypes with real equipment/silhouette improvements and explicit stats; avoid purely cosmetic enemies misrepresenting gameplay.

## Region matrix (initial proposed roster)
| Region | Allied guard / archer / raider | Enemy sword / ranged / brute / rider / hound | Commander A | Commander B alternate |
|---|---|---|---|---|
| Greenwood | Crown Guard / Greenhood Archer / Royal Raider | Red Swordsman / Road Bowman / Gate Brute / Outrider / War Hound | Bramble Captain | Thorn Knight |
| Eastern Mountains | Pass Guard / Peak Archer / Ridge Raider | Crag Swordsman / Ledge Bowman / Stone Brute / Pass Outrider / Ravine Hound | Cliff Marshal | Avalanche Duke |
| Iron Hills | Forge Guard / Cinder Archer / Anvil Raider | Slag Swordsman / Ash Bowman / Kiln Brute / Furnace Outrider / Ash Hound | Forge Tyrant | Ember Judge |
| Sunscorch | Oasis Guard / Sun Archer / Dune Raider | Dune Swordsman / Sand Bowman / Bastion Brute / Dune Outrider / Sand Hound | Dune Conqueror | Scorpion Lord |
| Frostmarch | Winter Guard / Snow Archer / Frost Raider | Rime Swordsman / Blizzard Bowman / Ice Brute / Snow Outrider / Winter Hound | Rime Regent | Glacier Revenant |
| Warlord realm | Alliance Guard / Alliance Archer / Alliance Raider | Blackguard / Dread Bowman / Citadel Brute / Dread Outrider / Dread Hound | The Warlord (sword) | The Warlord, Crownbreaker design (hammer) |

Final allied roster reuses the chosen regional units; Alliance names do not require a sixth royal kingdom or six new heroes. Five kings remain playable. Villain option B is an appearance alternative; campaign boss identity is stable by regional ID.

## Greenwood — Bramble Captain
Threat identity: bulky human raider, hooked axe, broad scarlet thorn shield, one iron shoulder and red scarf. Cap/helmet is asymmetric and not a royal crown. Approximate height target 1.25× guard; keep axe and shield readable.

Fight proposal: forest/road encampment with clear movement lanes. Wind up shield rush with red lane telegraph; sideways dodge interrupts collision. Follow with two short axe sweeps; recovery exposes back for bow shots. At partial health rally a bounded pack of hounds and swordsmen. Player counterplay is riding around cover and commanding guards to hold the road while archers target bowmen. His defeat clears a route/outpost objective. Tutorial of telegraphs, not a mandatory mounted PvP fight against Greenwood King.

**Original Elder Treant remains a separate wave-5 boss.** It uses huge trunk body, two branch arms, roots/feet, green leaf crown and visible weak glow. Root slam, branch sweep and summoned roots are proposals. Add its own model/animations and resource-impact effects; Bramble Captain does not replace it.

## Eastern Mountains — Cliff Marshal
Threat identity: tall enclosed wedge helmet with broad red crest, slate and pale stone armor, triangular tower shield, pick-hammer. No white beard or ice royal crown. Proposed height 1.4× guard.

Fight proposal: defensible pass courtyard with broad safe lane, not unavoidable off-edge knockback. Shield stance deflects frontal attacks visibly; flanking after an overhead hammer opens a damage window. Telegraph a rockfall lane from side ledges; ground marker precedes impact. Bounded bowmen on reachable ledges pressure routes; no invisible long-range hits. Clearing Marshal opens Mountain Fort and aids the Mountain King. Regional tactic: shield front with ranged support; cliffs influence routes, never untelegraphed death traps.

## Iron Hills — Forge Tyrant
Threat identity: enormous slab armor, kiln-shaped closed helmet, orange visor and square forge hammer, scarlet forge apron. Proposed height 1.7× guard. Avoid full real-time fire/smoke on every troop.

Fight proposal: foundry yard with ramps and cool safe platforms. Hammer slam uses a red circle, then small stylized dust/ember ring. Activate timed heat strips with a warm warning phase; damage begins only when marker/state says active. Cooldown vent phase is a visible bow/melee opening. Spawn capped kiln brutes at gate pressure moments. Allied forging tech reward is a proposed unlock; reuse ordinary economy rather than invent a new resource currency.

## Sunscorch — Dune Conqueror
Threat identity: tall maroon-wrapped angular face guard, bronze/black plates, short red mantle, broad curved glaive and narrow hooked shield. Optional mounted phase uses separate enemy horse/barding. Proposed standing height 1.3× guard.

Fight proposal: oasis-city approach with open loops and several columns for ranged cover. Telegraph long mounted lance lanes; make end-of-charge turning slow enough to punish. Wide standing glaive arc has a readable ground crescent. Brief sand gust reduces distant visibility but leaves near enemies and telegraphs readable. Outriders flank; guards can secure bridge/archway. Do not overload phone controls with mandatory precision parry.

## Frostmarch — Rime Regent
Threat identity: narrow triangular black hood, pale angular mask/red eyes, black/silver armor, short crimson mantle, crooked frost staff. Distinct from friendly purple bearded king; no crown. Proposed height 1.3× guard but slimmer than other commanders.

Fight proposal: frozen citadel forecourt with snowbanks defining combat boundary. Ice line telegraphs split arena, ring attack leaves an obvious safe gap; targeted slow projectile has visible travel time and capped duration. Anchor crystals can be destroyed with soldiers/king to shorten frost shielding. Purple king magic and blue enemy ice must be distinguished by team marker plus shape. Maintain a horse escape lane; no permanent slow lock. Blizzard decor thins during action for readability.

## Final — The Warlord
Keep original canon: massive black helmet, two heavy horns, gold crown band, dark armor and crimson banners/cape. A uses broad two-handed sword; B uses heavy crown-shaped hammer silhouette. Proposed height 1.8× guard, separate weapon set per selection.

Fight proposal: final siege has stages outside gate, courtyard, boss duel with troop support. Siege engines and wall tactics remain relevant; do not turn final encounter into a disconnected arena. Stage 1 breach while defending siege units; stage 2 capped elite garrison counterattack; stage 3 Warlord ground sweeps, telegraphed overhead impact and rally banner that can be destroyed. Clear attack/recovery windows remain while elite adds are bounded. Gold crown band is readable at all LODs. Victory has distinct weapon lower/KO, crownfall burst and army salute; no gore.

## Animation and balance rules
Each boss needs idle, locomotion, windup, active attack, recovery, hit/stagger, phase-change/rally and KO. Attack events synchronize collision and damage; reject duplicate events across blending and LOD changes. Ground telegraphs express real collision geometry. Numeric cooldowns/HP/damage are tuning data to decide in game, not an art-sheet promise. Animations should be readable at both camera scales, with simplified distant rigs/updates where measured.

Soldier upgrades are proposed three appearance steps: recruit (simple cloth/iron), veteran (better crest/shield/armor), elite (one distinctive ornament/weapon). This is a production proposal and does not imply the existing game has troop upgrade mechanics. Use material/attachment variants before making whole new rigs. Friendly soldiers should never acquire crowns at elite rank.
