// Shared preview/export frame assembly: state values → typography/artwork →
// coverage (main) → blur + shade (WebGL2). Preview and export call the same
// functions with different backing sizes so output matches pixel-for-pixel at
// equal scale.

import { getFontPickerFontById, type FontPickerValue } from "@/toolcraft/ui";

import type { BleedGlEngine } from "./bleed-gl";
import {
  readBleedMaterial,
  type BleedArtChannel,
  type BleedSourceMode,
} from "./bleed-params";
import {
  buildBleedCoverage,
  type BleedCoverage,
  type BleedSourceInput,
  type BleedTextCase,
} from "./bleed-source";

const letterSpacingEm: Record<string, number> = {
  normal: 0,
  tight: -0.025,
  tighter: -0.05,
  tightest: -0.1,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
};
const lineHeightRatio: Record<string, number> = {
  loose: 2,
  none: 1,
  normal: 1.5,
  relaxed: 1.625,
  snug: 1.375,
  spacious: 1.75,
  tight: 1.25,
};

export const bleedDefaultFont = {
  color: "#FFFFFF",
  fontId: "arimo",
  fontSize: 367,
  fontWeight: "700",
  letterSpacing: "tight",
  lineHeight: "none",
  opacity: 100,
  textCase: "original",
} as const satisfies FontPickerValue;

type Values = Readonly<Record<string, unknown>>;
type MediaLike = Readonly<{
  assetKind: string;
  id: string;
  sourceSize?: Readonly<{ height: number; width: number }>;
  sourceTarget?: string;
}>;

/* ------------------------------------------------------------ asset cache */

type LoadedArtwork = Readonly<{
  image: ImageBitmap;
  size: { height: number; width: number };
}>;
const artworkCache = new Map<string, Promise<LoadedArtwork>>();
const fontFileCache = new Map<string, Promise<string>>();
const googleFontCache = new Map<string, Promise<void>>();

export function findBleedMedia(
  mediaAssets: readonly MediaLike[],
  target: "source.artwork" | "source.fontFile",
): MediaLike | null {
  return mediaAssets.find((asset) => asset.sourceTarget === target) ?? null;
}

// SVG artwork: Chromium cannot decode SVG through createImageBitmap(Blob), and an
// <img> of a viewBox-only SVG rasterizes blank. The loader therefore rewrites the SVG
// root with an explicit natural size (long side 4096 px, vector-crisp for export),
// publishes it as a data URL for the hidden <img> in BleedCanvas, and rasterizes
// that decoded element with createImageBitmap.
const SVG_RASTER_MAX = 4096;
let artworkElement: HTMLImageElement | null = null;
let artworkSvgUrl: string | null = null;
const artworkSvgListeners = new Set<() => void>();

/** JSX ref target for the hidden artwork <img>; keyed by URL so each drop remounts it. */
export function bindBleedArtworkImage(element: HTMLImageElement | null): void {
  artworkElement = element;
}

export function subscribeBleedArtworkSvg(listener: () => void): () => void {
  artworkSvgListeners.add(listener);
  return () => artworkSvgListeners.delete(listener);
}

export function getBleedArtworkSvgUrl(): string | null {
  return artworkSvgUrl;
}

function publishArtworkSvg(url: string): void {
  artworkSvgUrl = url;
  for (const listener of artworkSvgListeners) listener();
}

const rasterizeImageElement: (
  image: HTMLImageElement,
) => Promise<ImageBitmap> = (image) => createImageBitmap(image);

function isSvgBlob(blob: Blob): boolean {
  return blob.type.includes("svg");
}

/** Gives the SVG root an explicit pixel size so browsers can rasterize it. */
export function sizeBleedSvg(source: string): string {
  const open = /<svg\b[^>]*>/iu.exec(source);
  if (!open) return source;
  const tag = open[0];
  const number = String.raw`(-?[\d.]+(?:e-?\d+)?)`;
  const viewBox = new RegExp(
    String.raw`viewBox\s*=\s*["']\s*${number}[\s,]+${number}[\s,]+${number}[\s,]+${number}`,
    "iu",
  ).exec(tag);
  const attr = (name: string) => {
    const match = new RegExp(
      String.raw`\s${name}\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']`,
      "iu",
    ).exec(tag);
    return match ? Number(match[1]) : 0;
  };
  const baseWidth = viewBox ? Number(viewBox[3]) : attr("width");
  const baseHeight = viewBox ? Number(viewBox[4]) : attr("height");
  if (!(baseWidth > 0 && baseHeight > 0)) return source;
  const scale = SVG_RASTER_MAX / Math.max(baseWidth, baseHeight);
  const width = Math.max(1, Math.round(baseWidth * scale));
  const height = Math.max(1, Math.round(baseHeight * scale));
  let next = tag.replace(/\s(?:width|height)\s*=\s*(["'])[^"']*\1/giu, "");
  if (!viewBox)
    next = next.replace(
      /^<svg/iu,
      `<svg viewBox="0 0 ${baseWidth} ${baseHeight}"`,
    );
  next = next.replace(/^<svg/iu, `<svg width="${width}" height="${height}"`);
  return (
    source.slice(0, open.index) + next + source.slice(open.index + tag.length)
  );
}

async function rasterizeSvgArtwork(blob: Blob): Promise<ImageBitmap> {
  const sized = sizeBleedSvg(await blob.text());
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  publishArtworkSvg(url);
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const element = artworkElement;
    if (element && element.getAttribute("src") === url) {
      await element.decode();
      return rasterizeImageElement(element);
    }
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error("BLEED artwork image element never mounted.");
}

/** Registers the presentation URL for a media asset so export can reuse it. */
export function loadBleedArtwork(
  mediaId: string,
  url: string,
): Promise<LoadedArtwork> {
  let pending = artworkCache.get(mediaId);
  if (!pending) {
    pending = fetch(url)
      .then((response) => response.blob())
      .then((blob) =>
        isSvgBlob(blob) ? rasterizeSvgArtwork(blob) : createImageBitmap(blob),
      )
      .then((image) => ({
        image,
        size: { height: image.height || 1, width: image.width || 1 },
      }))
      .catch(() => {
        throw new Error("BLEED could not decode the dropped artwork.");
      });
    artworkCache.set(mediaId, pending);
    pending.catch(() => artworkCache.delete(mediaId));
  }
  return pending;
}

export function loadBleedFontFile(
  mediaId: string,
  url: string,
): Promise<string> {
  let pending = fontFileCache.get(mediaId);
  if (!pending) {
    const family = `bleed-drop-${mediaId.replace(/[^a-z0-9-]/giu, "")}`;
    pending = fetch(url)
      .then((response) => response.arrayBuffer())
      .then(async (bytes) => {
        const face = new FontFace(family, bytes);
        await face.load();
        document.fonts.add(face);
        return family;
      });
    fontFileCache.set(mediaId, pending);
    pending.catch(() => fontFileCache.delete(mediaId));
  }
  return pending;
}

function cssFamily(family: string): string {
  return `"${family.replace(/"/gu, '\\"')}"`;
}

async function ensureGoogleFont(
  fontId: string,
  weight: string,
): Promise<string> {
  const entry = getFontPickerFontById(fontId);
  if (!entry) return "sans-serif";
  const family = cssFamily(entry.family);
  const key = `${entry.id}:${weight}`;
  let pending = googleFontCache.get(key);
  if (!pending) {
    pending = (async () => {
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(entry.family).replace(/%20/gu, "+")}:wght@${weight}&display=block`;
      // Register the face through the FontFace API; no stylesheet element is injected.
      const css = await fetch(href)
        .then((response) => response.text())
        .catch(() => "");
      const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/gu)].flatMap(
        (block) => {
          const body = block[1] ?? "";
          const url = /url\((https:[^)]+)\)/u.exec(body)?.[1];
          if (!url) return [];
          const descriptors: FontFaceDescriptors = {
            unicodeRange: /unicode-range:\s*([^;]+);/u.exec(body)?.[1]?.trim(),
            weight:
              /font-weight:\s*([^;]+);/u.exec(body)?.[1]?.trim() ?? weight,
          };
          return [new FontFace(entry.family, `url(${url})`, descriptors)];
        },
      );
      await Promise.all(
        faces.map((face) =>
          face
            .load()
            .then(() => document.fonts.add(face))
            .catch(() => undefined),
        ),
      );
      await document.fonts.load(`${weight} 64px ${family}`, "BLEED");
    })();
    googleFontCache.set(key, pending);
  }
  await pending;
  return `${family}, sans-serif`;
}

/* ----------------------------------------------------------- frame inputs */

export type BleedResolvedSource = Readonly<{
  ink: readonly [number, number, number];
  opacity: number;
  source: BleedSourceInput;
}>;

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
  if (!match) return [1, 1, 1];
  const n = Number.parseInt(match[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function readBleedFont(values: Values): FontPickerValue {
  const raw = values["source.font"];
  return {
    ...bleedDefaultFont,
    ...(raw && typeof raw === "object"
      ? (raw as Partial<FontPickerValue>)
      : {}),
  } as FontPickerValue;
}

/**
 * Resolves typography/artwork (loading fonts and images) for one exact state.
 * `urls` maps media id → presentation URL; export passes `null` and relies on
 * assets the preview already decoded.
 */
export async function resolveBleedSource(
  values: Values,
  mediaAssets: readonly MediaLike[],
  urls: ReadonlyMap<string, string> | null,
): Promise<BleedResolvedSource> {
  const mode: BleedSourceMode =
    values["source.mode"] === "artwork" ? "artwork" : "text";
  const font = readBleedFont(values);
  const fontMedia = findBleedMedia(mediaAssets, "source.fontFile");
  const artMedia = findBleedMedia(mediaAssets, "source.artwork");

  let fontFamily = "sans-serif";
  if (mode === "text") {
    const dropUrl = fontMedia ? urls?.get(fontMedia.id) : undefined;
    const dropped =
      fontMedia &&
      (dropUrl
        ? loadBleedFontFile(fontMedia.id, dropUrl)
        : fontFileCache.get(fontMedia.id));
    fontFamily = dropped
      ? `${cssFamily(await dropped)}, sans-serif`
      : await ensureGoogleFont(font.fontId, font.fontWeight);
  }

  let artwork: LoadedArtwork | null = null;
  if (mode === "artwork" && artMedia) {
    const url = urls?.get(artMedia.id);
    const pending = url
      ? loadBleedArtwork(artMedia.id, url)
      : artworkCache.get(artMedia.id);
    artwork = pending ? await pending : null;
  }

  const channel = values["source.artChannel"];
  const rotate = Number(values["source.rotate"]);
  return {
    ink: hexToRgb(font.color),
    opacity: Math.max(0, Math.min(1, finite(font.opacity, 100) / 100)),
    source: {
      artChannel: (channel === "luminance" || channel === "inverted"
        ? channel
        : "alpha") as BleedArtChannel,
      artFit: finite(values["source.artFit"], 0.6),
      artwork: artwork?.image ?? null,
      artworkSize: artwork ? (artMedia?.sourceSize ?? artwork.size) : null,
      fontFamily,
      fontSize: Math.max(1, finite(font.fontSize, bleedDefaultFont.fontSize)),
      fontWeight: font.fontWeight,
      letterSpacingEm: letterSpacingEm[font.letterSpacing] ?? 0,
      lineHeight: lineHeightRatio[font.lineHeight] ?? 1,
      mode,
      rotate: rotate === 90 || rotate === -90 ? rotate : 0,
      shiftX: finite(values["source.shiftX"], 0),
      shiftY: finite(values["source.shiftY"], 0),
      text:
        typeof values["source.text"] === "string" ? values["source.text"] : "",
      textCase: font.textCase as BleedTextCase,
    },
  };
}

export function buildBleedFrameCoverage(
  target: OffscreenCanvas,
  width: number,
  height: number,
  pixelScale: number,
  resolved: BleedResolvedSource,
): BleedCoverage {
  return buildBleedCoverage(target, width, height, pixelScale, resolved.source);
}

export function shadeBleedFrame(
  engine: BleedGlEngine,
  coverage: BleedCoverage,
  values: Values,
  resolved: BleedResolvedSource,
  pixelScale: number,
): OffscreenCanvas {
  engine.render(coverage.canvas, {
    ink: resolved.ink,
    material: readBleedMaterial(values),
    opacity: resolved.opacity,
    pixelScale,
    seed: finite(values["grain.seed"], 7),
    usedPx: coverage.usedPx,
  });
  return engine.canvas;
}
