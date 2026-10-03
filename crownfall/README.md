# Crownfall

A low-poly 3D kingdom defence game for phones. You ride the king around a
grassland kingdom beside a forest. Enemies drop coins that stack up on your
horse, and you spend them by standing on build pads. Workers bring wood and
stone in from the forest and the quarry. Between waves you grow the kingdom,
and when you're ready you start the next attack.

**Play:** open `/crownfall/` in a browser.

**Install on iPhone:** open it in Safari, tap *Share* → *Add to Home Screen*.
It then launches full screen and works offline.

## How it plays

- **Ride:** drag anywhere to steer. The king shoots the nearest enemy on his own.
- **Gold:** kills drop coins, and miners fill a pile at the gold mine. A
  magnet pulls coins in, and the stack on the horse holds as much as your
  saddlebags allow.
- **Pads:** stand on a dashed pad to pay coins into it. When the gold is
  in, and the kingdom has any wood and stone the pad needs, it's built.
- **Menus:** ride up to a built building to open its upgrades. Upgrades can
  be paid off a bit at a time.
- **Build:** between waves, tap 🔨 to place houses, farms, barracks, a stable
  and an archery range anywhere inside the walls.
- **People:** houses bring villagers, and farms make families grow faster.
  Villagers work the mine, cut wood in the forest and stone at the quarry, then
  carry it home over the bridge. Soldiers are villagers who enlist:
  - **Knights** follow the king.
  - **Archers** go and man the towers.
  - **Raiders** charge the nearest enemy.
- **Waves:** fifteen waves, with a boss on waves 5, 10 and 15. New fronts open
  from the east, the west and finally the forest. If the castle falls you
  retry the wave from your last save. After wave 15 the waves keep coming.

## Files

| File | What it holds |
| --- | --- |
| `js/config.js` | All balance data: buildings, upgrades, units, enemies, wave generation |
| `js/map.js` | Layout: enemy roads, river, bridge, wall rings, fixed pads, scenery |
| `js/world.js` | The simulation: king, economy, villagers, army, enemies, waves, saving |
| `js/models.js` | Every 3D model, built from primitives in code |
| `js/render.js` | three.js scene, instanced unit rigs, coins, effects and camera |
| `js/ui.js` | DOM overlay: HUD, objective, building menus, build picker |
| `js/input.js` | Floating thumb joystick, pinch zoom, keyboard |
| `js/main.js` | Boot, the game loop, screens and flow |
| `js/audio.js` | Runtime sound synthesis |
| `js/save.js` | Local persistence |
| `js/vendor/three.js` | The parts of three.js the game uses, bundled into one file |
| `sw.js` | Offline cache. Bump `CACHE` whenever an asset changes |

`world.js` never touches three.js or the DOM. That means the whole simulation
can run in Node, which is how the balance was tuned: a scripted player rides,
builds and fights through the real waves.

To rebuild the three.js bundle after the game starts using a new class, list
every `THREE.*` name used in `js/` and bundle just those exports with esbuild:

```sh
names=$(grep -ohE "THREE\.[A-Za-z0-9_]+" js/*.js | sort -u | sed 's/THREE\.//' | paste -sd, -)
echo "export { $names } from 'three';" > entry.js
npx esbuild entry.js --bundle --format=esm --minify --outfile=js/vendor/three.js
```
