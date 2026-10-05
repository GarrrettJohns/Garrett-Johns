# Crownfall — implementation status and resume note

## Resume note (read this first)

- **Branch:** `main` (every Crownfall change is pushed to `main`; GitHub Pages deploys it).
- **Milestone:** milestone 4 (full graphics and world pass to the supplied images) below. Earlier: milestone 3 (kings), 2 (Greenwood journey), 1 (terrain and cameras). Next: a real-iPhone pass with the checklist below, then Phase 3 (render streaming). See `implementation-plan.md`.
- **Run the checks:** `node crownfall/tests/run.mjs` (no dependencies). Module syntax check: `node --input-type=module --check < crownfall/js/<file>.js`. A plain `node --check` misses ES module errors.
- **Perf overlay:** open the game with `?perf`.
- **Release rule:** bump `CACHE` in `crownfall/sw.js` on every release. Add any new JS file to its asset list.
- **Source art:** `docs/crownfall/asset-workup/` (checksums verified). Approved: `references/approved/` (five kings, mounted hero, world and cameras). Everything in `visuals/` is a proposal awaiting the user's selection (`data/design-selections.json`, all pending). Do not treat a proposal as approved.
- **Selections:** the user asked on 2026-10-05 for everything to match the supplied images, recorded in `asset-workup/data/design-selections.json` (soldiers as on the army sheets, villain option A, all sections as shown). Option B villains and Frontier Retinue soldiers stay concept history.
- **Blockers:** the unlock rule for the four non-Greenwood kings; real GLB production (everything is still built in code).
- **Not verified:** anything on a real iPhone (see the device checklist below).

## Milestone 4: full graphics and world pass to the supplied images (2026-10-05)

Requirement IDs: R08, R10, R15–R19, R21, R22, R24, R26, R36–R40.

### What changed
- **Troops** (`js/units.js`, from the six army sheets). Guard, archer and raider are built per kingdom: the Crown Guard in a great helm with a crest and a round crown shield, the Greenhood Archer, and the Royal Raider with a spear. There are Mountain, Iron Hills, Sunscorch and Frostmarch variants (peak, hammers, sun and snowflake shields, fur, curved swords). Your troops wear the kit of the king you ride, and every friendly soldier wears the blue alliance sash.
- **Enemies.** Swordsman with a kite shield, masked bowman, horned brute with a club, mace or ice hammer, an outrider on a barded horse, and a spiked-collar war hound. Each land has its own kit (Greenwood red, Sunscorch red and bronze with curved blades, Frostmarch white fur with crossbows). The Stronghold garrison and siege columns wear the Warlord's black-and-gold elite kit.
- **Bosses.**
  - **Commanders (option A):** the Bramble Captain, the Cliff Marshal, the Forge Tyrant, the Dune Conqueror and the Rime Regent.
  - **The Warlord:** a horned black helm with a gold crown band and a greatsword.
  - **Wave bosses:** wave 10 is the Bramble Captain, Dune Conqueror or Rime Regent depending on the land, and wave 15 the Forge Tyrant or Cliff Marshal.
  - **Elder Treant:** stays the wave-5 boss and is rebuilt from its sheet: a trunk body with a glowing heart, root legs, claw branches and a leaf crown.
- **Buildings** (`js/buildings.js`, from the building progression sheet):
  - castle, 4 levels (fortified keep → curtain wall and corner towers → inner halls → royal capital with the tall central spire);
  - barracks, 3 levels (hall → stone tower and yard → fortified complex);
  - towers: Archer, Sturdy, Timber Fort, Stone and Ballista;
  - siege: Catapult, Heavy Catapult and Trebuchet;
  - five wall materials (Palisade, Reinforced, Timber, Stone, Iron), each with matching corners and gatehouses that follow the gate upgrades;
  - timber-framed red-roofed cottages.
  - Blue cone roofs, gold finials and blue crown banners throughout.
- **The world** (`js/regions.js` plus the realm sites in `map.js`), after the approved world concept. All six realms now sit on the one map in the concept's layout:
  - **Greenwood:** around the castle, with hamlets and a turning windmill at the farmland.
  - **Eastern Mountains:** to the north-east, with the dark Mountain Hold and a snow-topped high viaduct.
  - **Iron Hills:** ash ground, glowing lava pools and the Iron Foundry with fire-lit windows and chimney smoke.
  - **Sunscorch:** to the south-west: sand, palms, cacti, red mesas, the oasis and the walled Golden City with gold domes and minarets.
  - **Frostmarch:** to the south-east: snow, snowy pines, a frozen lake with ice spikes, and the purple-spired Frost Citadel with glowing windows.
  - **Warlord's realm:** round the Stronghold: corrupted ground with ember cracks, dead trees, black rocks, spikes, broken carts and war banners.
  - Landmarks are solid and sit on levelled ground, and roads and pads stay clear (tested).
- **UI and icons.** The 25 icons are cut from the icon-language sheet (`icons/ui/`): resources, the bank chest, people, weapons, tools, Build/King/Orders/Posts/Follow, and the six region banners. They're used in the HUD pills, the round buttons (now gold-rimmed) and the orders menu. Costs use the coin icon. A boss health bar with a round portrait follows the portrait-UI sheet.
- **Model viewer:** `crownfall/tests/viewer.html?set=allies|enemies|bosses|treant|kings|buildings&type=castle|walls|siege` renders any rig or building on a plain backdrop for art review.

### Checks run
| Check | Result |
|---|---|
| `node crownfall/tests/run.mjs` | **30 passed, 0 failed** (terrain slopes, roads, pads, site props off roads and solid, saves, camera, journey, kings) |
| Module syntax check of every JS file | clean |
| Economy sim | unchanged (wave 1 pays 99, wave 2 pays 111) |
| Siege sim (60 troops ×3) | won 3 of 3 in 77 s |
| Browser runs (SwiftShader, 390×844 at DPR 2) | no page errors in kingdom, wave-10 battle, kit switch or the realm views |

### Measurements (headless, same method)
| Scene | Draw calls | Triangles |
|---|---|---|
| Idle capital | 101 | 277k |
| By the falls | 81 | 258k |
| Wave 9 fight, Combat view | 122 | 304k |

Unit rigs are 450–780 triangles each. Buildings range from about 300 for a cottage to 5.5k for the level-4 castle. Each realm landmark is merged into one or two meshes. Phone performance is still unverified.

### Evidence (`docs/crownfall/evidence/`)
`m4-troops-commanders.png`, `m4-elder-treant.png`, `m4-building-kit.png`, `m4-six-realms-birdseye.png`, `m4-sunscorch-golden-city.png`, `m4-frost-citadel.png`, `m4-iron-foundry.png`, `m4-warlord-realm.png`, `m4-mountain-hold.png`, `m4-ui-icons.png`, `m4-icon-cutouts.png`.

### Known limitations
- Everything is still built in code from simple shapes. It matches the sheets' shapes, colours and heraldry, not their sculpted detail.
- The realm landmarks are scenery: you can't yet enter the Golden City or the Frost Citadel, and they hold no encounters. Their kingdoms' kings and quests (Phase 4) are still to come.
- The realm painting appears on the home map (level 1). Later lands keep their whole-map biome.
- Regional building kits for the other four kingdoms (sandstone, snow and so on) aren't applied to your own buildings yet. Your castle is always the Greenwood kit.
- The weapon and building menus still show emoji icons. Only the HUD, buttons and orders use the cut icons.

## Milestone 3: graphics pass from the asset workup (2026-10-04)

Requirement IDs: R05, R08, R23, R24, R30, R39, R40.

### What changed
- **The five regional kings** come from the approved sheet (`asset-workup/references/approved/03_five_regional_kings.jpeg`, reconciled by spec 06). They share one rebuilt mounted rig with five colour kits (`KINGS` in `js/config.js`):
  - **Greenwood:** brown hair and beard, blue armour with gold trim, a red gold-hemmed cape with a white fur collar, a gold crown with a blue gem, and a white horse in blue and gold barding with the crown emblem.
  - **Mountains:** white hair and beard, blue and silver, pale-blue barding with the peak emblem.
  - **Iron Hills:** black hair and beard, black and bronze, a dark red cape, a dark brown horse in red barding with the crossed hammers.
  - **Sunscorch:** green, cream and gold, with the sun emblem.
  - **Frostmarch:** purple and silver with a silver crown and the snowflake emblem.
  - Each rig has legs in stirrups, pauldrons, a belt, reins, a breastplate and a face plate. That's about 3.3k triangles including all five bow tiers, well inside the 8–15k king and horse budget.
- **Which king you ride** is `hero.kit`. It is saved and carried to the next land, and older saves ride as the Greenwood king. For now the other four are a **developer-tools preview** (Pause → Developer tools → Ride as a regional king), because how they unlock is not decided.
- **The world, toward the approved world concept** (`04_world_and_cameras.jpeg`):
  - layered, grass-topped rock cliffs replace the grey boxes around the map;
  - round broadleaf oaks mix with the pines in the meadows;
  - the castle's turrets get tall blue spires with gold pennants, plus a tallest central spire with the royal banner from castle level 3;
  - falls pour off a rock cliff where the river rises at the foot of the mountains, with a scrolling water sheet, a foam pool and mist;
  - a sky gradient fades to the horizon;
  - the **Old Stone Bridge** (`landmark.old_stone_bridge`) stands west of the wooden bridge: a broken arched ruin and a discoverable landmark. It can't be crossed, so the forest still opens with the wooden bridge.
- **Asset manifest:** `crownfall/assets/manifest.json` now uses the workup's 552 stable IDs. 25 hero rows are built procedurally from the approved sheet, 126 rows have an older procedural stand-in, and 401 are not in the game. `production_status` stays `not_produced` everywhere: there are no GLB files.

### Not done, waiting on selections (`asset-workup/data/design-selections.json`, all still pending)
Soldier kit A or B per region; villain A or B per region (Bramble Captain or Thorn Knight, and so on); enemy soldiers; the regional building kits; the environment travel views; UI density; and the icon style. Until these are chosen the troops, enemies, houses and barracks keep their current placeholder looks. The Elder Treant stays the wave-5 boss, and the Warlord stays the final boss.

### Reference conflicts resolved (spec 06)
- The Greenwood king has a blue gem, not the early portrait's red.
- The Mountain King is white-haired.
- The Iron King is a playable ally, despite his red and black.
- The Desert King is bearded and green.
- The Frost King is dark-haired, in purple and silver, on a light horse.
- The crown is always five-pointed; engraving and gem detail are simplified for the phone.

### Checks run
| Check | Result |
|---|---|
| `node crownfall/tests/run.mjs` | **30 passed, 0 failed**. New: every king kit is complete and builds a rig under 8k triangles; the chosen king is saved, carried to the next land and defaults safely |
| Module syntax check of every JS file | clean |
| Workup checksums (`data/package-checksums.json`) | all match |
| Economy sim | unchanged (wave 1 pays 99, wave 2 pays 111) |
| Siege sim (60 troops ×3) | won 3 of 3 in 74–78 s |
| Browser run (SwiftShader, 390×844 at DPR 2) | no page errors |

### Measurements (headless, same method)
| Scene | Draw calls | Triangles |
|---|---|---|
| Idle capital | 100 | 325k |
| By the falls, Adventure view | 86 | 309k |
| Wave 9 fight, Combat view | 123 | 331k |

About 75k more triangles than milestone 2, mostly the layered cliffs (306 × 96 triangles, counted again for the shadow map) and the oaks. That's still unverified on a phone. If an older iPhone struggles, the first things to cut are cliff shadows and the far rim cliffs.

### Evidence (`docs/crownfall/evidence/`)
`m3-five-kings.png` (all five kings, side and rear three-quarter views), `m3-world-birdseye.png`, `m3-castle-spires.png`, `m3-falls.png`, `m3-old-stone-bridge.png`, `m3-king-adventure-cliffs.png`.

### Known limitations
- The kings are a procedural approximation of the concept art, not sculpted models. Faces, fur and armour detail are blocky, and they show no expressions.
- The other four kings have no unlock path yet.
- The east rim beyond the mountains reads as a large snow slab from very high views.
- Regional bow variants (25 looks) are not separate yet. The existing finish, gem, string and trail styles still apply.

## Milestone 2: the Greenwood journey (2026-10-04)

Requirement IDs: R02, R06, R11, R20, R23, R24, R25, R26, R29 (and R03/R27 camera retune).

### The route as built (working names)
The route keeps the existing map: north river and forest, the eastern mountains, the road south. The handoff's order was adapted to that geography; the ridge raid now comes after the woods, which the doc allows as a suggestion.

| # | Place | Where (m) | What happens | Opens |
|---|---|---|---|---|
| 1 | Castle hill | 0, 0 | The existing capital and tutorial | start |
| 2 | King's Farmland | −64, 30 (west) | Fields, barn, hay, scarecrow. Riding in gives a bundle of wood and the farming hint | after wave 1 |
| 3 | The Fallen Village | −63, −30 (north-west) | Three burnt cottages and raider tents, with five raiders camped there. Beating them rebuilds the village (cottages, well, garden, laundry, chimney smoke), and 3 villagers join the kingdom plus a coin reward | after wave 2 |
| 4 | King's River crossing | the bridge | The existing bridge (and its wave defence on the north road). Riders stand on its deck | build the bridge |
| 5 | The Old Ruin, Whispering Woods | −36, −70 (forest) | Columns and an arch in a clearing, with a chest of coins. The reveal looks across the valley to the raiders' watchtower on the East Ridge | the bridge |
| 6 | The East Ridge raid | 51, −37 | A scout rides in to warn the king, and every soldier in the field falls in behind him. Six raiders hold the ridge under a red watchtower. Clearing it flies the king's banner and the scout joins the army | the ruin (or wave 4) |
| 7 | The Foothill Overlook | 54, −28 | A cairn where the king plants his flag. The reveal looks down on the Mountain Fort, and the journey ends | the ridge |

A light beam and an edge-of-screen arrow mark the next place, between waves only.

### Rules recorded
- **Waves and encounters coexist (R29).** Camp guards never count towards a wave, and a wave ends with them still standing. Waves are still started by the player. A wave goes on while the king is away, and the first time he rides far out mid-wave a toast says so.
- **Rewards are paid once.** Each encounter goes locked → open → done. The state and the number of guards still standing are saved. After a reload a half-cleared camp keeps its losses, and a finished one never comes back.
- **Guards need beating.** If a camp is removed from the world without a fight (dev tools, reloads), it respawns rather than paying out.
- **Solid props.** Cottages, the well, the cart, the barn, columns, the arch, the watchtower and the cairn are solid circles for the king (`SITE_PROPS` with `r > 0`), and all of them are tested to stay off the roads.

### Code paths
| What | Where |
|---|---|
| Encounter data and opening rules | `crownfall/js/slice.js` (`ENCOUNTERS`) |
| Sites and props (one list shared by simulation and renderer) | `crownfall/js/map.js` (`SITES`, `SITE_PROPS`; scenery is cleared around sites) |
| Encounter simulation, guards, scout, rewards, save | `crownfall/js/world.js` (`updateEncounters`, `spawnGuards`, `finishEncounter`, `sendScout`, `updateScout`, `nextEncounter`; `enc` and `encLeft` in `snapshot`/`load`; prop collision in `updateHero`) |
| East Ridge and levelled sites | `crownfall/js/terrain.js` (`TERRAIN.ridge`, site `flat()`s) |
| Prop models | `crownfall/js/models.js` (`fieldGeo` … `cairnGeo`, `mergePlaced`) |
| Site meshes, before/after swap, beam, smoke | `crownfall/js/render.js` (`buildSites`, `syncSites`) |
| Banners and reveals | `crownfall/js/main.js` (`encounter`, `scout`, `journeyDone` events) |
| Next-place arrow | `crownfall/js/ui.js` (`updateThreats`) |
| Combat camera retune: further back and higher so the king blocks less | `crownfall/js/camera.js` (`CAM.combat`: dist 10 → 12.5, height 5.6 → 7.4, shoulder 1.4 → 1.9) |

### Checks run
| Check | Result |
|---|---|
| `node crownfall/tests/run.mjs` | **28 passed, 0 failed**. The 10 new tests cover: opening order; guards never hold up a wave; village pays once and not again after reload; half-cleared camp survives reload; a camp wiped without a fight comes back; ruin → scout → troops join; ridge → overlook reveals the fort and ends the journey; **a bot rides the whole route** (castle → farmland → village → bridge → ruin → bridge → ridge → overlook → home) with the stick, never stuck, never on a slope over the limit; props solid and off the roads; pre-journey saves load |
| Module syntax check of every changed JS file | clean |
| Headless economy sim | unchanged: wave 1 pays 99 gold, wave 2 pays 111 |
| Headless smoke sim | fort blocks at x 69.8. In a fresh world the river still blocks at z −50.4. In the sim's own run the world had already been defeated in its unattended wave 3 (it varies run to run) |
| Headless siege sim (60 troops ×3) | won 3 of 3 in 76–78 s, castle untouched, the same as before |
| Browser run (Playwright + Chromium SwiftShader, 390×844 at DPR 2, touch) | no page errors through the whole route |

### Evidence (`docs/crownfall/evidence/`)
- `m2-farmland.png`: King's Farmland from the Kingdom view.
- `m2-fallen-village-raiders.png` / `m2-fallen-village-restored.png`: the same view before and after freeing the village (rebuilt cottages, garden, laundry, smoke, reward coins).
- `m2-ruin-whispering-woods.png`: the ruin in its forest clearing, Adventure view.
- `m2-ruin-reveal-watchtower.png`: the reveal from the ruin across the river to the ridge watchtower.
- `m2-scout-warning.png`: the scout's warning.
- `m2-ridge-raid-combat.png`: the Combat view (retuned) on the ridge with knights, archers and the scout.
- `m2-overlook-reveals-fort.png`: the overlook reveal of the Mountain Fort.

### Measurements (headless, not a phone; same method as milestone 1)
| Scene | Draw calls | Triangles | Entities |
|---|---|---|---|
| Idle capital, Kingdom view | 97 | 251k | 8 foes, 3 villagers |
| By the Fallen Village, raiders posted | 94 | 247k | 13 foes |
| Wave 9 fight plus a camp, Combat view | 123 | 272k | 34 foes |

The sites add at most three merged meshes each, plus the beam. Fewer triangles than milestone 1 because trees were cleared from the sites.

### Known limitations
- **iPhone unverified**, as before.
- The slice runs on every land (the map repeats with a new biome after each Stronghold), so the farmland and village also appear in Sunscorch and Frostmarch.
- The scout goes straight to the king and only avoids the river by stopping at its bank. If the king is across the river he gives his warning after 40 s wherever he is.
- People from the village can push the head count over the beds (the HUD shows e.g. 7/4). Growth still needs beds.
- Settlement dressing (R26) is limited to the farmland and the village. Houses inside the walls are unchanged.
- There is no Attack, Ability or Dodge input yet. The ridge fight is still auto-fire plus troops.

## Milestone 1: terrain and camera proof (2026-10-04)

Requirement IDs: R03, R09, R12 (bow stow), R23, R24, R27, R28, R35 (tooling).

### Code paths
| What | Where |
|---|---|
| Height function, levelled build areas, bridge deck | `crownfall/js/terrain.js` (`groundH`, `footing`, `slopeAt`, `standH`, `setBridge`, `TERRAIN`) |
| Ground mesh, everything placed on the land, faceted peaks, camera poses, cinematic, terrain lift, ground raycast | `crownfall/js/render.js` (`updateCamera`, `cinematic`, `skipCinematic`, `turnBy`, `rayGround`, `STOW`), `crownfall/js/models.js` (`peakGeo`, `stow` parts) |
| Camera state machine, steering conversion | `crownfall/js/camera.js` (`CAM`, `stepCam`, `cycleOverride`, `stickToWorld`) |
| Landmarks and discovery | `crownfall/js/map.js` (`LANDMARKS`), `crownfall/js/world.js` (`updateDiscovery`, `discovered` in save) |
| Wiring, camera button, discovery banner, `?perf` | `crownfall/js/main.js`, `crownfall/js/ui.js` (`setCamLabel`), `crownfall/index.html` (`#btn-cam`), `crownfall/style.css` |
| Right-side drag turns the camera | `crownfall/js/input.js` (`turnMode`, `takeTurn`) |
| Tests | `crownfall/tests/run.mjs` |

### What is playable
- The map now rolls. The castle sits on a flat-topped hill. The river runs in a valley crossed by the wooden bridge. The Greenwood forest beyond is hillier. The eastern mountains climb past the Mountain Fort as faceted snowy peaks. Rim hills hide the map edge and open at each enemy road. Every build area, pad, outpost, the fort and the Stronghold sit on levelled ground.
- **Camera** (button beside pause, top right):
  - *Auto* picks the view: Kingdom inside the walls or outpost land, Adventure once the king rides out, Combat when an enemy is within 14 m. Combat holds until none is within 22 m for 2.5 s.
  - Tapping the button cycles to fixed Kingdom, Adventure or Combat, then back to Auto.
  - Opening a build sheet or placing a building always returns to the Kingdom view.
- In the chase views the stick steers relative to the camera, and a drag on the right 40 % of the screen turns the camera.
- Riding near a landmark for the first time shows a skippable reveal: a banner plus a 3.4 s camera rise. It is skipped when an enemy is within 18 m. The six landmarks are the Greenwood, the Mountain Fort, Riverford, the Iron Hills, Stonehill and the Stronghold. Landmarks beyond the claimed road stay hidden.
- The bow hangs diagonally across the king's back when he isn't shooting or holding a tool. He draws it the moment he fires.

### Checks run
| Check | Result |
|---|---|
| `node crownfall/tests/run.mjs` | **18 passed, 0 failed**: roads walkable; ridable map within slope limits (0.65, mountains 0.75); castle grounds level (< 0.5 m within the widest walls); pads level; river below water; footing never floats; bridge deck carries riders; 7 camera/input tests; legacy save, discovery once and persisted, fog hides the Stronghold, malformed save |
| Module syntax check of every changed JS file | clean |
| Headless economy sim (scratch `econ.mjs`) | unchanged: wave 1 pays 99 gold, wave 2 pays 111 |
| Headless smoke sim (scratch `smoke.mjs`) | fort blocks at x 69.8 (fort x 70); river blocks at z −50.4 (river −53); waves 1–2 held, wave 3 lost with no defence built (as before) |
| Headless siege sim (scratch `siege.mjs`, 60 troops ×3) | won 3 of 3 in 77–78 s, castle untouched, 0–1 structures wrecked, in line with the balance runs before this milestone (won at 58–62 troops in 80–87 s) |
| Browser run: Playwright + Chromium (SwiftShader software GL), 390×844 at DPR 2, touch | no page errors; evidence below |

### Evidence (`docs/crownfall/evidence/`)
- `m1-kingdom-castle-hill.png`: the high Kingdom view on the castle hill.
- `m1-adventure-road-south.png`: the Adventure chase view on the south road, bow stowed diagonally.
- `m1-adventure-river-bank.png`: the Adventure view north over the river valley and forest hills.
- `m1-bridge-crossing.png`: the king and four followers on the bridge deck (no sinking into the river bed).
- `m1-combat-wave.png`: the Combat view behind the king during a wave, bow drawn, enemies ahead.
- `m1-cinematic-mountain-fort.png`: the discovery reveal of the Mountain Fort.

### Baseline measurements (headless, not a phone)
Taken with the `?perf` overlay under software rendering. FPS and frame times are meaningless here (3–4 fps on SwiftShader). Draw calls and triangles are the useful numbers.

| Scene | Draw calls | Triangles | Entities |
|---|---|---|---|
| Idle capital, Kingdom view | 90 | 270k | 8 foes (camps), 3 villagers |
| Travel on the south road, Adventure view | 75 | 237k | 8 foes, 3 villagers |
| Wave 9 fight, Combat view | 98 | 273k | 23 foes |

No measurement was taken before the terrain change, so the terrain's own cost isn't isolated. The ground mesh replaced the flat plane and adds no draw calls of its own.

### Known limitations
- **iPhone performance and touch feel are unverified.** Nothing in this milestone was run on a phone.
- The map-edge crags beside the mountains are still grey boxes. They read as cliffs from the high view and as walls up close.
- The combat camera sits close: on a narrow portrait screen the king and horse cover the lower centre. The shoulder offset helps, but it needs a playtest. Tuning lives in `CAM.combat`.
- The simulation is 2D: height is visual and does not slow the horse uphill. Collision is unchanged and agrees with the visuals because blocked areas (river, fort, walls, mountains) are the same shapes as before.
- No chunk streaming yet (Phase 3). The map is small enough to keep fully loaded today.
- Auto-fire is still the only attack. No Attack, Ability or Dodge buttons yet.
- The Greenwood slice encounters (scout raid, Whispering Woods ruin, Fallen Village) are not built.
- All models are procedural placeholders (`crownfall/assets/manifest.json`).

## Proposed device matrix (owner to confirm)
| Tier | Device | Browser | Target |
|---|---|---|---|
| Newer | iPhone 15 / 16 class | Safari (iOS 17–18), home-screen PWA | 60 fps goal |
| Mid | iPhone 12 / 13 class | Safari | 45–60 fps |
| Older | iPhone XR / 11 class | Safari | ~30 fps fallback |
| Desktop | any current Chrome / Safari / Firefox | — | functional only |

## iPhone device test checklist (unverified, run on each device above)
Record the device, iOS version, Safari or home-screen launch, Low Power Mode, and whether the phone was warm.

1. Open `…/crownfall/?perf`, start a new game, wait 30 s in the capital. Note fps, p95 and p99.
2. Ride out of the south gate: the view should ease into the chase camera within about 1 s and not jerk. Ride around the castle hill and down to the river. The horse must never sink into or float above the ground.
3. Hold the stick back (towards the camera) for 5 s. The king should ride towards you without the camera spinning.
4. Drag on the right side of the screen while riding: the camera turns and the king keeps moving. A quick tap on that side still selects.
5. Use both thumbs at once (stick plus camera turn). Neither should steal the other.
6. Start a wave and ride at the enemies: the Combat view comes in and holds through the fight. Note fps, p95 and p99 in the largest fight you can reach.
7. Tap 🔨 mid-ride: the view returns to Kingdom at once and the sheet doesn't steer the king. Close it: the chase view comes back.
8. Tap the camera button through Kingdom, Adventure, Combat and Auto while riding. Movement and firing must not stop or double.
9. Ride to the Mountain Fort for the first time: the reveal plays, and a tap skips it.
10. Cross the bridge with followers: everyone stays on the planks.
10a. Ride the journey (farmland → village → ruin → ridge → overlook). Each reveal plays once, the beam and arrow lead on, the village rebuilds, and the scout's troops follow you onto the ridge.
11. Rotate to landscape and back, background the app for 30 s, and return. No black screen, and no stuck touch.
12. Reload mid-build phase: the kingdom, discovered landmarks and resources are all kept.
13. Play for 15 minutes. Note whether fps falls as the phone warms.
