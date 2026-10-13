import { expect } from "@playwright/test";

import { appPerformancePaths } from "../src/app/app-performance";
import {
  bleedCanvasSelector,
  createBleedFixtureApplications,
  observeBleedOutcome,
  performBleedPathAction,
  prepareBleedMediaImport,
  prepareBleedPerformance,
} from "./bleed-performance-support";
import type {
  ToolcraftPerformanceCanvasBacking,
  ToolcraftPerformancePathAdapter,
} from "./performance-path-adapter-contract";

export const appPerformanceCanvasBacking:
  | ToolcraftPerformanceCanvasBacking
  | undefined = Object.freeze({ canvasSelector: bleedCanvasSelector });

export const appPerformancePathAdapters = appPerformancePaths.map(
  (path): ToolcraftPerformancePathAdapter => {
    const common = {
      pathId: path.id,
      ...(path.targets.includes("canvas.renderScale") ? { preparationRenderScale: 1 } : {}),
      prepare: path.interaction === "media-import" ? prepareBleedMediaImport : prepareBleedPerformance,
      ...(path.workloadDimensions.length > 0
        ? {
            fixtureApplications: (page: Parameters<typeof createBleedFixtureApplications>[0]) =>
              createBleedFixtureApplications(page, path.workloadDimensions),
          }
        : {}),
    };
    if (path.interaction === "export") {
      return {
        ...common,
        output: {
          kind: "download",
          label: "Export PNG",
          verify: async (download) => {
            const stream = await download.createReadStream();
            let bytes = 0;
            for await (const chunk of stream) bytes += chunk.length;
            expect(bytes).toBeGreaterThan(100);
          },
        },
      };
    }
    return {
      ...common,
      action: ({ page }) => performBleedPathAction(page, path.interaction, path.targets),
      ...(new Set(["control-change", "control-drag", "media-import"]).has(path.interaction)
        ? { observeOutcome: ({ page }) => observeBleedOutcome(page) }
        : {
            verifyOutcome: async ({ page }) => {
              await expect(page.locator(bleedCanvasSelector)).toBeVisible();
            },
          }),
    };
  },
);
