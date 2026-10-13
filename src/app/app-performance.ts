import {
  defineToolcraft,
  defineToolcraftDiscreteFixtureAdapter,
  defineToolcraftFixtureAdapter,
  defineToolcraftPerformance,
  deriveToolcraftPerformancePaths,
  type ToolcraftEnvelopePerformanceConfig,
  type ToolcraftPerformanceScenario,
} from "@/toolcraft/runtime";

import { appIdentity } from "./app-identity";

import { appRendererPipelineRegistration } from "./bleed-pipeline-contract";

export {
  appRendererPipelineRegistration,
  exportCoveragePass,
  exportShadePass,
  previewCoveragePass,
  previewShadePass,
  resourcesPass,
} from "./bleed-pipeline-contract";

const referenceRuntime = {
  backend: "webgl",
  exception: {
    evidence:
      "BLEED (thinhngx/BLEED c9bac40) is a hand-written WebGL2 two-pass separable blur + shade program; reference-runtime-clone keeps its GLSL verbatim for parity.",
    kind: "reference-parity",
  },
  provider: "reference-runtime",
} as const;

export type BleedPreviewPixelFixture = Readonly<{
  backingHeight: number;
  backingWidth: number;
  canvasHeight: number;
  canvasWidth: number;
  renderScale: 2;
}>;

function createPreviewPixelFixture(value: number): BleedPreviewPixelFixture {
  const whole = Math.round(value);
  if (!Number.isSafeInteger(whole) || Math.abs(whole - value) > 0.000_001 || whole <= 0) {
    throw new Error(`Preview pixels must be a positive whole count, received ${value}.`);
  }
  for (let backingWidth = 8_192; backingWidth >= 2; backingWidth -= 2) {
    const backingHeight = whole / backingWidth;
    if (
      Number.isSafeInteger(backingHeight) &&
      backingHeight >= 2 &&
      backingHeight <= 8_192 &&
      backingHeight % 2 === 0
    ) {
      return Object.freeze({
        backingHeight,
        backingWidth,
        canvasHeight: backingHeight / 2,
        canvasWidth: backingWidth / 2,
        renderScale: 2,
      });
    }
  }
  throw new Error(`Preview pixel count ${value} has no exact render-scale-2 canvas fixture.`);
}

const bleedFixtureAdapters = {
  dimensions: {
    "export-long-edge": defineToolcraftDiscreteFixtureAdapter({
      dimensionId: "export-long-edge",
      domain: {
        kind: "schema-options",
        optionValues: ["2k", "4k", "8k"],
        target: "export.image.resolution",
      },
      entries: [
        { appliedValue: "2k", value: 2_048 },
        { appliedValue: "4k", value: 4_096 },
        { appliedValue: "8k", value: 8_192 },
      ],
    }),
    "export-pixels": defineToolcraftDiscreteFixtureAdapter({
      dimensionId: "export-pixels",
      domain: {
        attestation:
          "The three resolution options applied to the default 3:2 scene bounds exhaust the reachable exported pixel counts.",
        inputs: ["export-long-edge"],
        kind: "derived",
      },
      entries: [
        { appliedValue: "2k", value: 2_795_520 },
        { appliedValue: "4k", value: 11_186_176 },
        { appliedValue: "8k", value: 44_736_512 },
      ],
    }),
    "preview-pixels": defineToolcraftFixtureAdapter<BleedPreviewPixelFixture>({
      apply: createPreviewPixelFixture,
      dimensionId: "preview-pixels",
      observe: ({ backingHeight, backingWidth }) => backingHeight * backingWidth,
    }),
  },
};

const basePerformance: ToolcraftEnvelopePerformanceConfig =
  defineToolcraftPerformance({
    fixtureAdapters: bleedFixtureAdapters,
    rendererPipeline: appRendererPipelineRegistration,
    rendererStrategy: "webgl",
    rendererTechnique: {
      exportRenderer: "webgl",
      fidelityRisks: [
        "Preview and export must rasterize identical coverage geometry at their own backing scale (font px, blur sigma, grain cell and emboss radius all scale with pixel scale).",
        "Google fonts must finish loading before coverage rasterization or glyph metrics change.",
      ],
      gpu: { export: referenceRuntime, preview: referenceRuntime },
      intentionalRasterizationReason:
        "BLEED inflates a rasterized coverage map with a Gaussian field; the product is pixel-native.",
      layers: [
        {
          content: ["shader"],
          exportMode: "included",
          id: "bleedForeground",
          kind: "product-foreground",
          primitiveCount: "low",
          renderer: "webgl",
          uiSelector: 'canvas[data-bleed-product=""]',
        },
      ],
      performanceRisks: [
        "Blur cost scales with backing pixels; the separable kernel is capped at 145 taps by stride so sigma does not grow cost.",
        "8K export allocates two half-float targets at full export resolution.",
      ],
      previewRenderer: "webgl",
      productRepresentation: "pixel",
      rendererStrategy: "webgl",
      sourceRepresentation: "reference-runtime",
      whyNotAlternativeStrategies: [
        "Canvas 2D cannot run the per-pixel dome/normal/grain shader at interactive rates.",
        "WebGPU would require rewriting the reference GLSL and break reference parity.",
      ],
    },
    scenarios: [],
    usesCustomRenderer: true,
    workloadEnvelope: {
      dimensions: [
        {
          batchMax: 16_777_216,
          defaultValue: 3_840_000,
          id: "preview-pixels",
          interactiveMax: 16_777_216,
          mapping: "direct",
          source: { kind: "runtime-state", path: "canvas.backingPixelsAtSelectedRenderScale" },
          unit: "pixels",
        },
        {
          batchMax: 8_192,
          customMappingReason: "The image resolution option maps to its exact numeric long edge.",
          defaultValue: 4_096,
          id: "export-long-edge",
          mapping: "custom",
          source: { kind: "schema-target", target: "export.image.resolution" },
          unit: "pixels",
        },
        {
          batchMax: 44_736_512,
          defaultValue: 11_186_176,
          id: "export-pixels",
          mapping: "direct",
          source: { inputs: ["export-long-edge"], kind: "derived" },
          unit: "pixels",
        },
      ],
    },
  });

const rendererPathSchema = defineToolcraft({
  base: {
    canvas: { enabled: true },
    identity: appIdentity,
    panels: { controls: { sections: [], title: "Controls" } },
  },
  modules: [],
});

export function deriveBleedPerformancePaths(
  performance: ToolcraftEnvelopePerformanceConfig,
) {
  return deriveToolcraftPerformancePaths(rendererPathSchema, performance);
}

function bleedScenarioLocator(
  path: Readonly<{ interaction: string; targets: readonly string[] }>,
): Readonly<Record<string, string>> {
  if (path.interaction === "control-drag") return { controlLabel: "Amount" };
  if (path.interaction === "control-change") {
    return {
      uiSelector: '[data-toolcraft-control-target="canvas.renderScale"]',
    };
  }
  return {};
}

const scenarios = deriveBleedPerformancePaths(basePerformance).map(
  (path): ToolcraftPerformanceScenario => {
    const common = {
      automated: true,
      automatedTestName: `perf: bleed ${path.id}`,
      browser: true,
      browserTestName: `browser perf: bleed ${path.id}`,
      coversTargets: path.targets,
      expectedObservable: `The ${path.interaction} path keeps the BLEED shader output intact.`,
      fixture: "bleed default artwork",
      id: `bleed-${path.id}`,
      pathId: path.id,
      ...(path.targets.length === 1 ? { target: path.targets[0] } : {}),
    };
    if (path.interaction === "export") {
      return {
        ...common,
        actionValue: "export.png",
        completionEvidence: "download",
        controlLabel: "Export PNG",
        interaction: "export",
      };
    }
    return {
      ...common,
      ...bleedScenarioLocator(path),
      interaction: path.interaction,
    };
  },
);

export const appPerformance = defineToolcraftPerformance({
  ...basePerformance,
  scenarios,
});

export const appPerformancePaths = deriveBleedPerformancePaths(appPerformance);
