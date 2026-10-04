# Review and selection guide

You can choose each region separately. All new choices are proposals; no selection has been made on your behalf.

| Section | What to compare | Available choices |
|---|---|---|
| Royal soldiers | `soldier_options.png` and regional army sheets | A: Royal Legions, broad armor/gold crests/large shields. B: Frontier Retinue, practical lighter gear/travel packs. Regional sheets show an initial A-like mixed roster. |
| Regional villains | Six `*_armies.png` sheets vs `villain_options_b.png` | A: region-specific military commanders. B: more mythic armor silhouettes. Keep either design's role separate from the regional playable king. |
| Enemy soldiers | Bottom row of each regional army sheet | Initial regional proposal; select or request stronger/lighter armor, fewer spikes or different silhouettes per role. |
| Royal buildings | `regional_buildings.png` | Initial six-region kit; choose architectural motifs independently of military style. More detailed upgrade workup follows selection. |
| Environments | `regional_environments.png` vs original world concept | Initial travel-view proposal; retain desired large landmarks and adjust terrain density/atmosphere separately. |
| Portrait interface | `portrait_ui.png` | Initial layout comparison for Kingdom and Combat modes, not two competing games. Choose UI density/ornament level. |
| Icon language | `resource_and_ui_icons.png` | Initial chunky icon style; icon atlas and runtime files must be produced separately. |

## Reply example
“Soldiers: A in Greenwood and Iron, B elsewhere. Villains: Greenwood A, Mountains B, Iron A, Desert B, Frost A, Warlord A. Buildings look good; less glow in Iron. UI needs fewer labels.”

This reply is merely an example, not the user's recorded choice. It is also fine to choose one section first. The four supplied concepts remain the established visual references for the five kings and world.

## Readability questions
- Can you distinguish a king, guard, archer, raider, brute and boss by silhouette?
- Do allied Iron soldiers read friendly beside red-armored enemies? If not, increase blue identifiers and change shield/helmet shape.
- Do the close camera and UI leave the enemies visible?
- Does each region feel different in a riding view as well as the world overview?
- Are villains distinct from the playable kings?

## After selection
Update `data/design-selections.json`; preserve rejected variants as concept history. Produce clean individual front/side/back sheets for selected soldiers/bosses, animation pose sheets, consistent heraldry and actual individual icon exports. Model, rig, animate and validate GLBs in the existing game renderer. Keep pending mesh/animation statuses until real files exist and are tested.

Also review `building_progression.png` for upgrades and `elder_treant.png` for the original wave-5 boss. Open `index.html` after unzipping for the visual gallery and optional choice export.
