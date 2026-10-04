> Updated source note: the four original rendered concepts are now supplied under `asset-workup/references/approved/`. Any historical missing-reference statement below is superseded by `asset-workup/specs/06_REFERENCE_RECONCILIATION.md`. New regional armies and villains remain proposals pending selection.

# 05 — Traceability and decisions

This table started unimplemented and is now mapped to the repository (see `implementation-plan.md`). Claude must map the actual repository before assigning existing/done status. Update it in every milestone. State vocabulary: unverified, existing-verified, planned, in-progress, blocked, implemented-unverified, verified. Add code paths and evidence, not only checkmarks.

| ID | Requirement | State (2026-10-04, milestone 1) | Code / evidence |
|---|---|---|---|
| R01 | Portrait iPhone-browser play | existing-verified (desktop headless, 390×844); **iPhone unverified this milestone** | PWA `crownfall/index.html`, `style.css` safe areas; evidence `evidence/m1-*.png`; device checklist in `implementation-status.md` |
| R02 | Bigger epic exploration maps | in-progress | map measured ≈160 × 316 m plus a 58 × 138 m mountain range; terrain relief (`js/terrain.js`); the Greenwood journey adds 5 authored places (`js/slice.js`, `SITES` in `js/map.js`); no streaming yet |
| R03 | Close rear-view RPG combat | implemented-unverified | combat camera behind the king (`js/camera.js` `CAM.combat`, `js/render.js` `updateCamera`); camera-relative steering `stickToWorld`; evidence `evidence/m1-combat-wave.png`; still auto-fire only |
| R04 | Durable full handoff | verified | `docs/crownfall/` (this pack plus plan, status, layout) |
| R05 | Five regional king identities | implemented-unverified (procedural approximation) | five colour kits on one mounted rig from `references/approved/03_five_regional_kings.jpeg` + spec 06 (`KINGS` in `js/config.js`, `RIGS.hero` in `js/models.js`); `hero.kit` saved; dev-tools preview; unlock rule undecided; evidence `evidence/m3-five-kings.png` |
| R06 | Exploration/elevation/landmark inspiration | in-progress | rolling hills, river valley, East Ridge, faceted peaks, rim hills; successive reveals (ruin → ridge watchtower → overlook → fort); evidence `evidence/m2-*.png` |
| R07 | Preserve strategy and building loop | existing-verified | all systems in `js/world.js` untouched by terrain; headless economy and siege sims re-run (see status); legacy save test in `crownfall/tests/run.mjs` |
| R08 | Chunky bright low-poly style | in-progress | flat-shaded vertex colours; layered cliffs, oaks, spired castle, falls, sky gradient toward `references/approved/04_world_and_cameras.jpeg`; evidence `evidence/m3-*.png` |
| R09 | Three cameras + cinematic reveals | implemented-unverified | `js/camera.js` (state machine, tested), `js/render.js` (`updateCamera`, `cinematic`, `skipCinematic`), camera button `#btn-cam`; evidence `evidence/m1-*.png` |
| R10 | Five kingdoms + Warlord realm | existing (partial) | `LEVELS` in `js/config.js`: Greenwood, Sunscorch, Frostmarch lands; Eastern Mountains and Iron Hills inside the Greenwood map; Warlord at each Stronghold. Region order is an open decision |
| R11 | Collect/upgrade/build/recruit/campaign | existing-verified | `js/world.js`, `js/config.js`; headless econ sim |
| R12 | Auto-fire/harvest/cargo/hero states | existing-verified; bow stow implemented-unverified | auto-fire, axe and pickaxe, saddlebag cargo in `js/world.js`; stow matrix `STOW` in `js/render.js`, `stow` parts in `js/models.js`; evidence `evidence/m1-adventure-road-south.png` |
| R13 | Bow tiers/customization/weapons | existing-verified | `WEAPONS`, `ROYAL_BOW` (5 tiers), `STYLES` (finish/gem/string/trail) in `js/config.js`; blacksmith UI |
| R14 | Six HUD resource values | existing-verified | gold (carried + 🏦 banked), wood, stone, iron, people in `js/ui.js` |
| R15 | Friendly units/workers | existing-verified | villagers, knights, archers, raiders, haulers with wheelbarrows (`js/world.js`, `js/models.js`) |
| R16 | Enemies/bosses/elites | existing-verified | `ENEMIES` in `js/config.js`: grunt, brute, archer, raider, hound, treant (wave 5), boss, fort/stronghold structures |
| R17 | Friendly buildings/levels | existing-verified | `BUILDINGS` in `js/config.js`; buildings now stand on `footing()` ground |
| R18 | Tower/catapult/wall progression | existing-verified | tower and catapult tiers in `BUILDINGS`; `WALLS` 6 expansions + 5 gate materials (Palisade → Iron) |
| R19 | Mountain Fort/final Stronghold | existing-verified | `FORT`, `STRONGHOLD`, camps in `js/map.js`; built on levelled ground (`FLATS` in `js/terrain.js`); evidence `evidence/m1-cinematic-mountain-fort.png` |
| R20 | Orders/claims/waves/siege | existing-verified; scout join implemented-unverified | orders/stations/outposts/siege in `js/world.js`; the ridge scout puts field soldiers on follow (`updateScout`), tested |
| R21 | Full effects inventory | existing (unaudited per effect) | `js/render.js` particles and rings, now ground-relative |
| R22 | UI style and controls | existing-verified | `js/ui.js`, `style.css`; new camera button next to pause |
| R23 | Elevation/natural boundaries/traversal | implemented-unverified | `js/terrain.js`; tests: roads walkable, ridable map within slope limits, castle grounds and pads level, river below water, footing never floats |
| R24 | Landmark sightlines/reveals | implemented-unverified | `LANDMARKS` + encounter reveals with `look` targets (`js/slice.js`), light beam + arrow to the next place (`syncSites`, `updateThreats`); tests; evidence `evidence/m2-ruin-reveal-watchtower.png`, `m2-overlook-reveals-fort.png` |
| R25 | Routes/branches/chokepoints | in-progress | 4 lanes, bridge, fort gorge; the journey route with side places off the roads; bot traversal test of the whole route; route graph and journey in `world-layout.json` |
| R26 | Settlements feel inhabited/grow visibly | in-progress (bounded) | the Fallen Village rebuilds visibly with people returning; King's Farmland dressing; houses inside the walls not yet dressed |
| R27 | Smooth collision-aware camera states | implemented-unverified | pose easing over `CAM.blend` 0.9 s, hysteresis, terrain lift along the view line, ground raycast for taps (`rayGround`) in `js/render.js`; camera tests |
| R28 | Simple concurrent touch controls | implemented-unverified | `js/input.js` pointer tracking; right-side drag turns the camera in chase modes; **needs real iPhone test** |
| R29 | Waves and exploration encounters coexist | implemented-unverified | camp guards never count towards a wave (tested); waves continue while travelling, with a one-time toast; encounter state saved |
| R30 | Standard per-king asset inventory | in-progress | manifest adopts workup IDs (`crownfall/assets/manifest.json`): 25 hero kit rows built procedurally from the approved sheet, 126 older procedural stand-ins, 401 not in game; no GLBs |
| R31 | Shared animation/socket/cargo contract | planned | procedural rig poses only (`js/render.js`); clip names mapped in manifest |
| R32 | Key art/sheets/icons/UI/concepts | planned | needs separate art production |
| R33 | GLB/scale/LODs/pivots | planned | no GLBs in the repository |
| R34 | Persistent streamed world | planned | Phase 3; chunk grid proposed in `world-layout.json` |
| R36 | Allied guard/archer/raider variants per kingdom | blocked on selection | soldier A/B per region pending (`asset-workup/data/design-selections.json`); current knight/archer/raider rigs are placeholders |
| R37 | Distinct villain and enemy army per region, Warlord final | blocked on selection | villain A/B per region pending; current enemy rigs placeholders; Warlord remains final boss |
| R38 | Original wave-5 Treant kept separate from the Greenwood villain | existing-verified | `RIGS.treant`, wave 5 in `waveSpec`; Bramble Captain not added |
| R39 | User-selectable review across soldiers/villains/buildings/terrain/UI/icons | in-progress | selections file kept in `asset-workup/data/design-selections.json`, all pending; the workup's `index.html` gallery |
| R40 | Use the supplied king/world images as source; resolve conflicts explicitly | in-progress | kings from sheet 03 per spec 06; castle spires, cliffs, falls and Old Stone Bridge from sheet 04; conflicts noted in `implementation-status.md` |
| R35 | Bounded simulation and visual working set | planned | baseline ≈98 draw calls, ≈260–270k triangles (headless); `?perf` overlay in `js/main.js` |

## Decision register
| Topic | Current status | Required next evidence/decision |
|---|---|---|
| Existing engine/repository | audited: three.js r186, no build step, kept | — |
| Exact king appearances | supplied (sheet 03); procedural kits built | real GLB king/horse sheets and models; unlock rule for the other four kings |
| Praised macro map appearance | supplied (sheet 04) | six-region route graph and coordinates before Phase 4 |
| Map dimensions/chunks/height range | measured: ≈160 × 316 m + mountains, heights −2.3 to 10.7 m where playable; 32 m chunks proposed | slice traversal/profile on a phone |
| Region geographical order | code: Greenwood → Sunscorch → Frostmarch lands, mountains and iron inside Greenwood | owner decision before Phase 4 |
| Mountain versus Iron fork | code: fort pass (east) and iron hills (south-east) both off the Greenwood map | progression plan |
| King names/lore/unlock quests | not fixed | coherent story design using regional IDs first |
| Per-king abilities/horse stats | proposed | combat prototype and balancing |
| Dismount/block/manual attack | not fixed; not added | touch usability; not mandatory extra buttons |
| Simulation while king travels | decided: waves continue, nothing pauses (unchanged) | communicate in the Phase 2 tutorial |
| Supported devices and browsers | proposed matrix in `implementation-status.md` | owner to confirm devices |
| 60/30 FPS, crowd and LOD budgets | target/proposed | real device profiling; no guarantee |
| Five wall materials/six expansions | verified distinct in `WALLS` | — |
| Saves during world migration | additive fields with defaults, `v: 1`; legacy save test passes | bump `v` with an explicit migration when a field changes meaning |
| Deliverable scope | full vision, staged build | vertical slice does not complete entire campaign |

## Change log
2026-10-04 · terrain relief · flat ground · `groundH` relief with levelled build areas · R23 · render-only, saves untouched · tests in `crownfall/tests/run.mjs`, evidence `evidence/m1-*.png`.
2026-10-04 · camera modes · single 55° view · kingdom / adventure / combat + cinematic, manual override · R09, R27 · camera tests, evidence screenshots.
2026-10-04 · bow stow · upright bow · diagonal on the back when not shooting · R12 · `evidence/m1-adventure-road-south.png`.
2026-10-04 · Greenwood journey · none · five authored places with saved encounter state · R24, R25, R26, R29 · 10 tests incl. whole-route ride, `evidence/m2-*.png`.
2026-10-04 · combat camera · dist 10 / height 5.6 · dist 12.5 / height 7.4 · R03, R27 · `evidence/m2-ridge-raid-combat.png`.
2026-10-04 · asset workup v2 adopted · missing king/world references · approved references in `asset-workup/`, manifest IDs adopted, proposals pending selection · R05, R30, R36–R40 · `evidence/m3-*.png`.
2026-10-04 · regional kings · one placeholder king · five colour kits from the approved sheet, Greenwood default · R05 · `evidence/m3-five-kings.png`.

## Change log template
Date · decision · previous rule · new rule · reason · requirement IDs affected · owner approval if scope changes · evidence. Keep old numeric proposals recorded as superseded; don't let future sessions revive them accidentally.

## Resume note template
Current branch/commit; current milestone; verified requirements; files touched; checks/results; blockers; missing references; next exact action. Put it in `implementation-status.md` after each meaningful session.

## Fidelity checklist
Before calling a release complete ask: all five kings accounted for? all six regions accounted for? every weapon/customization/building/unit/effect/UI item mapped? mounted collection and strategy still work? three camera states usable? world genuinely explores beyond a flat arena? browser/iPhone evidence captured? missing art and proposed lore clearly identified? legacy saves preserved? final Warlord siege reachable?
