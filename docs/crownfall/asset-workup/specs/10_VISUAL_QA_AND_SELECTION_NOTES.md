# 10 — Visual review notes

All fourteen final proposal images were visually reviewed. The UI was regenerated to replace invented crystal/flame currencies with the original six resource types and replace the accidental horned-monster boss with the human Bramble Captain from his army sheet. The rejected initial UI is not included as a final image; its prompt remains in generation history.

## Interpretation rules before production
- All image numbers, costs and health levels are illustrative. The UI's bank/people number formatting is not economy data; bind to actual game state. In particular banked gold is a gold amount, not a population fraction.
- Some “side” turnarounds are three-quarter angles, not exact orthographic views. Create clean selected model sheets before modeling; don't trace every generated view independently.
- Soldier A/B shields and generated heraldry occasionally drift. Greenwood uses crown heraldry from the chosen king sheet; Mountains mountain; Iron crossed hammers; Desert sun; Frost snowflake; enemy Warlord broken crown/black helmet. Final vector marks should be drawn consistently, not copied from arbitrary variant shield symbols.
- In the Mountain army sheet, Ridge Raider has a hook/pick weapon. That is a proposed regional raider weapon. Preserve a consistent selected weapon and animation contract; it does not replace king's harvesting pickaxe behavior.
- Some friendly Iron helmets/cloth and enemy red outfits overlap. Visible blue alliance sash, rounded shield and friendly selection marker must remain at all gameplay LODs. If silhouette tests fail, increase blue presence before shipping.
- Enemy faction symbols can resemble regional emblems in generated images. Use hostile angular variants and red/black identity; allied royals alone receive clean gold-crown treatment.
- Forest/brute faces and war-hound tooth shapes are stylized. They are not permission to change unit type, add a new currency, or make the playable king monstrous.
- Environmental landmarks shown with enemy banners may be occupied objectives. Establish owned/occupied flags explicitly in world data; do not render friendly kingdom capital as always hostile.
- Warlord B's oversized gold helmet detail needs to resolve into the original gold crown band on a black horned helmet. Preserve the core final-villain identity even if the hammer alternative is selected.
- Building progression is art direction, not mechanical engineering. Correct throwing arm/fulcrum/counterweight behavior and clean pivots in the actual siege model; don't treat rendered catapult proportions as a physics specification.
- The Elder Treant is intentionally a large boss. Simplify foliage/roots for performance while preserving trunk/branch/root silhouette and chest opening. The tiny soldier in its sheet is illustrative scale; gameplay hitbox/size must be tuned for the mounted arena.
- Major concepts are richer than the final phone render may permit. Preserve terrain layering, color blocks and silhouette; reduce tiny trim, particles, dense props, smoke, material count and shadows based on measurement.

## Validation performed for this deliverable
Verified fourteen final PNG files, four original JPEG references, unique asset IDs, JSON/CSV agreement, source-image byte preservation, reference paths, gallery image links and ZIP integrity. No production mesh/rig/gameplay or physical iPhone validation was possible: the game repository was not supplied. Those checks remain in the implementation contract.
