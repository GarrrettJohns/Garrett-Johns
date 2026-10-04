# Crownfall — Claude Code handoff
Version 1.0 · 4 October 2026

This package preserves the Crownfall discussion supplied with this request. It is a design and implementation handoff, not a completed game or a rigged asset pack. The existing repository was not supplied or inspected. All engine, performance, save, and architecture claims must be verified against it.

## How to use
1. Unzip this folder into the existing game repository as `docs/crownfall/`.
2. Keep the supplied screenshots under `docs/crownfall/references/`.
3. Start Claude Code in the game repository and paste the prompt in `CLAUDE_START_HERE.md`.
4. Claude first audits the repository, maps requirements to existing systems, and creates a measurable plan. It then implements the Greenwood vertical slice before scaling the campaign.
5. At every milestone Claude updates the traceability table and evidence log. Keep these documents committed alongside the code so later sessions can resume without relying on chat memory.

## Read order
- `CLAUDE_START_HERE.md`: exact kickoff prompt and working rules.
- `01_VISION_AND_REQUIREMENTS.md`: product contract, status distinctions, complete feature inventory.
- `02_WORLD_AND_GAMEPLAY.md`: world, terrain, cameras, controls, narrative and opening sequence.
- `03_ART_AND_ASSETS.md`: palettes, character/horse requirements, asset inventory, missing art and delivery contracts.
- `04_IMPLEMENTATION_AND_VALIDATION.md`: audit, milestones, performance experiments and acceptance checks.
- `05_TRACEABILITY_AND_DECISIONS.md`: requirement IDs, change log, open decisions and evidence template.
- `references/INDEX.md`: all 15 original screenshots and how to use them.

## Authority
Explicit user requirements > accepted direction recorded here > original art brief where consistent with the newer direction > proposed implementation defaults. Prior numeric suggestions are targets to test, not proven measurements. An unresolved item is not permission to drop a requirement. Record a proposed resolution and continue independent work.

The user wants a substantially bigger, epic adventure, behind-the-king combat, all five regional kings, kingdom building, and playable iPhone-browser delivery. Breath of the Wild inspires exploration, sightlines, elevation and landmark reveals; create Crownfall's own geography and assets.

## Important missing inputs
The five generated king designs and newly praised macro map concept are not present in the supplied 15 images. Preserve the written regional associations; do not claim to reproduce their exact faces, silhouettes or map geography. Add those actual images when available, with explicit filenames and reference roles. No original project source, live URL, device baseline or performance measurements are included.
