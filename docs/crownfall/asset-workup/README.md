# Crownfall — full asset workup & visual choices
Version 2 · 4 October 2026

This replaces the earlier handoff's missing-reference assumptions. It contains the four original rendered concepts supplied by the user, new proposed visuals, complete production inventory and a revised Claude Code contract. The old prototype screenshots are intentionally not part of this art-review package. They remain in the earlier handoff if needed for source-system comparison.

## What is delivered
- The four original rendered reference images, with readable filenames and preserved bytes.
- Fourteen new visual proposal sheets: six regional armies/commanders, soldier A/B comparison, alternate villains, regional buildings, region travel views, portrait UI icon language, building progression and Elder Treant.
- Complete kings, soldiers, commanders, animation, equipment, environment/building, VFX/UI and production specifications.
- JSON and CSV production manifest; regional faction data; animation event contract; selection file separating confirmed references from pending designs.
- Prior gameplay/world requirements retained under `specs/`, corrected by the new source hierarchy.

These are visual workups and build specifications. PNG/JPEG sheets are not animated/rigged GLB models. No production meshes, skeletal clips or browser implementation are represented as completed. The manifest distinguishes existing reference images from runtime assets still to build. New boss names, attacks and regional troop names are proposed working designs.

## Start reviewing
Read `REVIEW_GUIDE.md` and compare the images in `visuals/`. You can mix A/B choices per kingdom. The new proposals stay pending until selected. Image text, heraldry and turnarounds may contain inconsistencies; use the written source hierarchy and production contracts for final assets.

## Claude Code
Copy this whole folder into the repository as `docs/crownfall/`, then paste `CLAUDE_START_HERE.md`. The new package preserves the complete original feature list while adding regional soldiers and villains. Claude must build against the selected visual direction and verify browser/iPhone playability. Unselected concepts must not silently become final canon.

## Source authority
1. Explicit user instructions and recorded selections.
2. `references/approved/03_five_regional_kings.jpeg`: labeled regional king appearance; prioritize its top mounted portrait per kingdom where generated subviews conflict.
3. `references/approved/02_mounted_hero_and_weapons.jpeg`: main king side/back, bow progression, equipment and actions, compatible with #2.
4. `references/approved/04_world_and_cameras.jpeg`: desired world composition and camera intent, not exact navigation coordinates.
5. Written original brief and updated specifications.
6. New proposals in `visuals/`, pending selection.
7. `01_early_king_exploration.jpeg`: exploratory alternatives; do not add all ten characters or swap them into the chosen five.

Higher-detail concept rendering is an appearance guide. Simplify tiny fur, armor engraving, glow and foliage detail to the browser budget while preserving shape and identity.
