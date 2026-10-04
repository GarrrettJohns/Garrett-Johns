# Crownfall — implementation status and resume note

## Resume note (read this first)

- **Branch:** `main` (every Crownfall change is pushed to `main`; GitHub Pages deploys it).
- **Milestone:** Phase 0 (audit) done, Phase 1 (terrain and camera proof) implemented. Next: Phase 2, the Greenwood vertical slice. The task list is in `implementation-plan.md` → *Phase 2 task list*.
- **Run the checks:** `node crownfall/tests/run.mjs` (no dependencies). Module syntax check: `node --input-type=module --check < crownfall/js/<file>.js`. A plain `node --check` misses ES module errors.
- **Perf overlay:** open the game with `?perf`.
- **Release rule:** bump `CACHE` in `crownfall/sw.js` on every release. Add any new JS file to its asset list.
- **Blockers:** the five king concept images and the macro map concept are not in the pack (R05). The procedural king stays a labelled placeholder.
- **Not verified:** anything on a real iPhone (see the device checklist below).

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
11. Rotate to landscape and back, background the app for 30 s, and return. No black screen, and no stuck touch.
12. Reload mid-build phase: the kingdom, discovered landmarks and resources are all kept.
13. Play for 15 minutes. Note whether fps falls as the phone warms.
