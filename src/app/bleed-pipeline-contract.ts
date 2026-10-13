import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

import type { BleedGlEngine } from "./bleed-gl";
import type { BleedCoverage } from "./bleed-source";
import { bleedMaterialTargets } from "./bleed-params";

type AppRendererPasses = {
  "export-coverage": ToolcraftRendererPipelinePassContract<BleedCoverage>;
  "export-shade": ToolcraftRendererPipelinePassContract<void>;
  "preview-coverage": ToolcraftRendererPipelinePassContract<BleedCoverage>;
  "preview-shade": ToolcraftRendererPipelinePassContract<void>;
  resources: ToolcraftRendererPipelinePassContract<
    BleedGlEngine,
    BleedGlEngine,
    readonly [string]
  >;
};

export const bleedSourceTargets = [
  "source.mode",
  "source.text",
  "source.font",
  "source.fontFile",
  "source.artwork",
  "source.artChannel",
  "source.artFit",
  "source.rotate",
  "source.shiftX",
  "source.shiftY",
] as const;

const materialTargets = Object.values(bleedMaterialTargets);
const continuousSourceTargets = [
  "source.artFit",
  "source.shiftX",
  "source.shiftY",
] as const;
const discreteSourceTargets = bleedSourceTargets.filter(
  (target) =>
    !(continuousSourceTargets as readonly string[]).includes(target) &&
    target !== "source.fontFile" &&
    target !== "source.artwork",
);
const continuousMaterialTargets = materialTargets.filter(
  (target) => target !== "grain.mode" && target !== "shading.invert",
);
const discreteMaterialTargets = ["grain.mode", "shading.invert"] as const;

const previewPassIds = ["preview-coverage", "preview-shade"] as const;
const shadePassOnly = ["preview-shade"] as const;
const exportPassIds = ["export-coverage", "export-shade"] as const;
const retained = {
  mustNotInvalidate: ["resources"],
  retainedAccesses: ["resources"],
} as const;
const artboardBounds = {
  kind: "intrinsic",
  reason:
    "BLEED rasterizes and shades exactly the authored artboard (canvas.size); every buffer is that finite output domain.",
} as const;

export const appRendererPipelineRegistration =
  registerToolcraftRendererPipeline<AppRendererPasses>()({
    interactionInvalidation: [
      { interaction: "initial-render", invalidates: ["resources", ...previewPassIds], targets: ["canvas.initial-render"] },
      { interaction: "control-drag", invalidates: previewPassIds, ...retained, targets: [...continuousSourceTargets] },
      { interaction: "control-drag", invalidates: shadePassOnly, ...retained, targets: [...continuousMaterialTargets, "grain.seed"] },
      { interaction: "control-change", invalidates: previewPassIds, ...retained, targets: [...discreteSourceTargets] },
      { interaction: "control-change", invalidates: shadePassOnly, ...retained, targets: [...discreteMaterialTargets, "presets.library"] },
      {
        interaction: "control-change",
        invalidates: previewPassIds,
        ...retained,
        targets: ["canvas.infinity", "canvas.aspectRatio", "canvas.size.width", "canvas.size.height", "canvas.renderScale"],
      },
      { interaction: "control-change", invalidates: shadePassOnly, ...retained, targets: ["export.includeBackground", "appearance.background"] },
      { interaction: "media-import", invalidates: previewPassIds, ...retained, targets: ["source.fontFile", "source.artwork"] },
      { interaction: "viewport-drag", invalidates: [], ...retained, targets: ["canvas.viewport.offset"] },
      { interaction: "viewport-zoom", invalidates: [], ...retained, targets: ["canvas.viewport.zoom"] },
      { interaction: "export", invalidates: exportPassIds, ...retained, targets: ["actions.output"] },
    ],
    passes: [
      {
        cacheKey: ["renderer.resources"],
        cost: { dimensions: [], frequency: "once", relationship: "constant" },
        gpu: { resources: "sampled-textures", stage: "render", state: "stateless", surfaces: ["preview", "export"] },
        id: "resources",
        inputs: ["renderer.resources"],
        invalidatedBy: ["renderer.resources"],
        kind: "preprocess",
        lifecycle: { cache: "retained-resource", resourceScope: "renderer" },
        output: "intermediate",
        quality: "full",
        runsOn: "gpu",
        sceneBounds: artboardBounds,
      },
      {
        cost: { dimensions: ["preview-pixels"], frequency: "interaction", relationship: "linear" },
        id: "preview-coverage",
        inputs: [...bleedSourceTargets, "canvas.backing.width", "canvas.backing.height"],
        invalidatedBy: [...bleedSourceTargets, "canvas.backing.width", "canvas.backing.height"],
        kind: "text-layout",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "intermediate",
        quality: "retina",
        runsOn: "main",
        sceneBounds: artboardBounds,
      },
      {
        cost: { dimensions: ["preview-pixels"], frequency: "interaction", relationship: "product" },
        gpu: { resources: "sampled-textures", stage: "render", state: "stateless", surfaces: ["preview"] },
        id: "preview-shade",
        inputs: ["resources", "preview-coverage", ...materialTargets, "grain.seed", "source.font", "destination.context"],
        invalidatedBy: ["preview-coverage", ...materialTargets, "grain.seed", "source.font", "destination.context"],
        kind: "pixel-transform",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "preview",
        quality: "retina",
        runsOn: "gpu",
        sceneBounds: artboardBounds,
      },
      {
        cost: { dimensions: ["export-pixels"], frequency: "batch", relationship: "linear" },
        id: "export-coverage",
        inputs: [...bleedSourceTargets, "export.image.resolution"],
        invalidatedBy: [...bleedSourceTargets, "export.image.resolution"],
        kind: "text-layout",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "intermediate",
        quality: "export",
        runsOn: "main",
        sceneBounds: artboardBounds,
      },
      {
        cost: { dimensions: ["export-pixels"], frequency: "batch", relationship: "product" },
        gpu: { resources: "sampled-textures", stage: "render", state: "stateless", surfaces: ["export"] },
        id: "export-shade",
        inputs: ["resources", "export-coverage", ...materialTargets, "grain.seed", "source.font", "destination.context"],
        invalidatedBy: ["export-coverage", ...materialTargets, "grain.seed", "source.font", "destination.context"],
        kind: "export",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "export",
        quality: "export",
        runsOn: "gpu",
      },
    ],
    runtimeId: "bleed-webgl2-v1",
  });

export const resourcesPass = appRendererPipelineRegistration.getPass("resources");
export const previewCoveragePass = appRendererPipelineRegistration.getPass("preview-coverage");
export const previewShadePass = appRendererPipelineRegistration.getPass("preview-shade");
export const exportCoveragePass = appRendererPipelineRegistration.getPass("export-coverage");
export const exportShadePass = appRendererPipelineRegistration.getPass("export-shade");
