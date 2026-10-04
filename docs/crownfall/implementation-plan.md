# Crownfall — implementation plan

Source of truth: the numbered docs in this folder. This plan maps them onto
the real repository (`crownfall/` in `garrrettjohns/garrett-johns`, deployed
by GitHub Pages from `main`) and records the reversible defaults chosen.

## Phase 0 audit: what actually exists

Facts below were read from the code, not inferred from the screenshots.
Line counts are as of this milestone.

| Area | What exists | Files |
|---|---|---|
| Stack / deploy | Plain ES modules, no build step, no package.json. PWA with a service worker (cache-first, `CACHE` bumped every release). GitHub Pages deploys `main`. | `crownfall/index.html`, `sw.js`, `manifest.webmanifest` |
| Renderer | three.js r186 (WebGL 2), tree-shaken into a vendored module; no `THREE.Line`. Every character part is an `InstancedMesh` (`RigMesh`); buildings are merged vertex-coloured geometry from a `Builder`. One directional sun with a 2048² shadow map that follows the view, hemisphere fill, distance fog plus fog over unclaimed land. | `js/render.js` (1.7k lines), `js/models.js` (1.2k), `js/vendor/three.js` |
| World units | 1 unit = 1 m. Origin = the castle centre. North = −z (top of the kingdom view). The map is 2D in the simulation (x, z). | `js/map.js` |
| Map size | Playable box x ∈ [−80, 80] (east to 126 beside the mountains), z ∈ [−80, ~236]. Roughly 160 m × 316 m, plus the 58 m × 138 m Eastern Mountains. Four enemy roads (N/E/W/S); the south road is about 210 m to the Stronghold. | `js/map.js` (`BOUNDS`, `eastLimit`, `LANES`, `STRONGHOLD`, `FRONTIERS`) |
| Terrain | **Before this milestone:** flat ground at y = 0 with box "mountains". **Now:** `groundH(x, z)`, one pure height function (rolling hills, castle plateau, river valley, eastern mountains, rim hills), flattened under every build area and fixed structure. The renderer places everything on it; the simulation stays 2D. | `js/terrain.js` (new), `js/render.js` |
| Movement / collision | Hero steering, speed, river and bridge, map bounds, fort/stronghold walls and building footprints are 2D circle and box checks inside the simulation. | `js/world.js` (`updateHero`), `js/map.js` (`inRiver`, `BRIDGE`) |
| Combat | Auto-fire at the nearest target in range; weapons: bow, crossbow, fire arrows, multishot, storm (chain lightning); Royal Bow tiers 1–5 with finish, gem, string and trail styles. Enemies: grunt, brute, archer, raider, hound, Elder Treant (wave 5), the Warlord boss, fort and stronghold gates, towers and keep. | `js/world.js`, `js/config.js` (`WEAPONS`, `ROYAL_BOW`, `STYLES`, `ENEMIES`) |
| Economy | Gold (carried and banked), wood, stone, iron, people. Saddlebag carry cap. Lumber camps, quarries, gold and iron mines, warehouse haulers with wheelbarrows, per-minute rates panel, stock-pile advice. | `js/world.js`, `js/config.js` (`BUILDINGS`, `HERO_UPGRADES`, `SMITH`) |
| Building | Castle (4 levels), house, farm, warehouse, barracks, stable, range, blacksmith, lumber, quarry, gold/iron mine, bridge, outposts, towers, catapults. Six wall expansions (half widths 20 → 46 m) are separate from five gate/wall materials. Grid placement plus fixed pads. | `js/config.js`, `js/world.js` (`buildZones`, `place`) |
| AI | Villagers (chop, mine, farm, haul), knights, archers and raiders with orders (follow / defend / march), road guard stations, escort radius, siege columns from the Stronghold that attack structures. | `js/world.js` |
| Waves / campaign | Player-started waves on open lanes, frontiers that move south with claimed outposts, Mountain Fort, four mountain camps, final Stronghold siege, then the next land (Greenwood → Sunscorch → Frostmarch biomes). | `js/world.js`, `js/config.js` (`waveSpec`, `LEVELS`) |
| Saves | `localStorage` key `crownfall.v1`; `World.snapshot()` writes `v: 1` between waves; `World.load()` defaults every field added later, so older saves load. `main.js` `safeLoad` falls back to a new game on a malformed save. | `js/save.js`, `js/world.js` (`snapshot`, `load`), `js/main.js` |
| Asset loading | No external models or textures: every model is procedural geometry built at start-up. There are no GLB files in the repository. | `js/models.js` |
| Mobile input | Pointer-based virtual stick (drag anywhere), two-finger pan, pinch zoom, tap to select; menus stop propagation so they don't steer. **Now also:** right-side drag turns the chase camera. | `js/input.js` |
| Performance tools | **Before:** none. **Now:** `?perf` overlay (FPS, p95/p99 frame time, draw calls, triangles, entity counts, camera mode, DPR). | `js/main.js` |
| Tests | **Before:** none in the repository (ad-hoc headless sims only). **Now:** `node crownfall/tests/run.mjs`. | `crownfall/tests/run.mjs` |

Missing systems (not regressions): chunk streaming, real GLB assets and
skeletal animation, the five regional king models, manual melee/dodge or
ability buttons, authored exploration encounters, settlement dressing.

## Phases

| Phase | Scope | State |
|---|---|---|
| 0 | Audit, this plan, traceability, asset manifest, world layout, baseline, device matrix | done (this milestone) |
| 1 | Terrain and camera proof: terrain under the existing map, three camera modes plus cinematic reveals, camera-relative steering, right-side camera turn, terrain-aware camera, bow stowed on the back, landmark discovery | implemented; desktop-headless evidence only, **iPhone unverified** |
| 2 | Greenwood vertical slice: castle hill → farmland → Whispering Woods (ruin) → Fallen Village / raider camp → ridge raid with scout warning → King's River bridge defence → foothill overlook revealing the Mountain Fort | next |
| 3 | Streaming: chunked render working set over the persistent logical world; bounded AI and VFX | planned |
| 4 | Campaign expansion through data, one region at a time | planned |
| 5 | Art integration (real king GLBs once concepts exist) and release verification | blocked on art |

### Phase 2 task list (next session starts here)
1. Author the slice POIs in `world-layout.json` (working names): King's Farmland, Whispering Woods ruin, Fallen Village, the ridge, Old Stone Bridge.
2. Add an `encounters` system to `world.js`: data-driven, saved, with one-shot state (`pending → active → done`) so reloads don't respawn or duplicate loot.
3. Scout-raid encounter: a scout rides in, warns, the king's followers join, a small raider party on the ridge; uses the existing enemy types and camera combat mode.
4. Fallen Village: a burnt hamlet that restores (visible houses, villagers) once the camp is cleared; grants people.
5. Settlement dressing near the castle (fences, wells, hay, carts) from a bounded set, kept off build cells and formation paths.
6. Tests: encounter state survives save/reload; no duplicate spawns; the wave schedule is unaffected.

### Phase 3 outline
Keep the simulation authoritative and whole-map (it is small and cheap).
Chunk only the render working set: 32 m chunks, nearest 5×5 ring rendered
in full detail, the rest as merged low-detail scenery. Tests for chunk
lifecycle (load/unload idempotent, no stale loads, state preserved). Decide
on a larger map only after measuring the slice on a phone.

## Reversible defaults chosen (decision log)

| Date | Decision | Previous rule | New rule | Reason | IDs |
|---|---|---|---|---|---|
| 2026-10-04 | Keep the existing engine | — | three.js r186, no build step, no migration | It works on iPhone Safari today; a rewrite risks R07 | R01, R07 |
| 2026-10-04 | Terrain is a render/placement concern | flat y = 0 | `groundH` shared by renderer and tests; simulation stays 2D | Keeps every system and save untouched; slopes stay walkable by test | R23, R07 |
| 2026-10-04 | Build areas are flattened | — | castle grounds, outposts, pads, fort and stronghold sit on levelled ground | Placement and buildings must not float or clip | R23, R17 |
| 2026-10-04 | Camera rules are data in `camera.js` | one fixed 55° view | kingdom / adventure / combat + cinematic, timings in `CAM` | Spec asks for configurable data and testability | R09, R27 |
| 2026-10-04 | Mode triggers | — | combat when a live mobile enemy is within 14 m, held until none within 22 m for 2.5 s; adventure after 1 s outside every build area; menus and placement always use kingdom | Hysteresis per spec; building UI wins | R09, R27 |
| 2026-10-04 | Steering is camera-relative | stick = world axes | stick turned by the current view yaw (identity in kingdom view) | Behind-the-king control in chase views | R03, R28 |
| 2026-10-04 | Chase camera follows only while riding forward | — | auto-swing behind the king only while the stick points mostly ahead and the turn is under ~110° | Prevents riding-towards-camera loops | R27, R28 |
| 2026-10-04 | Manual camera button | — | cycles Auto → Kingdom → Adventure → Combat; menus still force kingdom | Spec asks for a manual control | R09 |
| 2026-10-04 | Waves while travelling | (implicit) | waves continue while the king is away; nothing pauses. Unchanged from before | Preserves the wave/siege balance and saves | R29 |
| 2026-10-04 | Discovery cinematic | — | 3.4 s, skippable by tap, never taken while an enemy is within 18 m; landmark beyond the claimed road stays hidden | No control loss in a fight; no spoilers through fog | R24, R09 |
| 2026-10-04 | Bow stowing | bow upright in hand at all times | stowed diagonally on the back 1.1 s after the last shot or while holding a tool | Fixes the vertical silhouette in the critique | R12, art contract |
| 2026-10-04 | Save version | `v: 1` | still `v: 1`; new field `discovered` defaults to `[]` | Additive change; old saves load (tested) | R07 |

## Ambiguities recorded

- **Five king appearances** — the five concept images are not in the pack (`references/INDEX.md` lists prototype screenshots only). R05 stays blocked; the current king is the procedural placeholder.
- **Macro map** — no concept image. `world-layout.json` describes the map that exists, not an invented one.
- **Region order** — the code's campaign today runs Greenwood → Sunscorch → Frostmarch as successive *lands* (biome swaps after each Stronghold), with the Eastern Mountains and Iron Hills inside the Greenwood map. The doc's continuous Greenwood → Mountains → Iron → Sunscorch → Frostmarch → Warlord journey needs a decision before Phase 4.
- **Perceived 5–10× size** — measured routes: castle to Stronghold gate about 200 m, castle to Mountain Fort about 70 m. No size multiplier is promised until a phone profile exists.
- **Manual attack, dodge, ability, dismount** — not added; auto-fire is still the only attack. Proposed for after the slice.
