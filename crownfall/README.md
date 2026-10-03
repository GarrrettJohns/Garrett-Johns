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
  and **Castle** upgrades the keep, walls and gates. Nothing is bought in
  parts: you need all the gold, wood and stone first.
- **The army:** build Barracks (the game nudges you after wave 2) and tap it to
  train knights, archers and raiders. Each barracks raises the army cap.
- **Gold:** at first gold comes only from waves: kills drop coins and every
  cleared wave pays a bonus. Wave 5's boss, the Elder Treant, drops a pile of
  logs.
- **The highland:** a big rocky region east of the castle, walled in by crags.
  The only way in is a gorge sealed by a rockfall; clearing the Mountain Pass
  (it needs wood) opens it. Three enemy camps hold the trail inside, guarding
  the gold mine and two quarries, which trails lead to.
- **The king gathers:** standing still by forest trees he chops wood with an
  axe, and by highland boulders he mines stone with a pickaxe. He carries the
  load (20, more with saddlebags) and banks it at the castle or an outpost.
- **Pads explain themselves:** ride near any build pad and a card says what it
  does and what it costs.
- **Pads:** a pad turns green when you can afford it. Stand on it to build.
- **Building:** between waves tap 🔨, pick a building, then drag it on the grid
  and tap *Build here*. There is always room for the king to ride between
  buildings.
- **Workers:** tap a gold mine, lumber camp, quarry or farm to add or remove
  workers with − and +. Each worker adds output, each building has a set number
  of slots (upgrade it for more), and only free villagers can be assigned. More
  houses means more villagers means faster resources. The top bar shows how
  many villagers are free.
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

## Developer tools

Pause, then tap **🛠 Developer tools** at the top of the pause menu. From
there you can:

- Jump to any level, with a king upgraded to match.
- Jump to a key battle: east front, Treant, west front, boss, forest front,
  or the siege.
- Hand out gold, wood and stone, max out the king, add soldiers, claim every
  outpost, or upgrade the castle and walls.
- Win the level or lose the current wave on the spot.

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
