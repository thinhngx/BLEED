// Artwork → coverage (BLEED: alpha / luminance / inverse-luminance channel).
// Channel conversion uses canvas blend modes directly on the coverage context:
// "saturation" with a gray fill is a Rec.601-style grayscale (0.30/0.59/0.11),
// which keeps the whole conversion on the GPU-friendly compositor path.
import type { BleedSourceInput } from "./bleed-source";

type ArtworkBox = Readonly<{ bh: number; bw: number; h: number; w: number }>;

function fillCanvas(
  c2: OffscreenCanvasRenderingContext2D,
  operation: GlobalCompositeOperation,
  color: string,
  w: number,
  h: number,
): void {
  c2.save();
  c2.setTransform(1, 0, 0, 1, 0, 0);
  c2.globalCompositeOperation = operation;
  c2.fillStyle = color;
  c2.fillRect(0, 0, w, h);
  c2.restore();
}

/** Draws the fitted artwork as grayscale coverage into `c2`; returns the used height in px. */
export function paintBleedArtworkCoverage(
  c2: OffscreenCanvasRenderingContext2D,
  box: ArtworkBox,
  P: BleedSourceInput,
): number {
  const { bh, bw, h, w } = box;
  const rot = P.rotate;
  const size = P.artworkSize!;
  const k = (P.artFit * bh) / size.height;
  const dw = size.width * k;
  const dh = size.height * k;
  const channel = P.artChannel;

  // Backdrop: transparent for alpha, black for luminance, white for inverse luminance.
  c2.save();
  c2.setTransform(1, 0, 0, 1, 0, 0);
  c2.clearRect(0, 0, w, h);
  c2.restore();
  if (channel === "luminance") fillCanvas(c2, "source-over", "#000", w, h);
  if (channel === "inverted") fillCanvas(c2, "source-over", "#fff", w, h);

  c2.save();
  if (rot) {
    c2.translate(w / 2, h / 2);
    c2.rotate((rot * Math.PI) / 180);
    c2.translate(-h / 2, -w / 2);
  }
  c2.drawImage(P.artwork!, bw / 2 - dw / 2 + P.shiftX * bw, bh / 2 - dh / 2 + P.shiftY * bh, dw, dh);
  c2.restore();

  if (channel === "alpha") {
    fillCanvas(c2, "source-in", "#fff", w, h);
    fillCanvas(c2, "destination-over", "#000", w, h);
  } else {
    fillCanvas(c2, "saturation", "#808080", w, h);
    if (channel === "inverted") fillCanvas(c2, "difference", "#fff", w, h);
  }
  return dh;
}
