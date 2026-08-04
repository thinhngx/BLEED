# BLEED

A WebGL2 shader that inflates letterforms (or any SVG) into grainy, dithered blobs.
Drop in your own font, type something, and pull it apart.

**[Live demo →](https://thinhngx.github.io/BLEED/)**

Single file, no build step, no dependencies. Open `index.html` and go.

---

## What it does

The look comes from a chain of cheap operations rather than a 3D render:

1. **Coverage** — your letters (or a dropped SVG/PNG) are rasterised to a 1-channel bitmap.
2. **Blur** — a large separable Gaussian turns that bitmap into a density field. This is the
   important step: blurring *then* thresholding merges neighbouring strokes with a fillet,
   rounds every corner, and closes tight counters. An SDF dilate gives creased unions instead.
3. **Threshold** — cut the field to get the bloated silhouette. Threshold controls fatness.
4. **Dome** — `h = (d - threshold) / coreDepth`, then `sqrt(1 - (1-h)²)` for a hemispherical
   height. A fake normal from the field gradient gives pillow lighting and creases along the
   seams where strokes merged.
5. **Emboss** — the original crisp source is pushed back into the normal, so the letterforms
   ghost faintly through the surface.
6. **Grain** — multiplicative fine grain, biased toward the shoulders so the core stays clean,
   plus an optional 1-bit dither (white / value / Bayer 8×8 / blue-ish) and a directional
   fbm-roughened dissolve.
7. **Downsample** — everything renders at `Render scale ×` and is resampled to the display.
   That resample is what makes 1px dither read like film grain or screenprint.

## Controls that matter

| Control | Effect |
|---|---|
| **Inflate (σ / cap)** | how far strokes reach for each other. Low = separate lobes, high = one worm |
| **Fatness** | the threshold. Pairs with Inflate to decide legibility |
| **Dome depth / curve** | puffy and glossy vs flat and airbrushed |
| **Emboss source** | strength of the ghosted letterforms inside the mass |
| **Grain amount / to edges / 1-bit dither** | airbrush at one end, screenprint at the other |
| **Dissolve** | directional fade that eats the form into speckle |
| **Render scale** | grain fineness, and export resolution |

## Input

Drag anywhere in the window, or click the drop zone:

- **Fonts** — `.otf` `.ttf` `.woff` `.woff2`, loaded via `FontFace`, never uploaded anywhere.
  Loaded families appear as chips; click one to switch.
- **Artwork** — `.svg` `.png` `.jpg` `.webp`. SVGs are read through their alpha channel, so
  fill colours don't matter. Raster art can be read as alpha, luminance, or inverted luminance.

## Presets

One editable library, seeded with four built-ins. Every row can be **↻ overwritten**
with your current settings, **✎ renamed**, or **✕ deleted** — built-ins included
(they lose their `FAC` badge once you overwrite them). **Restore factory** brings
the original four back without touching anything you saved yourself.

A preset is a **material recipe only**: inflate, threshold, dome, emboss, lighting,
grain, and dissolve. Switching or overwriting a preset never touches your letters,
font, weight, cap size, tracking, line height, rotation, artwork, or canvas size —
those stay exactly as you left them no matter which look you try. An orange dot next
to the active preset name means you've nudged a slider since loading it.

**Save current as…** adds a new entry. **Copy params** / **Paste params** move the
current material recipe via clipboard/JSON. Your last state is restored automatically
on reload.

## Export

**Save PNG (alpha)** writes a transparent PNG at full render resolution — the ink keeps its
dither and everything else is alpha 0, so it drops straight into Figma or InDesign over any
background. Invert flips to black ink on transparent.

## Requirements

WebGL2 with `EXT_color_buffer_float` preferred (falls back to 8-bit fields).
Everything runs locally in the browser; no files leave your machine.

## Origin

Reverse-engineered from a 2023 adidas × Humanrace NMD S1 "MAHBS" campaign poster, after
measuring the grain autocorrelation and tone histogram of the original to work out that the
treatment was blur→threshold plus 1-bit dither rather than a 3D render with a noise overlay.

## License

MIT
