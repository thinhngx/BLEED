import type { ToolcraftRendererPipelineClient } from "@/toolcraft/runtime";

import { createBleedGlEngine, type BleedGlEngine } from "./bleed-gl";
import {
  previewCoveragePass,
  previewShadePass,
  resourcesPass,
} from "./bleed-pipeline-contract";
import {
  buildBleedFrameCoverage,
  resolveBleedSource,
  shadeBleedFrame,
} from "./bleed-render";

export function acquireBleedEngine(
  pipeline: ToolcraftRendererPipelineClient,
): Promise<BleedGlEngine> {
  return pipeline.runPass(resourcesPass, { "renderer.resources": "bleed-webgl2" }, (context) =>
    context.getOrCreateResource(
      ["bleed-engine"],
      () => createBleedGlEngine(),
      (engine) => engine.dispose(),
    ),
  );
}

function presentBleedFrame(
  canvas: HTMLCanvasElement,
  shaded: OffscreenCanvas,
  width: number,
  height: number,
): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BLEED preview requires Canvas 2D.");
  context.clearRect(0, 0, width, height);
  context.drawImage(shaded, 0, 0, width, height);
}

let coverageCanvas: OffscreenCanvas | null = null;

/** Shrinks the reusable coverage buffer so an unmounted preview holds no pixels. */
export function releaseBleedCoverage(): void {
  if (!coverageCanvas) return;
  coverageCanvas.width = 1;
  coverageCanvas.height = 1;
}

type ResolveArgs = Parameters<typeof resolveBleedSource>;

export type BleedPreviewRequest = Readonly<{
  backingHeight: number;
  backingWidth: number;
  isCurrent: () => boolean;
  mediaAssets: ResolveArgs[1];
  pipeline: ToolcraftRendererPipelineClient;
  pixelScale: number;
  urls: ResolveArgs[2];
  values: ResolveArgs[0];
}>;

/** One preview frame: resolve source → coverage pass → WebGL2 shade pass → present. */
export async function renderBleedPreview(
  canvas: HTMLCanvasElement,
  request: BleedPreviewRequest,
): Promise<void> {
  const { backingHeight, backingWidth, isCurrent, pipeline, pixelScale } = request;
  const { mediaAssets, urls, values } = request;
  const resolved = await resolveBleedSource(values, mediaAssets, urls);
  if (!isCurrent()) return;
  await pipeline.runPass(previewShadePass, undefined, async () => {
    const engine = await acquireBleedEngine(pipeline);
    if (!isCurrent()) return;
    coverageCanvas ??= new OffscreenCanvas(1, 1);
    const target = coverageCanvas;
    const coverage = await pipeline.runPass(previewCoveragePass, undefined, () =>
      buildBleedFrameCoverage(target, backingWidth, backingHeight, pixelScale, resolved),
    );
    if (!isCurrent()) return;
    const shaded = shadeBleedFrame(engine, coverage, values, resolved, pixelScale);
    presentBleedFrame(canvas, shaded, backingWidth, backingHeight);
  });
}

/** Runs one preview frame and reports success (`null`) or a failure message while still current. */
export async function runBleedPreview(
  canvas: HTMLCanvasElement,
  request: BleedPreviewRequest,
  report: (failure: string | null) => void,
): Promise<void> {
  try {
    await renderBleedPreview(canvas, request);
    if (request.isCurrent()) report(null);
  } catch (error) {
    if (request.isCurrent()) report(error instanceof Error ? error.message : String(error));
  }
}

/** Fire-and-forget wrapper for effects: starts a frame without exposing the promise. */
export function startBleedPreview(
  canvas: HTMLCanvasElement,
  request: BleedPreviewRequest,
  report: (failure: string | null) => void,
): void {
  void runBleedPreview(canvas, request, report);
}

/**
 * Mutable hand-off slot: callers assign typed fields and invoke `start()` with no arguments,
 * so no DOM, store, or pipeline payload is forwarded through a call boundary.
 */
export type BleedPreviewSlot = {
  canvas: HTMLCanvasElement | null;
  report: ((failure: string | null) => void) | null;
  request: BleedPreviewRequest | null;
  start: () => void;
};

function createBleedPreviewSlot(): BleedPreviewSlot {
  const slot: BleedPreviewSlot = {
    canvas: null,
    report: null,
    request: null,
    start: () => {
      const { canvas, report, request } = slot;
      if (!canvas || !report || !request) return;
      startBleedPreview(canvas, request, report);
    },
  };
  return slot;
}

/** The single BLEED preview instance owns one slot, matching the module-level coverage canvas. */
export const bleedPreviewSlot: BleedPreviewSlot = createBleedPreviewSlot();
