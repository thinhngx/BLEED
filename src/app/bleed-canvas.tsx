import * as React from "react";
import type { ToolcraftSceneRect } from "@/toolcraft/runtime";

import {
  bindBleedArtworkImage,
  getBleedArtworkSvgUrl,
  subscribeBleedArtworkSvg,
} from "./bleed-render";
import { BLEED_DISPLAY_TITLE } from "./bleed-display-title";
import { getBleedRenderScale, useBleedPreview } from "./use-bleed-preview";

export { getBleedRenderScale };

export function getBleedSceneBounds(
  size: Readonly<{ height: number; width: number }>,
): ToolcraftSceneRect {
  return {
    height: size.height,
    width: size.width,
    x: -size.width / 2,
    y: -size.height / 2,
  };
}

export function BleedCanvas(): React.JSX.Element {
  React.useEffect(() => {
    document.title = BLEED_DISPLAY_TITLE;
  }, []);
  const preview = useBleedPreview();
  const artworkSvgUrl = React.useSyncExternalStore(
    subscribeBleedArtworkSvg,
    getBleedArtworkSvgUrl,
    () => null,
  );
  return (
    <>
      <canvas
        aria-label="BLEED output"
        data-bleed-backing={`${preview.backingWidth}x${preview.backingHeight}`}
        data-bleed-failure={preview.failure ?? undefined}
        data-bleed-frame-count={preview.frameCount}
        data-bleed-product=""
        ref={preview.canvasRef}
        style={{
          display: "block",
          height: preview.cssHeight,
          width: preview.cssWidth,
        }}
      />
      {artworkSvgUrl ? (
        <img
          alt=""
          aria-hidden="true"
          data-bleed-artwork-source=""
          hidden
          key={artworkSvgUrl}
          ref={bindBleedArtworkImage}
          src={artworkSvgUrl}
        />
      ) : null}
    </>
  );
}
