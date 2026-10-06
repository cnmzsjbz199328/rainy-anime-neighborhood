# Repository guidance

## Project and sources
- This is a Three.js rainy-night Japanese neighborhood diorama, shipped as an offline single-file `index.html`.
- Read `README.md` for structure and commands, `DESIGN.md` for visual constraints, and `PROGRESS.md` for implementation status.
- Edit `scene.js`, `layout.js`, or `buildings/*.js` as sources; regenerate `index.html` with `python3 build.py`. Do not hand-edit the generated HTML.
- Preserve the frozen town layout in `docs/layout/LAYOUT_V1.md`. Use `layout.js` for authoritative dimensions and placements.

## Task entry points
- Building implementation: read `docs/buildings/AGENT_START.md`, the selected card, and `BUILDING_SPEC.md`.
- Planet reference images: read `docs/world/IMAGE_AGENT_START.md`, `WORLD_PLAN.md`, `docs/world/WORLD_SPEC.md`, selected cards, and corresponding `IMAGE_PROMPTS.json` entries.
- Follow the selected workflow's scope; reference-image work does not authorize implementing scene code.
- Read current catalogs to choose pending work; do not hardcode the next card in this file.

## Town, planet, and weather boundaries
- The global design extends the town; it does not replace frozen town geometry or building specifications.
- Weather is a separately planned system (D8, ST05, W8), not evidence of an already implemented module. Default town rain and regression screenshots must remain consistent.
- All planet-wide GLOBE views are clear moonlit nights without rain/cloud cover. Time remains night (D9).
- Neutral illumination in non-globe reference panels is a material/form study, not a daytime game state. Local night panels follow biome weather (snow on ice, usually clear in desert).
- Correct stale template wording minimally to match established decisions and record the correction. Ask only for a real design-decision change or unresolved meaning; do not repeatedly request confirmation of D8/D9 or the already accepted ST01 style.

## Validation and delivery
- World reference changes: `node docs/world/check_kit.mjs`; use `--refs` once all 39 references exist. Inspect each generated image visually; the checker does not validate image content.
- Building reference changes: `node docs/buildings/check_kit.mjs`.
- Scene/layout changes: rebuild, then run relevant checks documented in README, including `node tools/measure_samples.mjs` before `node tools/layout_check.mjs --png`; use building and browser screenshots for visual changes.
- Keep unrelated work intact. Stage explicit task files. Follow the selected workflow's commit/push instructions; never treat a local commit as proof of a successful push.
- Write concise Chinese progress and handoff notes, with exact output paths, validation results, and remaining visual issues.
