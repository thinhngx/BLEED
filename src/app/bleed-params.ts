// BLEED parameter model. Shader math, defaults, ranges, and factory presets are
// ported 1:1 from the reference (thinhngx/BLEED index.html, commit c9bac40).

export type BleedGrainMode = "white" | "value" | "bayer" | "blue";
export type BleedArtChannel = "alpha" | "luminance" | "inverted";
export type BleedSourceMode = "text" | "artwork";

/** Material (preset-scoped) parameters — BLEED EFFECT_KEYS. */
export type BleedMaterial = {
  inflate: number;
  threshold: number;
  core: number;
  dome: number;
  aa: number;
  emboss: number;
  embossSoft: number;
  lightAng: number;
  lightAmt: number;
  ambient: number;
  normAmt: number;
  rim: number;
  warpAmt: number;
  warpScale: number;
  grainMode: BleedGrainMode;
  grainAmt: number;
  grainScale: number;
  gBias: number;
  dither: number;
  dissolve: number;
  dissolveAng: number;
  dissolveSoft: number;
  invert: boolean;
};

/** Material key → runtime schema target. Presets touch exactly these targets. */
export const bleedMaterialTargets = {
  aa: "inflate.edge",
  ambient: "shading.ambient",
  core: "inflate.core",
  dissolve: "dissolve.amount",
  dissolveAng: "dissolve.angle",
  dissolveSoft: "dissolve.softness",
  dither: "grain.dither",
  dome: "inflate.dome",
  emboss: "inflate.emboss",
  embossSoft: "inflate.embossSoftness",
  gBias: "grain.bias",
  grainAmt: "grain.amount",
  grainMode: "grain.mode",
  grainScale: "grain.scale",
  inflate: "inflate.amount",
  invert: "shading.invert",
  lightAmt: "shading.light",
  lightAng: "shading.lightAngle",
  normAmt: "shading.normal",
  rim: "shading.rim",
  threshold: "inflate.threshold",
  warpAmt: "shading.warp",
  warpScale: "shading.warpScale",
} as const satisfies Record<keyof BleedMaterial, string>;

export const bleedMaterialKeys = Object.keys(
  bleedMaterialTargets,
) as (keyof BleedMaterial)[];

export const bleedDefaultMaterial: BleedMaterial = {
  aa: 0.05,
  ambient: 0.84,
  core: 0.45,
  dissolve: 0.15,
  dissolveAng: 200,
  dissolveSoft: 0.5,
  dither: 0.25,
  dome: 1,
  emboss: 0.5,
  embossSoft: 3,
  gBias: 0.45,
  grainAmt: 0.28,
  grainMode: "white",
  grainScale: 1,
  inflate: 0.07,
  invert: false,
  lightAmt: 0.3,
  lightAng: 125,
  normAmt: 6,
  rim: 0,
  threshold: 0.4,
  warpAmt: 0,
  warpScale: 2.4,
};

export const bleedGrainModeIndex: Record<BleedGrainMode, number> = {
  bayer: 2,
  blue: 3,
  value: 1,
  white: 0,
};

type BleedFactoryPreset = Readonly<{
  id: string;
  name: string;
  params: Partial<BleedMaterial>;
}>;

/** Factory presets: the user's saved Blob, Razor and Pillow looks (replace the reference four). */
export const bleedFactoryPresets: readonly BleedFactoryPreset[] = [
  {
    id: "factory-blob",
    name: "Blob",
    params: {
      aa: 0.026, ambient: 1, core: 0.9, dissolve: 1, dissolveAng: 53,
      dissolveSoft: 0.34, dither: 0.59, dome: 1.02, emboss: 0.84,
      embossSoft: 12, gBias: 1, grainAmt: 0.02, grainMode: "blue",
      grainScale: 0.3, inflate: 0.052, invert: false, lightAmt: 1,
      lightAng: 184, normAmt: 10, rim: 1, threshold: 0.31, warpAmt: 0.006,
      warpScale: 0.4,
    },
  },
  {
    id: "factory-razor",
    name: "Razor",
    params: {
      aa: 0, ambient: 0, core: 0.23, dissolve: 0, dissolveAng: 86,
      dissolveSoft: 0.34, dither: 0.17, dome: 0.15, emboss: 0.8,
      embossSoft: 0.5, gBias: 0.76, grainAmt: 1, grainMode: "blue",
      grainScale: 0.3, inflate: 0.045, invert: false, lightAmt: 0.95,
      lightAng: 237, normAmt: 28.5, rim: 0.56, threshold: 0.05, warpAmt: 0,
      warpScale: 2.8,
    },
  },
  {
    id: "factory-pillow",
    name: "Pillow",
    params: {
      aa: 0.102, ambient: 1, core: 0.215, dissolve: 0.2, dissolveAng: 107,
      dissolveSoft: 0.56, dither: 0.24, dome: 1.15, emboss: 0.78,
      embossSoft: 4.6, gBias: 0.67, grainAmt: 0.29, grainMode: "white",
      grainScale: 0.9, inflate: 0.081, invert: false, lightAmt: 0.13,
      lightAng: 142, normAmt: 17.9, rim: 0.61, threshold: 0.305, warpAmt: 0,
      warpScale: 4.4,
    },
  },
];

/**
 * Preset library record stored in `presets.library`. `recipe` is the BLEED
 * material JSON (the reference "copy/paste params" payload): material keys only.
 */
export type BleedPresetRecord = {
  id: string;
  name: string;
  recipe: string;
};

export function encodeBleedRecipe(material: Partial<BleedMaterial>): string {
  const ordered: Record<string, unknown> = {};
  for (const key of bleedMaterialKeys) {
    if (material[key] !== undefined) ordered[key] = material[key];
  }
  return JSON.stringify(ordered);
}

const grainModes = new Set<string>(["white", "value", "bayer", "blue"]);

/** Parse a recipe; unknown keys (text, font, size, canvas, seed…) are dropped. */
export function decodeBleedRecipe(recipe: unknown): Partial<BleedMaterial> | null {
  if (typeof recipe !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(recipe);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  const material: Partial<BleedMaterial> = {};
  for (const key of bleedMaterialKeys) {
    const value = source[key];
    if (key === "invert") {
      if (typeof value === "boolean" || value === 0 || value === 1) material.invert = Boolean(value);
    } else if (key === "grainMode") {
      if (typeof value === "string" && grainModes.has(value)) material.grainMode = value as BleedGrainMode;
      else if (typeof value === "number") {
        const mode = (Object.keys(bleedGrainModeIndex) as BleedGrainMode[]).find((m) => bleedGrainModeIndex[m] === value);
        if (mode) material.grainMode = mode;
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      (material as Record<string, unknown>)[key] = value;
    }
  }
  return material;
}

export function createBleedFactoryPresetRecords(): BleedPresetRecord[] {
  return bleedFactoryPresets.map(({ id, name, params }) => ({
    id,
    name,
    recipe: encodeBleedRecipe(params),
  }));
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Pick only material keys (BLEED pickEffect) from runtime values. */
export function readBleedMaterial(
  values: Readonly<Record<string, unknown>>,
): BleedMaterial {
  const material = { ...bleedDefaultMaterial };
  for (const key of bleedMaterialKeys) {
    const value = values[bleedMaterialTargets[key]];
    if (key === "invert") material.invert = value === true;
    else if (key === "grainMode") {
      if (typeof value === "string" && grainModes.has(value)) {
        material.grainMode = value as BleedGrainMode;
      }
    } else {
      (material as Record<string, unknown>)[key] = finite(
        value,
        bleedDefaultMaterial[key] as number,
      );
    }
  }
  return material;
}

/** Runtime values that apply a preset (material-only, never source/canvas). */
export function bleedPresetValues(
  material: Partial<BleedMaterial>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const key of bleedMaterialKeys) {
    if (material[key] !== undefined) values[bleedMaterialTargets[key]] = material[key];
  }
  return values;
}
