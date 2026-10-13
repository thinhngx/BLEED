import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appRendererPipelineRegistration } from "./app-performance";
import { appSchema } from "./app-schema";
import { handleBleedPanelAction } from "./bleed-actions";
import { BleedCanvas, getBleedSceneBounds } from "./bleed-canvas";
import { bleedExportRenderer } from "./bleed-export";
import { BleedPresetListControl } from "./bleed-preset-list-control";
import { bleedPresetListType } from "./bleed-preset-library";

export const appComposition = composeToolcraftApp(appSchema, {
  actions: { onPanelAction: handleBleedPanelAction },
  controls: { renderers: { [bleedPresetListType]: BleedPresetListControl } },
  renderer: { pipelineRegistration: appRendererPipelineRegistration },
  scene: {
    canvasContent: <BleedCanvas />,
    rasterFrameRenderer: bleedExportRenderer,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getBleedSceneBounds(state.canvas.size)],
  },
});
