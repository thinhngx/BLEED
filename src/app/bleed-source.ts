// Source → coverage map (BLEED buildCoverage), ported 1:1. Typography arrives
// from Toolcraft's fontPicker; sizes are scene pixels multiplied by the backing
// scale so preview and export rasterize the same geometry.

import { paintBleedArtworkCoverage } from "./bleed-artwork";
import type { BleedArtChannel, BleedSourceMode } from "./bleed-params";

export type BleedTextCase =
  | "capitalize"
  | "lowercase"
  | "original"
  | "titleCase"
  | "uppercase";

export type BleedSourceInput = Readonly<{
  artChannel: BleedArtChannel;
  artFit: number;
  artwork: CanvasImageSource | null;
  artworkSize: Readonly<{ height: number; width: number }> | null;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  letterSpacingEm: number;
  lineHeight: number;
  mode: BleedSourceMode;
  rotate: number;
  shiftX: number;
  shiftY: number;
  text: string;
  textCase: BleedTextCase;
}>;

export type BleedCoverage = Readonly<{
  canvas: OffscreenCanvas;
  usedPx: number;
}>;

export function applyBleedTextCase(text: string, textCase: BleedTextCase): string {
  switch (textCase) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/(^|\s)(\S)/gu, (_, gap: string, ch: string) => gap + ch.toUpperCase());
    case "titleCase":
      return text
        .toLowerCase()
        .replace(/(^|\s)(\S)/gu, (_, gap: string, ch: string) => gap + ch.toUpperCase());
    default:
      return text;
  }
}

/** True when the source has nothing to rasterize (neutral canvas). */
export function isBleedSourceEmpty(
  input: Pick<BleedSourceInput, "artwork" | "mode" | "text">,
): boolean {
  return input.mode === "artwork" ? input.artwork === null : input.text.trim() === "";
}

export function buildBleedCoverage(
  target: OffscreenCanvas,
  w: number,
  h: number,
  pixelScale: number,
  P: BleedSourceInput,
): BleedCoverage {
  if (target.width !== w) target.width = w;
  if (target.height !== h) target.height = h;
  const c2 = target.getContext("2d", { willReadFrequently: true });
  if (!c2) throw new Error("BLEED coverage requires Canvas 2D.");
  c2.setTransform(1, 0, 0, 1, 0, 0);
  c2.clearRect(0, 0, w, h);
  c2.fillStyle = "#000";
  c2.fillRect(0, 0, w, h);
  const rot = P.rotate;
  c2.save();
  if (rot) {
    c2.translate(w / 2, h / 2);
    c2.rotate((rot * Math.PI) / 180);
    c2.translate(-h / 2, -w / 2);
  }
  const bw = rot ? h : w;
  const bh = rot ? w : h;

  if (P.mode === "artwork" && P.artwork && P.artworkSize) {
    c2.restore(); // the artwork painter applies its own rotation
    const usedPx = paintBleedArtworkCoverage(c2, { bh, bw, h, w }, P);
    return { canvas: target, usedPx };
  }

  // Letters: fontPicker size is the em size in scene pixels.
  const px = Math.max(1, P.fontSize * pixelScale);
  c2.fillStyle = "#fff";
  c2.textBaseline = "middle";
  c2.textAlign = "center";
  c2.font = `${P.fontWeight} ${px}px ${P.fontFamily}`;
  const track = P.letterSpacingEm * px;
  const lh = px * P.lineHeight;
  const lines = applyBleedTextCase(P.text, P.textCase).split("\n");
  const y0 = bh / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => {
    const chars = [...ln];
    let total = 0;
    for (const ch of chars) total += c2.measureText(ch).width + track;
    total -= track;
    let x = bw / 2 - total / 2 + P.shiftX * bw;
    const y = y0 + i * lh + P.shiftY * bh;
    for (const ch of chars) {
      const cw = c2.measureText(ch).width;
      c2.fillText(ch, x + cw / 2, y);
      x += cw + track;
    }
  });
  c2.restore();
  return { canvas: target, usedPx: px };
}
