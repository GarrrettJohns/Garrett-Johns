# Crownfall

A low-poly 3D kingdom defence game for phones. You ride the king around a
walled kingdom, gather gold from fallen enemies, grow a town and its
industries, and fight your way down the enemy's road to besiege their
stronghold. Each stronghold you take moves the king and his army on to a new
land.

**Play:** open `/crownfall/` in a browser.

**Install on iPhone:** open it in Safari, tap *Share* → *Add to Home Screen*.
It then launches full screen and works offline.

## How it plays

- **Ride:** drag anywhere to steer. The king shoots the nearest enemy on his own.
- **Look:** drag with two fingers to move the camera on its own, and pinch to
  zoom. Tap 👑 to snap back to the king. On a desktop, right-drag pans.
- **The castle:** tap it. Its **King** tab upgrades the bow, horse and weapons,
  **Army** trains knights, archers and raiders, and **Castle** upgrades the
  keep, walls and gates. Nothing is bought in parts: you need all the gold,
  wood and stone first.
- **Gold:** at first gold comes only from waves: kills drop coins and every
  cleared wave pays a bonus. Clearing the Mountain Pass (it needs wood) opens a
  highland with a gold mine and quarries. Wave 5's boss, the Elder Treant,
  drops a pile of logs.
- **Pads:** a pad turns green when you can afford it. Stand on it to build.
- **Building:** between waves tap 🔨, pick a building, then drag it on the grid
  and tap *Build here*. There is always room for the king to ride between
  buildings.
- **People:** houses bring villagers, and farms make families grow faster.
  Villagers work the mines, cut wood and stone, and haul it to the castle or the
  nearest outpost. Soldiers are villagers who enlist:
  - **Knights** follow the king.
  - **Archers** go and man the towers.
  - **Raiders** charge the nearest enemy.
- **Waves:** when a wave starts, red arrows march down the roads it's coming
  in on, and markers round the screen edge point to each group off screen.
- **Healing:** during a wave the king heals only inside the green square at the
  castle. Between waves he heals anywhere. If the king falls during a wave, the
  wave is lost and starts over from just before it.
- **Defences:** towers and gates upgrade with gold first, then wood (castle
  level 2), then stone, then a heavy final tier. The objectives have you shore
  up your defences with wood before going after stone.
- **The road to the stronghold:** the south road leads to the enemy's
  stronghold. After enough waves, build outposts along it: Riverford (wave 4),
  Stonehill (wave 9) and the Siege Camp (wave 14). Each one claims more land
  (the fog rolls back), opens new mines and camps, and pushes back where
  southern enemies muster. Its watchtower also shoots at passing enemies.
- **The siege:** with the Siege Camp built, the next battle is the siege. A
  lighter attack hits home while the king rides out to break the stronghold's
  gate and towers. The gate's fall brings out its warlord, and bringing down
  the keep wins the level.
- **Levels:** the king's upgrades, weapons and army march on to the next
  land: the Greenwood, then the Sunscorch desert, then the Frostmarch. Each is
  tougher, and you build a new kingdom in each.

## Files

| File | What it holds |
| --- | --- |
| `js/config.js` | All balance data: buildings, upgrades, units, enemies, wave generation |
| `js/map.js` | Layout: enemy roads, the road to the stronghold, outposts and frontiers, river, square walls, fixed pads, scenery |
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
