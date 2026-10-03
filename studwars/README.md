# StudWars

A brick-built real-time strategy game for phones: **Knights vs Pirates**. Gather
bricks, build a base, raise an army and knock down the enemy fort.

**Play:** open `/studwars/` in a browser.

**Install on iPhone:** open it in Safari, tap *Share* → *Add to Home Screen*. It
then launches full screen and works offline.

## How it plays

- **Select:** tap a unit. Double-tap grabs every unit of that kind on screen.
  Long-press and drag (or tap **Group**) to box a crowd. **Army** selects all
  soldiers (double-tap it to jump to them), **Idle** cycles builders with nothing
  to do, and the hero button selects the King.
- **Orders:** with units selected, tap the ground to march (they fight what they
  meet), tap an enemy to attack it, or tap your own Keep to pull back.
- **Bricks:** builders gather from trees (small loads) and brick piles (big
  loads), then carry them to the Keep or a Brick Depot.
- **Buildings:** Farm (+4 army size), Barracks (trains Swordsmen, Archers and
  Knight Riders), Archer Tower (shoots invaders), Brick Depot (drop-off point).
  Tap a building to train from it; tap the ground to set its rally point.
- **Hero:** King Bramwell is strong and returns 25s after falling. His **Rally**
  heals nearby allies and makes them hit harder for 10s.
- **The Pirates** are run by the computer: Cutlass Pirates, Musketeers,
  Cannoneers (wreck buildings) and Captain Saltbeard, whose **Broadside** rains
  cannonballs. They attack in growing waves.
- **Studs** pop out of everything you smash; walk over them to collect.
- **Win** by destroying the Pirate Fort. Lose your Keep and it's over.

## Code

Plain ES modules, no build step. `three.js` is vendored in `js/vendor/`.

- `js/config.js` – every number: units, buildings, costs, difficulty.
- `js/map.js` – island generator (mirrored so both sides are fair).
- `js/world.js` – the simulation: orders, gathering, building, combat, fog.
- `js/path.js` – grid A* with path smoothing.
- `js/ai.js` – the computer opponent.
- `js/models.js` – every model, built from bricks in code.
- `js/render.js` – the 3D view, instanced figures, effects, fog-of-war shader.
- `js/ui.js`, `js/input.js`, `js/audio.js`, `js/main.js` – HUD, touch, sound, glue.

The simulation has no DOM, so a whole AI-vs-AI match can run in Node for testing.
Bump `CACHE` in `sw.js` on every release.
