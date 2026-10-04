> Updated source note: the four original rendered concepts are now supplied under `references/approved/`. Any historical missing-reference statement below is superseded by spec 06. New regional armies and villains remain proposals pending selection.

# 04 — Implementation and validation

## Phase 0: inspect and preserve
Audit repository instructions, package scripts, renderer, coordinate scale, scene setup, terrain, movement, collisions, army AI, wave state, resource economy, save format, touch controls, asset handling and deployment. Produce a feature map citing actual files. Record missing systems separately from regressions. Capture current gameplay and benchmark a reproducible normal scene and largest current fight. Work in a branch, preserve a rollback point and run existing appropriate checks. Inspect saves before migration; do not discard player progress.

Deliver: `implementation-plan.md`, initial traceability, asset manifest, baseline measurements and proposed device matrix. Repository access is required; none was provided in this package.

## Phase 1: terrain and camera proof
Create a small representative area with slopes, riverbanks, trees and a fort view. Demonstrate king/horse on terrain, follower movement, three camera states and cinematic overlay, touch movement/aim, camera collision and return to building view. Use existing models initially if needed, labeled as placeholders. Do not generate six full regions yet.

Acceptance: traverse slopes and bridge with no sinking, hovering, trapping or unwalkable route; repeated camera changes do not interrupt movement or duplicate attacks; screen remains readable in portrait; camera cannot pass through terrain; menus consume input appropriately.

## Phase 2: complete Greenwood vertical slice
Connect the opening route from the world spec. Include harvesting, carried resources, banked gold, building/upgrades, recruitment/orders, wave defense, exploration encounter, regional landmark reveal, close mounted combat and return home. Replace main king/horse when valid assets are available; otherwise show the missing model deliverable explicitly. Introduce settlement dressing and clear route/build zones.

Acceptance: new player can gather, build, recruit, ride with troops, fight, collect loot, cross bridge, reveal Mountain Fort, return and save/reload without losing progression. Strategic and adventure loops share one state. Existing wave-5 Treant remains reachable and correct. No placeholder claimed final art.

## Phase 3: streaming and sustained mobile verification
R34: separate persistent logical world state from loaded rendering and active simulation. Load nearby chunks, unload distant visuals, retain authoritative harvested/build/enemy/claim state and saved progression. Stage loads to avoid main-thread stalls; pool frequently spawned arrows/chips/coins. Define collision/nav coverage before entering a chunk; if loading is late, use a designed transition rather than letting the horse fall into unloaded terrain. Reject stale async loads after a player changes direction. Dispose unused resources without deleting shared assets still referenced.

R35: use LOD, instancing where appropriate, bounded AI updates, cheaper distant animation, capped VFX, controlled shadows and resolution scaling. Profile rather than adopting a technology label as the solution. Audit current browser renderer support; keep iPhone compatibility as a gate. Avoid a renderer rewrite simply to use WebGPU.

Large-battle proposal from discussion: 25–40 nearest fully simulated fighters, another ~40 simplified, far army silhouettes beyond. These are experiments, not final caps. Promotion/demotion must preserve health, allegiance, position and event state; cheap background armies cannot secretly deal invisible damage. Bound particles and simulation independent of total campaign area. Avoid unbounded content memory during travel.

Acceptance: repeated chunk crossings and fast backtracking preserve harvested resources, constructed buildings, ownership and encounter state; troop paths remain valid; active resources plateau within the measured working set; no duplicate loot/spawns; no context-loss crash; quality fallback preserves readable combat. Record real-device evidence and unresolved failures.

## Phase 4: expand campaign through data
After slice validation, produce region coordinates/graph, POIs, authored encounters, terrain/chunk data, king unlock arcs and enemy siege routes. Implement one region at a time with the same acceptance gates. Integrate the five actual king visual references when supplied. Add regional mechanics incrementally. Keep Warlord realm distinct from playable kings. Preserve all inventoried buildings and weapons across implementation phases rather than dropping them during slice focus.

## Phase 5: art and release verification
Complete rigged assets, animations, icons, upgrade models, VFX and UI; remove or deliberately retain every placeholder. Validate asset scale and sockets against engine. Verify saves, all five kings, bow/customization combinations, all building tiers, waves, outposts, troop orders and final siege. Deliver a feature status report with evidence and known limitations. Do not call the entire vision built merely because the vertical slice is polished.

## Performance test protocol
60 FPS newer-phone and ~30 FPS fallback are desired targets. Neither the 5–10× perceived-size goal nor the original triangle estimates demonstrate feasibility. Select supported iPhone models and iOS/browser versions; record exact physical device, settings and thermal conditions.

For each of these scenarios measure frame-time distribution (including p95/p99), load/transition stalls, draw calls, triangles, active AI, active chunks, resolution and approximate resource working set where observable:
- Idle/working capital with HUD and workers.
- Sustained horse travel and multiple chunk boundaries.
- Closest combat view with representative troops, projectiles and effects.
- Largest supported wave/siege.
- Open build/king/orders sheets during gameplay.
- Repeated region transition, save/reload and 15-minute sustained session.

60 FPS implies a ~16.7 ms total frame budget; 30 FPS ~33.3 ms. Set exact acceptance thresholds after baseline, accounting for thermal slowdown. Document initial download, first playable time and streamed-data volume; no unmeasured universal memory/download cap is imposed here. Use desktop automation for functional coverage, then actual iPhone testing for touch/browser/performance. Report unavailable real-device checks as unverified.

## Functional regression checks
Check automatic fire, fire arrows, three-arrow multishot, chain lightning, axe/pickaxe hit timing, resource capacity/banking, construction costs, upgrade costs, recruitment/population, wall material versus expansion, outpost ownership, gate/tower/catapult behavior, boss rewards and persistent enemy progress. Test new save, legacy save, malformed save handling and cancellation during transition. Test background/resume, viewport changes and touch cancellation. Keep targets/hitboxes consistent through simulation LOD changes.

## Milestone evidence format
Every milestone report includes: commit, requirement IDs, code paths, what is playable, commands/checks run with results, screenshots or short capture, measured device/browser performance, unresolved issues, missing art and next step. A requirement is done only with implementation plus evidence; planned or stubbed is not done.
