# 02 — World and gameplay

## World composition rules
R23: replace the flat test-arena presentation with rolling hills, valleys, ridges, riverbanks, plateaus, ravines, passes and overlooks. King and NPCs follow walkable terrain; visuals and collisions must agree. Hide edges through mountains, water, cliffs and woods while making blocked routes readable. An ocean is optional, not required.

R24: compose successive landmark reveals. From each major route segment provide a plausible destination cue: tower, smoke, bridge, castle, mine glow, mountain fortress, city or final citadel. Use approach, partial concealment and reveal rather than unlimited draw distance. Occluded distant terrain may remain cheap visual scenery; targetable encounters must be real gameplay entities.

R25: major routes support mounted travel, troops and enemy assaults. Side roads lead to villages, ruins, mines, caves, camps and optional encounters. Natural chokepoints such as bridges and passes matter tactically. Avoid overly long empty travel and dead-end resource traps.

R26: settlements become places: house paths, worn soil, fences, gardens, wells, carts, hay, logs, laundry, chimney smoke, small livestock and working villagers. These are proposed dressing examples; select a bounded initial set. Growth adds visible civilization and useful capacity. Decorative clutter must not block formation movement or build placement unexpectedly.

## Regional design matrix
| Region | King association from discussion | World identity | Proposed primary landmark | Campaign role |
|---|---|---|---|---|
| Greenwood | Blue/gold, red cape, white horse | Lush capital, farms, river, dense pines, ruins | Crownfall Castle on gentle hill | Home and tutorial; balanced king |
| Eastern Mountains | Icy blue/white | Grey crags, snowcaps, switchbacks, ravines, waterfalls, mines | Mountain Fort built into cliff | Passes and occupied mines; frost ranged king |
| Iron Hills | Black/red | Rust-streaked dark rocks, smoke, foundries, siege camps | Industrial fortress | Heavy siege/iron economy; heavy fire king |
| Sunscorch | Green/gold | Sandstone canyons, oasis palms, ruins, aqueducts | Walled golden city | Fast mounted exploration; speed king |
| Frostmarch | Purple/black | Snowy pines, frozen rivers, ice caves, villages, blizzard accents | Ice citadel | Late expedition; magic/control king |
| Warlord's realm | Enemy Warlord, no sixth playable king specified | Corrupted ground, dead trees, abandoned siege equipment, patrols | Final looming stronghold | Climactic siege |

Lava cracks, corruption, blizzards, magic and horse abilities are stylistic/gameplay proposals. Use restrained cheap effects, with gameplay hazards explicitly authored. Eastern Mountains and Frostmarch must differ beyond both being snowy: the former is vertical rock/pass geography, the latter a cold occupied kingdom and broad frozen valleys.

## Macro connectivity proposal
Greenwood → foothills → Eastern Mountains → Iron Hills → Sunscorch → Frostmarch → Warlord realm, with branches that later reconnect and optional regional roads. The previous conversation also proposed a foothill fork toward Mountains and Iron Hills. Preserve that possibility in the map plan; exact unlock order is unresolved. A continuous journey is the intended experience, but unobtrusive regional loading transitions are acceptable if required by measured browser limits.

Do not invent authoritative map coordinates from screenshots. After auditing engine scale create `world-layout.json` describing region bounds, route graph, terrain height ranges, chunk grid, spawn/build exclusion areas, POIs and landmark sightlines. Use one documented origin, north direction and world-unit convention. Label new names such as Whispering Woods, Fallen Village, King's River and Old Stone Bridge as working names.

## Greenwood vertical slice
Proposed opening route:
1. Castle hill: readable capital, house cluster, workers and nearby build plots.
2. King's Farmland: fields, training/recruitment and resource tutorial.
3. Whispering Woods: gather wood, encounter a ruin, glimpse a distant tower.
4. Fallen Village / raider camp: small objective linked to settlement restoration.
5. Ridge raid: scout warning, troops join, close mounted combat.
6. King's River crossing: meaningful banks and bridge defense.
7. Mountain foothill overlook: reveal the Mountain Fort and end of slice.

Preserve the north-side river/forest link near home where compatible with the new map. Include existing mines and stone collection within a practical return journey. The first 10-minute narrative is a suggested pacing exercise, not a guarantee of travel time. Tune it through playtests.

## Camera specification
R27: use a state machine with smooth pose interpolation and shared gameplay state. Changing camera must not duplicate a king, reset enemy AI, grant free healing or lose input.

| State | Purpose | Initial tuning proposal |
|---|---|---|
| Kingdom | building, harvesting, orders, tactical readability | Elevated ~55° from original brief; placement raycasts follow terrain |
| Adventure | mounted travel and discovery | Lower trailing camera, enough horizon for landmarks and enough ground for steering |
| Combat | major encounters, bosses, sieges | Behind mounted king; shoulder offset prevents crown/cape/bow blocking target |
| Cinematic overlay | brief landmark or victory reveal | Skippable; no control loss during a dangerous active fight |

Record final offsets, FOV, collision probes and transition durations in configurable data after engine audit. Start experimenting with roughly 0.7–1.2-second transitions. These are proposed tuning values. Add terrain/obstacle camera collision, near clipping protection and mode hysteresis so scattered enemies do not repeatedly jerk the camera. Building UI takes precedence over automatic encounter transitions. Provide a manual camera-mode control where appropriate; combat view must work in portrait.

## Controls and encounters
R28: left thumb moves; right-side drag aims/rotates camera in closer modes. Keep auto-fire as default/available assistance. Prototype at most three contextual actions: Attack, Ability, Dodge. Manual aim, melee and block are proposals; do not add a separate button for every weapon/system. Nearby interaction or harvesting can contextually replace an action, with clear labels. Use pointer tracking so concurrent thumbs do not fight; menu interactions must not fire weapons. Handle cancellation, backgrounding, resize, notch/safe areas and browser chrome.

Mounted combat needs readable tells, hit feedback, target selection and avoidable attacks, not only a close camera on unchanging auto-fire. Preserve strategic troop relevance. Distinguish automated ranged attacks from deliberate melee/ability input so animations and damage cannot double-trigger.

R29: preserve waves and wave-5 Treant; add authored exploration encounters without breaking wave schedules. Record whether a wave pauses, continues or resolves while the king travels, and communicate the rule. The full campaign final siege remains the destination. Bosses and regional kings require clearly distinct silhouettes and mechanics, with hero damage/KO/recovery rules documented.
