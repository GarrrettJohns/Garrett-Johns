# 08 — Complete production contract

## Deliverable classes
Reference JPEG: existing source art. Proposal PNG: new generated mockup pending selection. Runtime model: GLB with geometry, palette/materials, sockets and valid rig where animated. Runtime icon: individual SVG/PNG or exact atlas metadata. Animation: playable skeletal/procedural state with gameplay events. Terrain kit: meshes/material configuration and colliders. None of these classes is interchangeable.

`data/asset-manifest.json` contains one row per production item and intended variant, stable IDs, group, priority, source reference, selected-state dependency, planned output path and actual runtime file state. Expected path never implies delivered file. Maintain references to actual files only after creation. `data/asset-manifest.csv` is the same inventory for review/filtering, not a separately maintained truth.

## Modeling / runtime contract
GLB preferred, meters after verifying engine conversion, Y-up and a documented forward convention. Choose forward direction consistent with existing renderer; preserve exported metadata. Each asset needs origin/bounds, triangle counts per LOD, material count, palette assignments, textures if any, collider/picking shape and license/source notes. Buildings use ground-centered placement origins, doors/connectors and collision footprints. Characters use foot-ground root and separate mounted attachment. Objects with mechanical motion have named pivots: gate hinge, tower turntable, bow limbs/string, catapult arm/counterweight.

King+horse maximum-detail starting target 8–15k triangles combined including weapon, cape and cargo; near infantry starting proposal ~1–3k, brutes ~2–4k, bosses ~4–8k. Distant units simplify heavily. These new numbers are experimental production targets, not guaranteed per-device caps. Keep buildings in original ~500–3,000 triangle range where appropriate; large landmark silhouettes can be separate cheap distant assets. Record any extension rather than silently exceeding the measured scene budget.

Use a shared palette/flat colors and minimal material slots; no realistic PBR textures. Fake fur with a few chunky collar shapes; hair with grouped geometry; cloak with simple rig/procedural motion. Prefer geometry instancing for static props and reuse skeletal assets/material variants where practical in the actual engine. Shadows, LOD thresholds, rig update rate and particle limits follow measurements. Keep final crown silhouettes and hero weapons readable from rear camera.

## King's reusable equipment system
One mounted biped rig contract and horse rig contract shared where proportions allow. Five kings have visually distinct heads/capes/armor/crowns and five barding/material kits; horse base geometry can be shared for white/dark colors. Crown, cape, bow and cargo are modular. The regional visual sheet's 25 bow looks need five base tier geometries plus regional material/attachment kits, not 25 fully independent rigs or thousands of combination models.

Hero sockets: `saddle_rider`, `hand_r`, `hand_l`, `bow_grip`, `bow_string`, `axe_grip`, `pickaxe_grip`, `quiver`, `cape_root`, `cargo_left`, `cargo_right`, `cargo_rear`, `crown_anchor`. Projectile origin must come from bow/release socket. Rider feet and hands align with saddle/reins/weapons; preserve king/horse scale. Place cargo so it does not intersect cape/legs or hide aiming. Stockpile modes include coins/logs/stone/iron independently of capacity/economy tuning.

Equipment retains all original finishes, gems, strings and trails. Store selection as IDs rather than model filenames; attach to a stable bow tier. All combinations must remain legible and valid; emissive trails team-coded when necessary. Crossbow and axe/pickaxe are separate geometry. Existing auto-fire and harvesting events remain authoritative.

## Soldier and boss production
Humanoid guard/archer/raider/swordsman/bowman can share base skeleton; brutes and bosses may need proportion variants. Outrider is rider + enemy horse + spear; hound uses quadruped skeleton. Do not rig a hound as a horse and claim finished motion. Swap regional helmets, shields, weapons, mantles and palette sets. Give bosses clear unique silhouettes even when rigging reused.

Create selected front/side/back model sheets plus equipment detail sheet before final sculpting. Concept turnarounds can disagree: resolve shield side, dominant hand, straps and weapon head explicitly. Default right-handed attack, shield left, unless selected design specifies otherwise. Options A/B do not mean both are playable regional commanders; one chosen design fulfills each stable boss ID.

## Buildings and tiers
- Castle 4 levels: fortified keep → expanded curtain/corner towers → larger inner town/courtyard → royal capital keep. This silhouette progression is proposed art production, not extra gameplay tiers.
- Barracks 3: hall → yard/armory → fortified military complex.
- Towers 5: Archer Tower / Sturdy Tower / Timber Fort / Stone Tower / Ballista.
- Siege 3: Catapult / Heavy Catapult / Trebuchet. Separate rotating frame, arm and counterweight where relevant.
- Walls 5 materials: Palisade / Reinforced / Timber / Stone / Iron. All need straight, corner and gate modules; expansion has 6 footprint levels and is world data, not a sixth material.
- Houses, farm, warehouse, forge, lumber camp, quarry, gold/iron mines, outpost and bridge retained. Every building gets buildable footprint, construction state, selectable collider, interaction origin and destruction/repair state if existing mechanics support it.

Five royal-region architecture kits customize the same functions. Keep gameplay costs/tier indexing shared unless intentional regional tech is selected. Regional buildings sheet shows only representative castle/house/barracks kits; it does not deliver all upgrade models. Add stone bridge landmark separate from buildable wooden bridge. Enemy Mountain Fort and Stronghold have clear gate/siege sockets. Villain camp landmarks can reuse region kit with hostile banners.

## Terrain, vegetation and dressing
Shared terrain data: hill patch, valley patch, cliff straight/corner, riverbank, river/stream surface, waterfall/ravine kit, dirt-road straight/curve/fork/slope, bridge approach, cave mouth and route gate. Use continuous height/terrain layout rather than visibly tiled ground; kit names describe reusable production components. Collision height must match rendered height and leave reliable mounted/troop lanes.

Greenwood: pine/oak, shrubs, grass clumps, stump, logs, farm rows, ruin stones, worn dirt, well, carts, fences, hay, laundry. Mountains: rock/crag sets, alpine pines, snowcaps, rope/stone bridge, abandoned mine, ledge/talus. Iron: dark rust rock, iron seams, slag, forge vent, ore cart, ash tree, foundry modules. Desert: sandstone crags, palms, oasis banks, cactus, shrubs, aqueduct, columns, awnings. Frost: snow terrain, snowy pines, ice rock, frozen river, ice cave, drifts, winter fences. Warlord: dead trees, cracked dark earth, black rock, spikes, broken siege carts, red banners, barricades.

Resources use intact → hit-highlight/chips → depleted stump/rubble → respawn/regrowth if gameplay allows. Reuse resource logical IDs across chunks; visual replacement must not respawn harvest rewards. All resource types and icon IDs still come from original inventory.

## Effects and UI
Use capped pooled coins/chips/dust, cheap projected ground telegraphs and simple projectile trails. Effects inventory includes existing coins, chips, highlights, boulder dust, fire, chain lightning, forged burst, wave arrows plus proposed boss tells, hit/stagger, unlock/claim/reveal and final victory. Boss tell indicates actual damage geometry/timing, independent of render frame rate.

UI production: resource pills for all six HUD values, circular build/king/orders buttons, Start Wave, cream bottom sheets/tabs, upgrade item cards, king selection/region unlock, weapon customization, army orders, contextual interaction, boss health, movement/aim areas and three context actions. Prototype UI sheet is conceptual: never hardcode its invented displayed counts. Generated resource icons may be wrong or duplicate; use exact manifest IDs. In Kingdom mode strategy UI is primary; Combat minimizes it without removing access to necessary orders.

## Production gates
Concept reviewed → selected design recorded → individual clean model sheet → mesh/rig/LOD → clips/events/sockets → engine integration → actual iPhone QA → ready. No step automatically approves the next. Art review can proceed per section while system work continues. Generated workups are proposed images, not code-backed gameplay evidence.
