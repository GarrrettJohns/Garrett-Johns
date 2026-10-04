# 03 — Art and asset contract

## Style and palette
Simple chunky shapes, flat vertex colors or a small shared palette texture. No PBR look or detailed photorealistic textures. Friendly large heads/hands, exaggerated but readable crowns/weapons, cohesive king/horse silhouette. Soft sunlight from upper left is the authored reference direction; cheap shadows acceptable after profiling. Enemy reds must not confuse playable Iron King identification; use ally markers, banners and shape cues.

| Anchor | Hex |
|---|---|
| Grass | #6fae4f |
| Dirt road | #d9b98a |
| River | #46a6d8 |
| Light stone | #d8d3c6 |
| Stone shadow | #a9a49a |
| Mountain | #8f9298 |
| Royal blue | #2f6fdc |
| Gold | #f2c33a |
| Enemy red | #c8332c |

Pines use deep greens; mountain caps snow white. No exact extra regional palette was approved. Define palette swatches when the missing king references arrive.

## Main hero contract
White horse, blue barding, blue tunic, gold belt, long red cape with gold/white trim, five-point gold crown with blue jewel. Cape streams while galloping. Bow stows diagonally while not attacking, avoiding the screen-obscuring vertical silhouette shown in the prototype. Horse, rider, cape, cargo and weapons must work together in high-angle and rear combat views.

R30: standard assets for each of `greenwood`, `eastern_mountains`, `iron_hills`, `sunscorch`, `frostmarch`: king, horse, barding, crown, cape, five bow tiers, projectiles, regional VFX, emblem, banner, portrait, upgraded portrait and cargo attachments. Names of individual kings are unresolved; use regional IDs rather than invent canon names.

R31: shared gameplay animation names: `mounted_idle`, `mounted_walk`, `mounted_gallop`, `bow_fire`, `multishot`, `special_attack`, `axe_chop_left`, `axe_chop_right`, `pickaxe_slam`, `hit_react`, `victory`, `ko`. Cargo visual states: coins, logs, stone, iron. Cargo may be attachment variants rather than separate skeletal clips; document composition. Melee/dodge animations are added if those proposed mechanics are adopted. Idle/firing cycles need explicit release/hit events, not frame-rate-dependent damage.

## Bow inventory
| Tier ID | Name | Shape |
|---|---|---|
| 01 | Golden Longbow | large gold longbow |
| 02 | Gilded Recurve | hooked tips |
| 03 | Sunforged Bow | double limbs |
| 04 | Dragonwing Bow | wing blades on limbs |
| 05 | Crown of Arrows | crown at grip, restrained sparkle |

Finishes: Royal Gold, Moon Silver, Crimson Lacquer, Azure Enamel, Obsidian, Jade. Grip gems: ruby, sapphire, emerald, amethyst, sunstone. Strings: linen, gold thread, red silk, shadow cord. Trails: golden sparks, embers, frost, royal violet, forest green. Use modular parts/material assignments, not a unique GLB for every combination. Maintain crossbow/fire/multishot/storm variants with readable iconography.

## Units and structures
Create the entire R15–R19 inventory. Preserve these defining details:
- Villagers: varied tunic colors; wheelbarrows for logs, stone, iron ore and gold sacks.
- Swordsman: red tunic/helmet, black visor slit. Brute: huge armor, horns, club. Hound: lean brown dog, red collar, yellow glowing eyes. Warlord: big black horned helmet with gold crown band.
- Castle: square plan, blue roofs, four visibly growing upgrades. Houses: red/brown roofs. Farm: fenced rows, hay and shed. Warehouse: crates/barrels.
- Blacksmith: stone forge, glowing hearth, chimney, anvil, quench barrel. Lumber Camp: logs, stump, axe. Quarry: blocks, crane, tent.
- Gold Mine: entry and coins. Iron Mine: dark rust rocks, ore cart and smelting pot.
- Outpost: palisade square, tents, watchtower, royal flag; land claim corner flags. Bridge: original wooden bridge retained as asset; the proposed Old Stone Bridge is a separate landmark.
- All tower, siege and wall tiers follow R18. Gate, catapult arm, tower rotation and other moving parts need intentional pivots.

## Desired visual deliverables preserved
R32: portrait key art: king charging, golden bow drawn, red cape flying, castle and enemy army; front/side/back king sheets plus bow tiers and finish swatches; friendly/enemy lineup sheets; every building/upgrade sheet; biome mood boards; resource/building/unit/upgrade icons; portrait main-screen UI mockup; camera transition concept showing the same encounter from kingdom and combat views.

These are requested deliverables still to be produced, not included as completed artwork. The supplied screenshot pack contains prototype captures, not the five loved generated monarch designs. Do not substitute a PNG for a model, or ship a concept sheet as an animation sprite atlas without an explicit sprite-based rendering decision.

## Proposed model budget and technical delivery
R33: glTF/GLB preferred; documented real scale (castle ~9 m across, house ~4 m, large building ~6 m, tower ~3 m wide). Adapt to existing world units once verified. Original units ~200–1,500 triangles and buildings ~500–3,000; the close-camera revision proposes king+horse combined maximum-detail budget ~8–15k triangles with aggressive LODs. The earlier 12–25k hero suggestion is superseded for mobile browser. All budgets require profiling, especially animated units and draw calls.

Proposed combined hero LOD experiment: LOD0 8–15k, LOD1 4–7k, LOD2 1.5–3k, LOD3 500–1k triangles. These are starting ranges, not per-part allowances. Count cape, barding, crown, weapon and cargo in total. A small bone cape or procedural deformation should replace expensive cloth; previous 8–16 cape-bone suggestion may be reduced after measurement. Crowd geometry and animation complexity need independent budgets.

Create `assets/manifest.json` with each asset's stable ID, region, kind, relative file path, implementation status (`missing`, `placeholder`, `concept_only`, `ready`), source/license, palette, bounds, units, forward/up axis, pivots, triangles by LOD, materials, rig/clip names, sockets and gameplay hooks. No nonexistent filenames marked ready. Proposed path convention: `assets/kings/<region>/king.glb`, `horse.glb`, `bows/tier_01.glb`, `icons/portrait.png`.

Specify sockets for saddle/rider root, bow grip/string, quiver, axe, pickaxe, cape root and cargo. Define mounted pose alignment, feet/stirrups and hand/weapon grip before animating. Verify normals, culling, scale, origins and clip playback in the actual renderer. Reuse a common rig and clip contract where proportions permit; different body shapes must still pass animation QA.
