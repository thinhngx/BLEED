import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { acquireBleedEngine } from "./bleed-preview";
import { exportCoveragePass, exportShadePass } from "./bleed-pipeline-contract";
import {
  buildBleedFrameCoverage,
  resolveBleedSource,
  shadeBleedFrame,
} from "./bleed-render";

/**
 * Runtime-owned PNG export. Renders the same coverage → blur → shade passes at
 * the export resolution (BLEED alpha-out), then draws the transparent
 * foreground into the runtime destination; Background is composited by runtime.
 */
export const bleedExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "bleed",
  async renderFrame({ context, frame, pixelRatio, rendererPipeline, signal, state }) {
    if (!rendererPipeline) {
      throw new Error("BLEED export requires its registered renderer pipeline.");
    }
    const width = Math.max(1, Math.round(frame.width * pixelRatio));
    const height = Math.max(1, Math.round(frame.height * pixelRatio));
    const resolved = await resolveBleedSource(state.values, state.mediaAssets, null);
    signal.throwIfAborted();
    const staging = new OffscreenCanvas(1, 1);
    try {
      await rendererPipeline.runPass(exportShadePass, undefined, async () => {
        const engine = await acquireBleedEngine(rendererPipeline);
        const coverage = await rendererPipeline.runPass(exportCoveragePass, undefined, () =>
          buildBleedFrameCoverage(staging, width, height, pixelRatio, resolved),
        );
        signal.throwIfAborted();
        const shaded = shadeBleedFrame(engine, coverage, state.values, resolved, pixelRatio);
        context.save();
        try {
          context.drawImage(shaded, frame.x, frame.y, frame.width, frame.height);
        } finally {
          context.restore();
        }
      });
    } finally {
      staging.width = 1;
      staging.height = 1;
    }
  },
};
