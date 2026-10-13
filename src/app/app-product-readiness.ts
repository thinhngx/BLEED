import type { ToolcraftProductReadiness } from "./acceptance/types";

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: { mode: "not-requested" },
  },
  interactionOwnership: [
    {
      alternative: {
        reason: "Panel buttons would separate continuous panning from the spatial viewport feedback it controls.",
        surface: "panel",
      },
      capability: "direct-spatial-edit",
      evidence: {
        detail: "Usability comparison selects direct canvas dragging for continuous viewport offset feedback.",
        source: "usability-analysis",
      },
      id: "viewport-pan",
      reason: "The canvas owns viewport panning because the gesture directly moves the visible world frame.",
      surface: "canvas",
      target: "canvas.setOffset",
    },
    {
      alternative: {
        reason: "Panel controls would duplicate runtime zoom tools and detach zoom focus from the visible canvas.",
        surface: "panel",
      },
      capability: "direct-spatial-edit",
      evidence: {
        detail: "Usability comparison selects canvas wheel and runtime zoom gestures around the active viewport focus.",
        source: "usability-analysis",
      },
      id: "viewport-zoom",
      reason: "The canvas owns viewport zoom because scale and focus require immediate spatial feedback.",
      surface: "canvas",
      target: "canvas.setViewport",
    },
  ],
  mode: "product",
  productName: "BLEED",
  productSummary: "A WebGL2 shader that inflates letterforms or artwork into grainy, dithered blobs.",
  requestedBehavior:
    "Edit text, fonts or dropped artwork, tune inflate, shading, grain and dissolve, save material-only presets, and export transparent PNGs.",
  viewInteraction: {
    mode: "non-spatial",
    reason: "BLEED output is a two-dimensional shaded image with no model camera.",
  },
};
