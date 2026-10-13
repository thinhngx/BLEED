import * as React from "react";
import {
  useToolcraftMediaPresentationUrls,
  useToolcraftPipeline,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
  useToolcraftValue,
} from "@/toolcraft/runtime/react";

import {
  bleedPreviewSlot,
  releaseBleedCoverage,
} from "./bleed-preview";

export function getBleedRenderScale(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(2, Math.max(1, value))
    : 2;
}

export type BleedPreviewState = Readonly<{
  backingHeight: number;
  backingWidth: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cssHeight: number;
  cssWidth: number;
  failure: string | null;
  frameCount: number;
}>;

/** Owns the BLEED preview lifecycle so the component never forwards DOM or store payloads. */
export function useBleedPreview(): BleedPreviewState {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const generationRef = React.useRef(0);
  const [frameCount, setFrameCount] = React.useState(0);
  const [failure, setFailure] = React.useState<string | null>(null);
  const sceneFrame = useToolcraftProductSceneFrame();
  const pipeline = useToolcraftPipeline();
  const renderScale = getBleedRenderScale(useToolcraftValue("canvas.renderScale"));
  const values = useToolcraftSelector((state) => state.values);
  const mediaAssets = useToolcraftSelector((state) => state.mediaAssets);
  const urls = useToolcraftMediaPresentationUrls(mediaAssets);
  const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  const cssWidth = sceneFrame.kind === "ready" ? sceneFrame.rect.width : 0;
  const cssHeight = sceneFrame.kind === "ready" ? sceneFrame.rect.height : 0;
  const pixelScale = devicePixelRatio * renderScale;
  const backingWidth = Math.ceil(cssWidth * pixelScale);
  const backingHeight = Math.ceil(cssHeight * pixelScale);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pipeline || backingWidth <= 0 || backingHeight <= 0) return;
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    const slot = bleedPreviewSlot;
    slot.canvas = canvas;
    slot.report = (failureMessage) => {
      setFailure(failureMessage);
      if (failureMessage === null) setFrameCount((count) => count + 1);
    };
    slot.request = {
      backingHeight,
      backingWidth,
      isCurrent,
      mediaAssets,
      pipeline,
      pixelScale,
      urls,
      values,
    };
    slot.start();
  }, [backingHeight, backingWidth, mediaAssets, pipeline, pixelScale, urls, values]);

  React.useEffect(
    () => () => {
      generationRef.current += 1;
      releaseBleedCoverage();
    },
    [],
  );

  return { backingHeight, backingWidth, canvasRef, cssHeight, cssWidth, failure, frameCount };
}
