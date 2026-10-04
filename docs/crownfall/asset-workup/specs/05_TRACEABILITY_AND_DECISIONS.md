> Updated source note: the four original rendered concepts are now supplied under `references/approved/`. Any historical missing-reference statement below is superseded by spec 06. New regional armies and villains remain proposals pending selection.

# 05 — Traceability and decisions

This table starts intentionally unimplemented. Claude must map the actual repository before assigning existing/done status. Update it in every milestone. State vocabulary: unverified, existing-verified, planned, in-progress, blocked, implemented-unverified, verified. Add code paths and evidence, not only checkmarks.

| ID | Requirement | Initial state | Code/evidence |
|---|---|---|---|
| R01 | Portrait iPhone-browser play | unverified | repository/device audit needed |
| R02 | Bigger epic exploration maps | planned | world spec |
| R03 | Close rear-view RPG combat | planned | camera/control proof |
| R04 | Durable full handoff | verified | this package, scope limited to supplied context |
| R05 | Five regional king identities | planned | original concepts supplied; model integration needed |
| R06 | Exploration/elevation/landmark inspiration | planned | original world layout needed |
| R07 | Preserve strategy and building loop | unverified | repository audit |
| R08 | Chunky bright low-poly style | planned | art spec + screenshot comparison |
| R09 | Three cameras + cinematic reveals | planned | camera state machine |
| R10 | Five kingdoms + Warlord realm | planned | world layout |
| R11 | Collect/upgrade/build/recruit/campaign | unverified | gameplay audit |
| R12 | Auto-fire/harvest/cargo/hero states | unverified | gameplay + animation audit |
| R13 | Bow tiers/customization/weapons | unverified | inventory and asset manifest |
| R14 | Six HUD resource values | unverified | economy/save audit |
| R15 | Friendly units/workers | unverified | unit behavior audit |
| R16 | Enemies/bosses/elites | unverified | wave and enemy audit |
| R17 | Friendly buildings/levels | unverified | building inventory |
| R18 | Tower/catapult/wall progression | unverified | material vs expansion rules |
| R19 | Mountain Fort/final Stronghold | unverified | structure/encounter audit |
| R20 | Orders/claims/waves/siege | unverified | strategic state audit |
| R21 | Full effects inventory | unverified | VFX audit |
| R22 | UI style and controls | unverified | touch/UI audit |
| R23 | Elevation/natural boundaries/traversal | planned | terrain proof |
| R24 | Landmark sightlines/reveals | planned | annotated route captures |
| R25 | Routes/branches/chokepoints | planned | route graph + troop traversal |
| R26 | Settlements feel inhabited/grow visibly | planned | growth comparison |
| R27 | Smooth collision-aware camera states | planned | transition checks |
| R28 | Simple concurrent touch controls | planned | real iPhone test |
| R29 | Waves and exploration encounters coexist | unverified | explicit timing rules |
| R30 | Standard per-king asset inventory | planned | manifest |
| R31 | Shared animation/socket/cargo contract | planned | renderer clip tests |
| R32 | Key art/sheets/icons/UI/concepts | planned | separate art production needed |
| R33 | GLB/scale/LODs/pivots | planned | exported-model verification |
| R34 | Persistent streamed world | planned | reload/backtracking checks |
| R35 | Bounded simulation and visual working set | planned | sustained-device profiling |

## Decision register
| Topic | Current status | Required next evidence/decision |
|---|---|---|
| Existing engine/repository | unknown | audit source; reuse unless justified |
| Exact king appearances | source supplied | labeled regional sheet; see spec 06 |
| Praised macro map appearance | source supplied | original world/camera concept; exact terrain still to author |
| Map dimensions/chunks/height range | not fixed | world-unit audit + slice traversal/profile |
| Region geographical order | proposed | authored graph, resolve southward journey vs Frostmarch geography |
| Mountain versus Iron fork | proposed | progression and unlock dependency plan |
| King names/lore/unlock quests | not fixed | coherent story design using regional IDs first |
| Per-king abilities/horse stats | proposed | combat prototype and balancing |
| Dismount/block/manual attack | not fixed | touch usability; not mandatory extra buttons |
| Simulation while king travels | not fixed | clear wave/defense rule; preserve existing saves |
| Supported devices and browsers | not fixed | explicit iPhone test matrix |
| 60/30 FPS, crowd and LOD budgets | target/proposed | real device profiling; no guarantee |
| Five wall materials/six expansions | distinct systems | check costs/unlock data, no invented sixth material |
| Saves during world migration | unknown | compatibility plan and regression evidence |
| Deliverable scope | full vision, staged build | vertical slice does not complete entire campaign |

## Change log template
Date · decision · previous rule · new rule · reason · requirement IDs affected · owner approval if scope changes · evidence. Keep old numeric proposals recorded as superseded; don't let future sessions revive them accidentally.

## Resume note template
Current branch/commit; current milestone; verified requirements; files touched; checks/results; blockers; missing references; next exact action. Put it in `implementation-status.md` after each meaningful session.

## Fidelity checklist
Before calling a release complete ask: all five kings accounted for? all six regions accounted for? every weapon/customization/building/unit/effect/UI item mapped? mounted collection and strategy still work? three camera states usable? world genuinely explores beyond a flat arena? browser/iPhone evidence captured? missing art and proposed lore clearly identified? legacy saves preserved? final Warlord siege reachable?
