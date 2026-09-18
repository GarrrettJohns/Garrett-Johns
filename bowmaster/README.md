# Bowmaster Prelude

A modern remake of the Flash-era archery defence game, rebuilt as a touch-first
web app. No engine, no build step, no downloaded assets — every sprite is drawn
with canvas paths and every sound is synthesised in the Web Audio API, so the
whole game is a handful of small text files.

**Play:** open `/bowmaster/` in a browser.

**Install on iPhone:** open it in Safari, tap *Share* → *Add to Home Screen*.
It then launches full screen with no browser chrome and works offline.

## How it plays

Drag anywhere to draw the bow — direction sets the angle, distance sets the
power — and release to loose. Arrows arc, so lead your targets. Headshots do
far more damage and pay 50% more gold. Between waves you spend that gold on
your bow, your keep, militia to hold the line, and five kinds of special arrow
(bodkin, fire, frost, bomb, storm volley), each on its own cooldown. Waves are
endless, with a champion every fifth one.

## Layout

The battlefield uses a virtual camera. Zoom is picked so a soldier is a
readable size on screen, with a floor on the visible height so an arrow's arc
still fits in frame. That makes the field shorter on a narrow screen, so unit
speeds and projectile physics are all multiplied by a field factor — a wave
takes the same time to reach the keep in portrait as in landscape.

Landscape puts the canvas full screen with the controls floating over it.
Portrait caps the battlefield to a wide band and gives the space beneath it to
a thumb-sized aim pad, so your hand never covers the fight.

## Files

| File | What it holds |
| --- | --- |
| `js/config.js` | All balance data: enemies, bosses, arrows, upgrades, wave generation |
| `js/world.js` | The simulation — units, projectiles, hit zones, damage, waves |
| `js/render.js` | Canvas drawing: parallax background, unit rig, effects |
| `js/ui.js` | DOM overlay: HUD, ammo dock, shop, menus |
| `js/main.js` | Boot, game loop, input, run flow |
| `js/audio.js` | Runtime sound synthesis |
| `js/save.js` | Local persistence: settings, best run, run-in-progress |
| `sw.js` | Offline cache. Bump `CACHE` whenever an asset changes |

Icons are generated, not hand-drawn; they are committed as PNGs since nothing
here has a build step.
