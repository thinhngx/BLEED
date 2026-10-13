import type { ToolcraftControlSectionInventoryEntry } from "./acceptance/types";

export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = [
  {
    entity: "Source",
    entityId: "bleed-source",
    finiteSelectors: [
      {
        affectedTargets: [],
        reason: "Source mode chooses whether letters or dropped artwork feed the coverage map.",
        role: "branch",
        target: "source.mode",
      },
      {
        reason: "Artwork channel chooses which image channel becomes coverage.",
        role: "parameter",
        target: "source.artChannel",
      },
      {
        reason: "Rotation changes the rasterized coverage orientation.",
        role: "parameter",
        target: "source.rotate",
      },
    ],
    groupingReason: "Mode, text, font, artwork and placement jointly define the coverage map that BLEED inflates.",
    id: "source",
    targets: ["source.mode", "source.text", "source.font", "source.fontFile", "source.artwork", "source.artChannel", "source.artFit", "source.rotate", "source.shiftX", "source.shiftY"],
    title: "Source",
  },
  {
    entity: "Inflate",
    entityId: "bleed-inflate",
    finiteSelectors: [

    ],
    groupingReason: "Blur radius, threshold, dome and emboss jointly shape the inflated blob.",
    id: "inflate",
    targets: ["inflate.amount", "inflate.threshold", "inflate.core", "inflate.dome", "inflate.edge", "inflate.emboss", "inflate.embossSoftness"],
    title: "Inflate",
  },
  {
    entity: "Shading",
    entityId: "bleed-shading",
    finiteSelectors: [
      {
        reason: "Invert swaps the light and dark material response.",
        role: "parameter",
        target: "shading.invert",
      },
    ],
    groupingReason: "Light, normal, rim and warp jointly define the lit surface of the blob.",
    id: "shading",
    targets: ["shading.lightAngle", "shading.light", "shading.ambient", "shading.normal", "shading.rim", "shading.warp", "shading.warpScale", "shading.invert"],
    title: "Shading",
  },
  {
    entity: "Grain",
    entityId: "bleed-grain",
    finiteSelectors: [
      {
        reason: "Grain mode changes the grain pattern family.",
        role: "parameter",
        target: "grain.mode",
      },
    ],
    groupingReason: "Grain mode, amount, scale, bias, dither and seed jointly define the grain field.",
    id: "grain",
    targets: ["grain.mode", "grain.amount", "grain.scale", "grain.bias", "grain.dither", "grain.seed", "grain.actions"],
    title: "Grain",
  },
  {
    entity: "Dissolve",
    entityId: "bleed-dissolve",
    finiteSelectors: [],
    groupingReason: "Amount, angle and softness jointly define the directional dissolve.",
    id: "dissolve",
    targets: ["dissolve.amount", "dissolve.angle", "dissolve.softness"],
    title: "Dissolve",
  },
  {
    entity: "Presets",
    entityId: "bleed-presets",
    finiteSelectors: [],
    groupingReason: "The preset list loads, overwrites, renames and deletes material-only recipes; actions save the current look and restore factory recipes.",
    id: "presets",
    targets: ["presets.library", "presets.actions"],
    title: "Presets",
  },
  {
    entity: "Output background",
    entityId: "output-background",
    finiteSelectors: [
      {
        affectedTargets: ["appearance.background"],
        reason: "Background inclusion determines whether its color affects output.",
        role: "branch",
        target: "export.includeBackground",
      },
    ],
    groupingReason: "Inclusion and color jointly define the preview and exported background.",
    id: "background",
    targets: ["export.includeBackground", "appearance.background"],
    title: "Background",
  },
  {
    entity: "Image delivery",
    entityId: "image-delivery",
    finiteSelectors: [
      {
        reason: "Image format changes its own exported artifact encoding.",
        role: "parameter",
        target: "export.image.format",
      },
      {
        reason: "Image resolution changes its own exported artifact dimensions.",
        role: "parameter",
        target: "export.image.resolution",
      },
    ],
    groupingReason: "Format and resolution jointly configure the exported image.",
    id: "runtime.image-export",
    targets: ["export.image.format", "export.image.resolution"],
    title: "Image Export",
  },
];
