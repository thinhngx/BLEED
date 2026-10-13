# Toolcraft App Agent Worklog

## Status

Mode: product

BLEED, a WebGL2 shader that inflates letterforms or dropped artwork into grainy, dithered blobs, rebuilt on Toolcraft. Keep later entries compact. Detailed requests and results belong in `docs/agent-journal/changes`; text command attempts live in `.toolcraft/journal/runs`.

## Preflight

- Request: "i want to redesign the whole UI of this tool with toolcraft" (reference: https://github.com/thinhngx/BLEED, source cloned read-only to /tmp/bleed-src/index.html, 740 lines).
- Task type: first product delivery; reference app port + schema/controls + renderer + export/media. Substantial scope, so this section is the concise plan.
- Contracts read (one per read): AGENTS.md, workflow.md, core/reference-study.md, core/runtime-boundary.md, assembly-workflow.md, core/control-selection.md, core/layout.md, core/setup-export.md, core/media-upload.md, core/performance.md.
- Still to read before editing code (Implementation phase): decision-contract.md, schema-reference.md, component-rules.md, renderer-technique.md, performance.md. Verification phase: acceptance-testing.md.
- Verification tier: Tier 4 (fresh app, first delivery). Run: `npm run verify:delivery` once, then `npm run dev:restart`. Skip: measured performance (no request authority), `verify:perf`.
- Transfer mode: `new-toolcraft-app`. The user explicitly asked to redesign the whole UI, which the contracts allow in place of `reference-runtime-clone`. The shader math, render passes and material-only preset semantics are still ported verbatim; Toolcraft owns the shell.
- Motion reference: none (`referenceInputs: []`, no `reference:study`).
- Layers: off (no layer workflow requested). Timeline: off (BLEED is still output; no video export requested, so video stays `not-requested`).
- Export intent: image `toolcraft-default` (PNG with alpha); SVG and video `not-requested`. The original "Save PNG (alpha)" maps to Runtime Image Export with Background off.
- View interaction: `non-spatial` (2D coverage field plus fake-normal shading, no orbitable scene).

### Reference feature inventory (draft)

| Reference feature | Toolcraft mapping |
| --- | --- |
| Letters source: text, font stack, weight, cap size, tracking, line height | schema controls (textarea/fontPicker per control-selection) in a Source section |
| Artwork source (SVG/PNG/JPG/WebP) with Alpha/Luminance/Inverted channel, fit | `fileDrop` image upload + select + slider, conditional on source mode |
| Font drop (.otf/.ttf/.woff/.woff2) | `fileDrop` file upload feeding `FontFace`; decision to confirm against component-rules |
| Rotate, Shift X/Y | sliders (Rotate keeps 90 deg steps) |
| Inflate, Fatness, Dome depth/curve, Edge softness, Emboss, Emboss softness | Inflate section sliders |
| Light angle/amount, Ambient, Crease, Rim, Organic warp/scale | Shading section |
| Noise mode, Grain amount/size/to edges, 1-bit dither, Dissolve + angle + falloff, New grain seed | Grain section + local action |
| Canvas W/H, Render scale 1-4, Invert | runtime Setup (canvas size, Resolution scale clamps to 1..2, a deliberate change) + Invert switch |
| Preset library (4 factory, save/overwrite/rename/delete/restore, copy/paste params, drift dot) | open question: no built-in preset-library control seen yet; to be resolved with `collectionActions`/`actions` or flagged `intentionally-changed` with user approval |
| Save PNG (alpha) | runtime `Image Export` (PNG, Background off = transparent) |
| State restored on reload | runtime workspace persistence |
| Reset all | runtime panel Reset |

### Known risks and deliberate changes

- Render scale: BLEED allows 1-4x; Toolcraft fixes the slider to 1..2 (default 2). Export resolution comes from Image Export 2K/4K/8K instead.
- Preset library is the largest gap with built-ins; needs a decision before schema work.
- Font loading through `FontFace` must live inside the renderer, not in a custom control.
- The WebGL pipeline needs one compiled `renderer.pipelineRegistration` plus `assessToolcraftRenderPlan` before renderer code.

## Decision Trail

### Delivery 1

- Change ID: bleed-first-delivery
- Request: "i want to redesign the whole UI of this tool with toolcraft" (reference: https://github.com/thinhngx/BLEED).
- Active change: bleed-first-delivery
- Task type: first product delivery; port of an existing WebGL2 tool with schema controls, a custom renderer, media drops and image export.
- User-visible result: a Toolcraft shell with Source, Inflate, Shading, Grain, Dissolve, Presets and Background sections around the same BLEED shader output, plus runtime Image Export with transparent PNG.
- Source/reference checked: `thinhngx/BLEED` `index.html` at c9bac40, read in full for GLSL, DEFAULTS, control ranges and preset semantics.
- Reference inputs: none for motion (`referenceInputs: []`); the source code is the only reference and BLEED is a still output.
- Docs/contracts read: AGENTS.md, workflow.md, assembly-workflow.md, control-selection.md, layout.md, setup-export.md, media-upload.md, performance.md, renderer-technique.md, component-rules.md, schema-reference.md.
- Contract rules applied: built-in controls first; one compiled renderer pipeline; shared preview/export coverage and shade passes; section inventory with stable ids; image export through the runtime module; media drops through `fileDrop`; performance paths with browser adapters.
- View interaction intent: non-spatial; the viewport only pans and zooms the finished 2D image because BLEED has no camera or model.
- Interaction ownership: the canvas owns viewport pan and zoom; every material property stays in the controls panel as a labeled slider, select or switch.
- Decision: typography uses the built-in `fontPicker` (family, weight, size, tracking, line height, case, ink color, opacity). Tracking -0.03 quantizes to `tight` and line height 0.9 to `none`. A font `fileDrop` overrides the picked family. The default is Arimo 700 because the built-in catalog has Arimo only at 400-700.
- Decision: presets are a built-in `collectionActions` library of `{id, name, recipe}` where `recipe` is a material-only JSON string, so applying one can never touch text, font, size, tracking or canvas. Apply, Save current, Overwrite and Factory are built-in `actions`; Remove deletes the last preset only.
- Decision: Resolution scale is 1-2 (default 2) instead of BLEED's 1-4; high resolution comes from Image Export 2K/4K/8K. The foreground is always transparent and the runtime composites Background, so Background off exports a transparent PNG.
- Decision: artwork `fileDrop` uses `assetKind: "file"` and BLEED's own Rotate (-90/0/90) control; source text is a multiline `code` control.
- Decision: custom WebGL2 renderer `bleed-webgl2-v1` with passes `resources`, `preview-coverage`, `preview-shade`, `export-coverage`, `export-shade`. Blur taps are capped at 145 by stride, so they are not a workload dimension.
- Alternatives rejected: custom font and preset UI (built-ins cover them); `reference-runtime-clone` (the user asked for a UI redesign); Canvas 2D shading (cannot run the per-pixel pass interactively); image `fileDrop` (would require runtime rotate/flip metadata that duplicates Rotate).
- State/output mapping: every source, material and preset control writes a schema target that the preview and the export renderer both read through one shared coverage builder and one shader; Background and Include map to runtime compositing and PNG alpha.
- Verification: `npm run typecheck`, `npx vitest run src/app`, `e2e/product-bleed.spec.ts`, one `npm run verify:delivery`. Results are recorded in the final report.
- Risks: dropped fonts or artwork that the preview never loaded fall back on export; Resolution scale is limited to 2x; only the last preset can be removed.

### Preset list

- Entry type: focused
- Change ID: bleed-preset-list
- Request: "i don't see this usable at all" (Presets section screenshot); the user chose a custom preset list matching the original BLEED.
- Changed owner: `presets.library` becomes custom control `bleedPresetList` (`bleed-preset-list-control.tsx`, model `bleed-preset-library.ts`); `presets.actions` is now Save current + Restore factory.
- User-visible result: clicking a preset name loads it and highlights the row; a dot marks edits since loading; each row has overwrite, inline rename and delete; recipe JSON is hidden.
- Design System Fit need: a named list where one click loads a recipe, with a pressed active row, drift marker and per-row overwrite/rename/delete.
- Design System Fit candidates: `collectionActions` + `actions` (shipped first), `select` + `actions`, `toggleGroup`.
- Design System Fit closest: `collectionActions`; it exposes the raw recipe field, has no click-to-load, no per-row commands, and removes only the last item.
- Design System Fit missing capability: per-row commands on a selectable named list whose selection applies values to other targets.
- Design System Fit outcome: custom control from public `@/toolcraft/ui` Button, Input and `pressedSelectedItemClassName`; writes go through `setValue` and `controls.apply` only.
- Verification: `tsc` passes; `ai:check` passes (28 files); vitest 769 passed (new `bleed-preset-library.test.ts`); `e2e/product-bleed.spec.ts` 13/13 passed, including load, active state, drift, save, rename, overwrite, delete and restore.
- Risks: overwrite and delete apply immediately without a confirm prompt (undo history covers them); copy/paste params from the reference are not ported.

### Title and factory presets

- Entry type: focused
- Change ID: bleed-title-factory-presets
- Request: "change name to: BLEED (all uppercase)"; "save my current presets as default"; "move the top save as default + import/export settings section to bottom".
- Changed owner: controls panel `title` in `app-schema.ts`, new `bleed-display-title.ts`, tab-title effect in `bleed-canvas.tsx`; `bleedFactoryPresets` in `bleed-params.ts`; `src/app/app-defaults.json`.
- User-visible result: the controls panel header and the browser tab read BLEED. `app-identity.ts` and `index.html` stay generated ("Bleed"): they are generator-owned, and the CLI derives the title from the lowercase package name, so `--name BLEED` still yields "Bleed". `BLEED_DISPLAY_TITLE` (`bleed-display-title.ts`) feeds the panel title and a `BleedCanvas` effect that sets `document.title`; the factory presets are the user's Blob, Razor and Pillow recipes (ids `factory-blob`, `factory-razor`, `factory-pillow`), so a clean start and Restore factory both show them.
- Decision: a full-workspace Save State as Default (Infinity canvas, dropped font, Frame 9 artwork) was reverted to the documented `null` defaults at the user's choice ("only my presets"); the snapshot and binaries are kept in `/tmp/bleed-saved-defaults`.
- Decision: the Save State as Default / Import / Export block stays first. `runtime.defaults` must be section 0 per the runtime setup acceptance rule and `setup-export.md`; the move is not applied.
- Verification: `tsc` passes; `ai:check` passes (28 files); vitest 769 passed; `e2e/product-bleed.spec.ts` 13/13 passed; integrity passes (877 files) after restoring the generated identity files; `ai:check` passes (29 files) with the title effect; a Playwright probe confirmed the tab title is BLEED; `verify:delivery` passes every stage before browser evidence, which reports 78 missing attachments (37 `product-observable-change`).
- Risks: browsers with an existing local workspace keep their old preset list until header Reset.

A first delivery records request, references, applied contracts, decisions, alternatives, state/output mapping, checks and risks. A later `Entry type: focused` records `Change ID`, `Request`, `Changed owner`, `User-visible result`, `Verification` and `Risks`. `Verification` describes the actual checks and their results; command mentions never authorize execution.

For a localized, user-authorized performance iteration, record only this separate domain authority in the selected entry:

```md
- Performance intent: performance-iteration
- Performance request evidence: "<verbatim exact Request quote>"
- Performance paths: ["performance-path:%5B...%5D"]
```

Missing performance intent means ordinary work. Performance evidence must be an exact nontrivial raw Request substring; paths must be unique canonical IDs. Unresolved localization creates no path authority. Run `npm run verify:delivery` for initial functional delivery or one authorized targeted iteration; full performance certification requires a separate explicit request.

## Decisions

### Renderer

- Decision: custom WebGL2 renderer with a verbatim port of the BLEED fragment shaders, registered as one compiled pipeline.
- Reason: reference parity for shader math and a per-pixel dome, normal and grain pass that Canvas 2D cannot do interactively.
- Evidence: `src/app/bleed-gl.ts`, `src/app/bleed-pipeline-contract.ts`, smoke render at 1600x1000.

### View Interaction

- Decision: non-spatial; the viewport only pans and zooms the finished 2D image.
- Reason: BLEED has no camera or model.
- Evidence: `appProductReadiness.viewInteraction` and the viewport acceptance rows.

### Interaction Ownership

- Decision: the canvas owns viewport pan and zoom; all material properties stay in the controls panel.
- Reason: pan and zoom are direct spatial gestures; exact values need labeled sliders.
- Evidence: `interactionOwnership` entries `viewport-pan` and `viewport-zoom`.

### Timeline

- Decision: no timeline.
- Reason: BLEED is a still output and no video export was requested.
- Evidence: `animationIntent` is `none`.

### Layers

- Decision: no layers.
- Reason: BLEED renders a single composited shader image.
- Evidence: no layers module in `appSchema`.

### Controls

- Decision: Source, Inflate, Shading, Grain, Dissolve, Presets and Background sections; built-in controls everywhere except the `bleedPresetList` custom control for Presets.
- Reason: built-ins cover every other BLEED control; the built-in collection could not load a preset on click or offer per-row commands (see Preset list entry). The control section inventory documents each grouping.
- Evidence: `app-control-inventory.ts` and `app-schema.ts`.

### Export

- Decision: built-in Image Export (PNG/JPG, 2K/4K/8K) through a product export renderer that re-runs the shared coverage and shade passes at export size.
- Reason: sizes and transparency stay consistent with the preview.
- Evidence: `src/app/bleed-export.ts`.

### Performance

- Decision: workload is preview pixels, export long edge and export pixels; no blur-tap dimension.
- Reason: the separable blur is stride-capped at 145 taps, so cost scales with pixels only.
- Evidence: `src/app/app-performance.ts` and `e2e/app-performance-path-adapters.ts`.

Canonical control values and selected-entity isolation must follow runtime representations and the declared selection owner. Render-scale-enabled products record functional `renderScaleCoverage`; prose never substitutes for asserted backing-quality proof.

## Evidence

- Source reviewed: BLEED `index.html` at c9bac40 and the local Toolcraft docs.
- Contract applied: product decisions are recorded in the Decision Trail; platform development history is not copied here.

## Verification

Protected receipts own initial/performance proof. Later edits record focused checks and text journal run IDs. Failed attempts and their retries remain separate; no screenshots, videos or binary traces are required by the journal.

- Delivery 1 focused checks: `ai:check` passes (23 files); `docs:check`, `tsc` + `vite build` pass; vitest 765 passed; `e2e/product-bleed.spec.ts` 13/13 passed.
- `verify:delivery` blocked at browser evidence: 78 required (was 81 before the preset list) runtime evidence attachments (16 types, mostly `product-observable-change`, `compound-control-part`, `control-applicability-*`) are not yet attached by the product spec.
- Evidence phase (browser runtime evidence): all 78 missing typed attachments are now emitted only through protected `e2e/` helpers (product-observable, applicability, compound-part, media-lifecycle, viewport side-effect, background output/stacking/Infinity viewport, image-export artifact, Infinity mode/export, render-scale). Root cause of the earlier identity-request timeouts: the single Source test overran the 30 s `standard` budget (~3 s per raster proof). Decision: split Source in `src/app/app-acceptance-data.ts` into `BLEED source` / `source font` / `source artwork` (standard) and `source media` (extended-io, media-lifecycle rows). Because the spec exceeded the 500-line test-file limit, the Source tests moved to `e2e/product-bleed-source.spec.ts` (rows repointed via `file`), with shared helpers in `e2e/product-bleed-helpers.ts`. First-frame poll raised to 20 s for cold font loads. Verified: tsc, ai:check (31 files), vitest 769, docs:check, Playwright 16/16 across both BLEED specs; `npm run verify:delivery` passed (exit 0, 17 browser tests, no missing `[toolcraft browser evidence]`).
- SVG artwork fix: Chromium cannot decode SVG via `createImageBitmap(Blob)` and rasterizes viewBox-only SVG `<img>` blank; `bleed-render.ts` now sizes the SVG root (`sizeBleedSvg`, 4096 px long side), feeds it as a data URL to a hidden keyed `<img>` in `bleed-canvas.tsx`, then `createImageBitmap(img)`.
- Module split for code health: `bleed-preview.ts` (preview slot), `use-bleed-preview.ts` (hook), `bleed-artwork.ts` (coverage), `app-product-readiness.ts` (readiness data); runtime evidence names in `bleed-acceptance-runtime.test.ts`.

## Risks

- Risk: dropped assets that the preview never loaded fall back on export; Resolution scale is limited to 2x; preset overwrite and delete have no confirm prompt.
