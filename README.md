# BLEED

A WebGL2 shader tool that inflates letterforms (or any artwork) into grainy, dithered blobs.
Type something, pick or drop a font, and pull it apart. Then export a high-resolution PNG or JPG.

**v1.2** rebuilds BLEED as a [Toolcraft](https://www.npmjs.com/package/@pixel-point/toolcraft) app.
The shader math and render passes are ported unchanged from the original single-file version, but the app
now runs inside a typed control panel, an infinite canvas, and an image export pipeline. Acceptance tests
cover the whole app.

---

## Tech stack

| Layer | Stack |
|---|---|
| App framework | Toolcraft (`@pixel-point/toolcraft`): runtime schema, control panel, canvas shell, export, persistence |
| UI | React 19, Base UI, Tailwind CSS 4, Toolcraft UI primitives |
| Rendering | Raw WebGL2 on an `OffscreenCanvas` engine: a separable blur pass plus a main material pass |
| Fonts | Google Fonts via the `FontFace` API, plus local `.otf` `.ttf` `.woff` `.woff2` files |
| Build | Vite 8, TypeScript 6 (strict) |
| Tests | Vitest (unit and acceptance contracts), Playwright (browser acceptance with typed runtime evidence) |

## How the look is made

The look comes from a chain of cheap operations, not a 3D render:

1. **Coverage**: letters (or dropped artwork) are rasterised to a 1-channel bitmap.
2. **Blur**: a large separable Gaussian turns that bitmap into a density field. Blurring *then*
   thresholding merges neighbouring strokes with a fillet, rounds every corner, and closes tight counters.
3. **Threshold**: the field is cut to get the bloated silhouette. Threshold controls fatness.
4. **Dome**: `h = (d - threshold) / coreDepth`, then `sqrt(1 - (1-h)²)` gives a hemispherical height.
   A fake normal from the field gradient adds pillow lighting and creases where strokes merged.
5. **Emboss**: the crisp source is pushed back into the normal, so the letterforms ghost through the surface.
6. **Grain**: multiplicative fine grain, biased toward the shoulders, plus an optional 1-bit dither
   (White, Value, Bayer 8×8 or Blue-ish) and a directional, fbm-roughened dissolve.
7. **Downsample**: the preview renders at 1–2× and is resampled to the display, which makes 1px dither
   read like film grain or screenprint.

Field textures use `R16F` when `EXT_color_buffer_float` is available and fall back to `R8` otherwise.
The foreground always renders on transparency, and the background is a separate runtime layer.

## Controls

| Section | What it does |
|---|---|
| **Presets** | Editable material library seeded with **Blob**, **Razor** and **Pillow** |
| **Source** | Letters or artwork, text, font (Google Fonts picker or a dropped font file), rotate (0°, 90°, −90°), shift X/Y, artwork channel and fit |
| **Inflate** | Amount, threshold (fatness), core, dome, edge, emboss and emboss softness |
| **Shading** | Light and light angle, ambient, rim, normal strength, warp and warp scale, invert |
| **Grain** | Amount, edge bias, scale, noise mode, 1-bit dither, seed (with **New seed**) |
| **Dissolve** | Amount, angle and softness of the directional fade |
| **Background** | Background colour, and whether it is included in exports |

### Presets

A preset is a **material recipe only**: inflate, shading, grain and dissolve. Applying, saving or
overwriting a preset never touches your text, font, size, tracking, rotation, artwork or canvas.

- Click a row to apply it. A dot marks the active preset once you have edited it since loading.
- Each row can be renamed, overwritten with the current settings, or deleted. Built-ins can be too.
- **Save current** adds a new entry, and **Restore factory** brings the three built-ins back.

### Input

- **Fonts**: choose any Google Font in the font picker, which also sets size, weight, letter spacing,
  line height and ink colour. You can also drop `.otf` `.ttf` `.woff` `.woff2` files, which load locally
  through `FontFace`.
- **Artwork**: `.svg` `.png` `.jpg` `.webp`. SVGs are rasterised at up to 4096 px and read through alpha.
  Raster art can be read as alpha, luminance or inverted luminance.

Nothing is uploaded. Everything runs locally in the browser.

## Canvas and export

- **Canvas**: a finite artboard by default, or an **Infinity** canvas you can pan (Space + drag) and zoom.
  Both modes keep the same output and persist across reloads.
- **Render scale**: 1–2× for the preview. Export resolution is chosen separately.
- **Export**: PNG or JPG at **2K**, **4K** or **8K**, staged on an `OffscreenCanvas`. With
  **Include background** off, PNGs keep a true alpha channel, so the ink drops straight into
  Figma or InDesign over any background.
- **Defaults**: save the current state as the default, or import and export the full state as JSON.

## Getting started

Requires a recent Node.js LTS and a browser with WebGL2.

```bash
npm install
npm run dev           # starts Vite on a free local port (127.0.0.1:3002 by default)
npm run build         # type-check + production build into dist/
```

## Verification

```bash
npm run typecheck        # TypeScript
npm run ai:check         # code health (file size, product boundaries)
npm test                 # docs + integrity checks, script tests, Vitest unit + acceptance contracts
npm run test:browser     # Playwright browser acceptance
npm run verify:delivery  # full delivery gate: health, integrity, unit, browser evidence
```

Browser acceptance lives in `e2e/product-bleed.spec.ts` and `e2e/product-bleed-source.spec.ts`.
Each test attaches typed runtime evidence (pixel changes, control applicability, export artifacts,
viewport and Infinity behaviour) through Toolcraft's protected helpers.

## Project layout

```
src/app/
  app-schema.ts                 control panel schema (sections, controls, actions)
  app-composition.tsx           Toolcraft app composition
  bleed-gl.ts                   WebGL2 engine: shaders and render passes
  bleed-render.ts               font and artwork loading, render parameter dispatch
  bleed-preview.ts              preview frame scheduling and engine lifecycle
  bleed-canvas.tsx              canvas component
  bleed-artwork.ts              artwork rasterisation
  bleed-export.ts               high-resolution export staging
  bleed-params.ts               material parameters and defaults
  bleed-preset-library.ts       preset model (Blob, Razor, Pillow)
  bleed-preset-list-control.tsx custom preset list control
  app-acceptance-data.ts        acceptance requirements for this product
e2e/                            Playwright specs and Toolcraft browser helpers
docs/toolcraft/                 Toolcraft contract docs and the agent worklog
```

`AGENTS.md` and `docs/toolcraft/` define the Toolcraft project contract. Generator-owned files
(`index.html`, `src/app/app-identity.ts`, `src/toolcraft/`, `scripts/toolcraft-*`) are integrity-checked
and should not be edited by hand.

## License

BLEED is MIT licensed. See `LICENSE`.
Toolcraft runtime and template code is MIT licensed by Pixel Point. See `LICENSE.md` and `NOTICE.md`.
