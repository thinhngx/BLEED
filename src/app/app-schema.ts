import {
  defineToolcraft,
  imageExportModule,
  mediaSourceModule,
  type ToolcraftControlSchema,
} from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import { bleedActionValues, BLEED_PRESET_LIBRARY, BLEED_SEED } from "./bleed-actions";
import { bleedDefaultMaterial as D } from "./bleed-params";
import { BLEED_DISPLAY_TITLE } from "./bleed-display-title";
import { bleedPresetListType, createBleedDefaultPresetLibrary } from "./bleed-preset-library";
import { bleedDefaultFont } from "./bleed-render";

const always = { mode: "always" } as const;
const whenText = { all: [{ equals: "text", target: "source.mode" }], mode: "conditional" } as const;
const whenArtwork = { all: [{ equals: "artwork", target: "source.mode" }], mode: "conditional" } as const;
const shaderReason = "Uniform-only change: re-runs the blur + shade passes on the cached coverage map.";
const sourceReason = "Re-rasterizes the coverage map, then re-runs blur + shade.";

type SliderExtra = Partial<{
  applicability: typeof whenArtwork;
  performanceReason: string;
  unit: string;
}>;

function slider(
  target: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  extra: SliderExtra = {},
) {
  return {
    applicability: extra.applicability ?? always,
    defaultValue,
    label,
    max,
    min,
    performanceReason: extra.performanceReason ?? shaderReason,
    performanceRole: "responsiveness",
    sliderValueKind: "continuous",
    step,
    target,
    type: "slider",
    variant: "continuous",
    ...(extra.unit ? { unit: extra.unit } : {}),
  } as const satisfies ToolcraftControlSchema;
}

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      enabled: true,
      renderScale: true,
      size: { height: 800, unit: "px", width: 1200 },
      sizing: { mode: "editable-output" },
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: [
          {
            controls: {
              mode: {
                applicability: always,
                defaultValue: "text",
                label: false,
                options: [
                  { label: "Letters", value: "text" },
                  { label: "Artwork", value: "artwork" },
                ],
                orderRole: "mode",
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.mode",
                type: "segmented",
              },
              text: {
                applicability: whenText,
                commitMode: "content",
                defaultValue: "BLEED",
                label: "Letters",
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.text",
                textValueKind: "multiline",
                type: "code",
              },
              font: {
                applicability: whenText,
                defaultValue: bleedDefaultFont,
                label: "Font",
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.font",
                type: "fontPicker",
              },
              fontFile: {
                accept: ".otf,.ttf,.woff,.woff2,font/otf,font/ttf,font/woff,font/woff2",
                applicability: whenText,
                assetKind: "file",
                defaultValue: null,
                description: "A dropped font replaces the picked family; weight, size, spacing, and ink still apply.",
                label: "Custom font",
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.fontFile",
                type: "fileDrop",
              },
              artwork: {
                accept: "image/png,image/jpeg,image/webp,image/svg+xml,.svg",
                applicability: whenArtwork,
                assetKind: "file",
                defaultValue: null,
                label: "Artwork",
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.artwork",
                type: "fileDrop",
              },
              artChannel: {
                applicability: whenArtwork,
                defaultValue: "alpha",
                label: "Channel",
                options: [
                  { label: "Alpha", value: "alpha" },
                  { label: "Luminance", value: "luminance" },
                  { label: "Inverted luminance", value: "inverted" },
                ],
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.artChannel",
                type: "select",
              },
              artFit: slider("source.artFit", "Artwork size", 0.05, 1.6, 0.005, 0.6, {
                applicability: whenArtwork,
                performanceReason: sourceReason,
              }),
              rotate: {
                applicability: always,
                defaultValue: "0",
                label: "Rotate",
                options: [
                  { label: "−90°", value: "-90" },
                  { label: "0°", value: "0" },
                  { label: "90°", value: "90" },
                ],
                performanceReason: sourceReason,
                performanceRole: "responsiveness",
                target: "source.rotate",
                type: "segmented",
              },
              shiftX: slider("source.shiftX", "Shift X", -0.8, 0.8, 0.005, 0, { performanceReason: sourceReason }),
              shiftY: slider("source.shiftY", "Shift Y", -0.8, 0.8, 0.005, 0, { performanceReason: sourceReason }),
            },
            id: "source",
            title: "Source",
          },
          {
            controls: {
              amount: { ...slider("inflate.amount", "Inflate", 0.005, 0.4, 0.001, D.inflate), label: false },
              threshold: slider("inflate.threshold", "Fatness", 0.02, 0.9, 0.005, D.threshold),
              core: slider("inflate.core", "Dome depth", 0.02, 0.9, 0.005, D.core),
              dome: slider("inflate.dome", "Dome curve", 0.15, 2, 0.01, D.dome),
              edge: slider("inflate.edge", "Edge softness", 0, 0.25, 0.002, D.aa),
              emboss: slider("inflate.emboss", "Emboss", 0, 1.5, 0.01, D.emboss),
              embossSoftness: slider("inflate.embossSoftness", "Emboss softness", 0.5, 12, 0.1, D.embossSoft),
            },
            id: "inflate",
            title: "Inflate",
          },
          {
            controls: {
              lightAngle: slider("shading.lightAngle", "Light angle", 0, 360, 1, D.lightAng, { unit: "°" }),
              light: slider("shading.light", "Light amount", 0, 1, 0.01, D.lightAmt),
              ambient: slider("shading.ambient", "Ambient", 0, 1, 0.01, D.ambient),
              normal: slider("shading.normal", "Crease strength", 0, 30, 0.1, D.normAmt),
              rim: slider("shading.rim", "Rim light", 0, 1, 0.01, D.rim),
              warp: slider("shading.warp", "Organic warp", 0, 0.06, 0.001, D.warpAmt),
              warpScale: slider("shading.warpScale", "Warp scale", 0.4, 8, 0.05, D.warpScale),
              invert: {
                applicability: always,
                defaultValue: D.invert,
                label: "Invert",
                performanceReason: shaderReason,
                performanceRole: "responsiveness",
                target: "shading.invert",
                type: "switch",
              },
            },
            id: "shading",
            title: "Shading",
          },
          {
            controls: {
              mode: {
                applicability: always,
                defaultValue: D.grainMode,
                label: "Noise",
                options: [
                  { label: "White", value: "white" },
                  { label: "Value (clumpy)", value: "value" },
                  { label: "Bayer 8×8", value: "bayer" },
                  { label: "Blue-ish", value: "blue" },
                ],
                performanceReason: shaderReason,
                performanceRole: "responsiveness",
                target: "grain.mode",
                type: "select",
              },
              amount: slider("grain.amount", "Grain amount", 0, 1, 0.01, D.grainAmt),
              scale: slider("grain.scale", "Grain size", 0.3, 6, 0.05, D.grainScale),
              bias: slider("grain.bias", "Grain to edges", 0, 1, 0.01, D.gBias),
              dither: slider("grain.dither", "1-bit dither", 0, 1, 0.01, D.dither),
              seed: slider(BLEED_SEED, "Seed", 0, 100, 0.01, 7),
              newSeed: {
                actions: [{ icon: "shuffle", label: "New seed", value: bleedActionValues.newSeed, variant: "secondary" }],
                applicability: always,
                label: false,
                performanceReason: "Action only advances the seed uniform; re-runs the shade pass.",
                performanceRole: "responsiveness",
                target: "grain.actions",
                type: "actions",
              },
            },
            id: "grain",
            title: "Grain",
          },
          {
            controls: {
              amount: { ...slider("dissolve.amount", "Dissolve", 0, 1, 0.01, D.dissolve), label: false },
              angle: slider("dissolve.angle", "Angle", 0, 360, 1, D.dissolveAng, { unit: "°" }),
              softness: slider("dissolve.softness", "Falloff", 0.05, 1, 0.01, D.dissolveSoft),
            },
            id: "dissolve",
            title: "Dissolve",
          },
          {
            controls: {
              library: {
                applicability: always,
                defaultValue: createBleedDefaultPresetLibrary(),
                label: false,
                orderRole: "primary",
                performanceReason: "Loading a preset writes material targets once; list edits are inert until loaded.",
                performanceRole: "responsiveness",
                target: BLEED_PRESET_LIBRARY,
                type: bleedPresetListType,
              },
              actions: {
                actions: [
                  { icon: "upload-simple", label: "Save current", value: bleedActionValues.save, variant: "secondary" },
                  { icon: "rotate-ccw", label: "Restore factory", value: bleedActionValues.factory, variant: "ghost" },
                ],
                applicability: always,
                label: false,
                performanceReason: "Preset actions write material targets only; re-runs the shade pass.",
                performanceRole: "responsiveness",
                target: "presets.actions",
                type: "actions",
              },
            },
            id: "presets",
            title: "Presets",
          },
          {
            controls: {
              includeBackground: {
                applicability: always,
                defaultValue: true,
                label: "Include",
                performanceReason: "Runtime composites the background; BLEED always renders a transparent foreground.",
                performanceRole: "responsiveness",
                target: "export.includeBackground",
                type: "switch",
              },
              background: {
                applicability: always,
                defaultValue: "#000000",
                label: false,
                performanceReason: "Runtime-owned background fill behind the transparent BLEED foreground.",
                performanceRole: "responsiveness",
                target: "appearance.background",
                type: "color",
              },
            },
            id: "background",
            layoutGroups: [{ columns: 2, controls: ["includeBackground", "background"], layout: "inline" }],
            title: "Background",
          },
        ],
        title: BLEED_DISPLAY_TITLE,
      },
    },
    toolbar: { history: true, radar: true, theme: true, zoom: true },
  },
  modules: [mediaSourceModule(), imageExportModule()],
});
