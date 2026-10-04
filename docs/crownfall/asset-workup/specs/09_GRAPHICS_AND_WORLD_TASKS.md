# 09 — Graphics and world task breakdown

1. Audit current game and keep branch/save compatibility. Create actual code map against retained R01–R35 requirements plus new regional soldiers/bosses.
2. Establish flat-color materials, light/fog setup, distant landmark LODs and ground shading without changing economic logic.
3. Build Greenwood route with real elevation/collision/nav lanes; remove visible rectangular-arena boundaries from gameplay views. Preserve useful current landmarks/mechanics in new locations.
4. Introduce three camera states and touch interaction. Use rear hero view with crown/cape/bow stow behavior; ensure actor doesn't block target and camera avoids trees/cliffs.
5. Replace main hero and guard/archer/raider with selected validated assets; preserve attack/resource event timings.
6. Upgrade capital and settlement dressing through shared kits. Demonstrate build expansion in place, worn ground, workers and path use.
7. Add raider encampment with chosen boss and five enemy roles; Elder Treant remains wave 5. Respect existing economy/wave AI and save states.
8. Implement persistent chunks and region route graph, then benchmark sustained horse travel, battle and menus on named iPhones.
9. Scale five kingdoms and final realm to the established world-map composition, with owned/occupied state visual clarity. Add regions one at a time using the same gates.
10. Complete all bow tiers/customization, building tiers, icons, regional variants, siege mechanics and final Warlord encounter. Record actual produced files and tests in manifest.

## Initial geography proposal for coordinate planning
World concept upper-left Greenwood connects by river crossing/foothill route northeast toward mountain passes. Descent goes south into Iron Hills. Campaign then bends west/southwest toward Sunscorch oasis and city, returns southeast through high-elevation crossing to Frostmarch, then descends southwest into Warlord territory. This route graph is a proposed playable interpretation of the pictured numbered progression. Exact distances and chunk sizes require existing world scale and traversal testing; the picture is not a heightmap. Side-road links allow optional outposts/mines and later shortcuts without sequence-breaking locked regions.

## Definition of graphics upgrade done
Main mounted hero coherent at both camera scales; selected soldier/boss silhouettes clean and team-readable; varied traversable terrain; inhabited settlements; distinct six-region architecture/environment; distant landmark reveals; all original effects/UI identifiers preserved; region assets and simulation bounded; no dropped strategy systems; no “concept-only” production row marked ready; real-device checks attached or explicitly unverified.

## Proposed additions to requirement tracker
R36: complete allied guard/archer/raider variants for each playable kingdom.
R37: distinct main villain and enemy-role army per region, final Warlord included.
R38: preserve original wave-5 Treant separate from new Greenwood villain.
R39: user-selectable mockup review across soldiers, villains, buildings, terrain, UI and icons; selections persist by section/region.
R40: use now-supplied original king/world images as visual source; resolve reference conflicts explicitly.
