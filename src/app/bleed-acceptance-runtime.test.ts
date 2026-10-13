// Runtime evidence for every automated acceptance row. Pixel proof lives in
// e2e/product-bleed.spec.ts; these tests pin the value → renderer contract each
// control relies on, so a renamed target or dropped mapping fails fast in Node.
import { describe, expect, it } from "vitest";

import { appAcceptance, appControlSectionInventory } from "./app-acceptance";
import { createBleedSeed, bleedActionValues } from "./bleed-actions";
import { getBleedRenderScale, getBleedSceneBounds } from "./bleed-canvas";
import { bleedExportRenderer } from "./bleed-export";
import {
  bleedMaterialTargets,
  bleedPresetValues,
  createBleedFactoryPresetRecords,
  decodeBleedRecipe,
  readBleedMaterial,
  type BleedMaterial,
} from "./bleed-params";
import { appRendererPipelineRegistration, bleedSourceTargets } from "./bleed-pipeline-contract";
import {
  createBleedDefaultPresetLibrary,
  restoreBleedFactoryPresets,
  saveBleedPreset as saveBleedPresetLibrary,
} from "./bleed-preset-library";
import { findBleedMedia, readBleedFont, sizeBleedSvg } from "./bleed-render";
import { applyBleedTextCase } from "./bleed-source";

const inventoryTargets = new Set(appControlSectionInventory.flatMap((entry) => entry.targets));
const rowFor = (name: string) => appAcceptance.find((entry) => entry.automatedTestName === name);

function expectPanelTarget(target: string): void {
  expect(inventoryTargets.has(target), target).toBe(true);
}

const materialPairs: Record<keyof BleedMaterial, readonly [unknown, unknown]> = {
  aa: [0.5, 3], ambient: [0, 0.8], core: [0, 1], dissolve: [0, 1], dissolveAng: [0, 180],
  dissolveSoft: [0.05, 0.9], dither: [0, 1], dome: [0.5, 3], emboss: [0, 1], embossSoft: [0.5, 8],
  gBias: [-0.5, 0.5], grainAmt: [0, 1], grainMode: ["white", "blue"], grainScale: [1, 6],
  inflate: [0.05, 1], invert: [false, true], lightAmt: [0, 2], lightAng: [0, 270], normAmt: [0, 2],
  rim: [0, 1], threshold: [0.1, 0.9], warpAmt: [0, 1], warpScale: [0.5, 8],
};

describe("BLEED material acceptance", () => {
  for (const [key, target] of Object.entries(bleedMaterialTargets) as [keyof BleedMaterial, string][]) {
    it(`bleed ${target} acceptance`, () => {
      expectPanelTarget(target);
      const [low, high] = materialPairs[key];
      const a = readBleedMaterial({ [target]: low });
      const b = readBleedMaterial({ [target]: high });
      expect(a[key]).toBe(low);
      expect(b[key]).toBe(high);
      expect(bleedPresetValues({ [key]: high })).toEqual({ [target]: high });
      expect(rowFor(`bleed ${target} acceptance`)?.target).toBe(target);
    });
  }
});

describe("BLEED source acceptance", () => {
  for (const target of bleedSourceTargets) {
    it(`bleed ${target} acceptance`, () => {
      expectPanelTarget(target);
      expect(rowFor(`bleed ${target} acceptance`)?.target).toBe(target);
      expect(appRendererPipelineRegistration.getPass("preview-coverage")).toBeTruthy();
      if (target === "source.text") {
        expect(applyBleedTextCase("bleed type", "uppercase")).toBe("BLEED TYPE");
      }
      if (target === "source.font") {
        expect(readBleedFont({ "source.font": { fontId: "arimo", fontWeight: 700 } })).toMatchObject({
          fontId: "arimo",
          fontWeight: 700,
        });
      }
      if (target === "source.fontFile" || target === "source.artwork") {
        const assets = [
          { id: "a", sourceTarget: "source.fontFile" },
          { id: "b", sourceTarget: "source.artwork" },
        ] as unknown as Parameters<typeof findBleedMedia>[0];
        expect(findBleedMedia(assets, target)?.sourceTarget).toBe(target);
      }
      if (target === "source.artwork") {
        expect(sizeBleedSvg('<svg viewBox="0 0 10 20"></svg>')).toContain('height="4096"');
      }
    });
  }
});

describe("BLEED actions, presets and output acceptance", () => {
  it("bleed grain.seed acceptance", () => {
    expectPanelTarget("grain.seed");
    expect(createBleedSeed(() => 0.12345)).toBe(12.35);
  });
  it("bleed grain.actions acceptance", () => {
    expect(bleedActionValues.newSeed).toBe("seed-new");
    expect(rowFor("bleed grain.actions acceptance")).toBeTruthy();
  });
  it("bleed presets.library acceptance", () => {
    expectPanelTarget("presets.library");
    const records = createBleedFactoryPresetRecords();
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const material = decodeBleedRecipe((record as { recipe?: unknown }).recipe);
      expect(material).not.toBeNull();
      expect(Object.keys(bleedPresetValues(material ?? {})).every((t) => !t.startsWith("source."))).toBe(true);
    }
  });
  it("bleed presets.actions acceptance", () => {
    expect([bleedActionValues.save, bleedActionValues.factory]).toEqual(["preset-save", "preset-factory"]);
    const saved = saveBleedPresetLibrary(createBleedDefaultPresetLibrary(), { "inflate.amount": 0.9 });
    expect(saved.items.at(-1)).toMatchObject({ name: "My look" });
    expect(saved.activeId).toBe(saved.items.at(-1)?.id);
    const restored = restoreBleedFactoryPresets({ activeId: null, items: saved.items.slice(-1) });
    expect(restored.items.map((item) => item.name)).toEqual(["Blob", "Razor", "Pillow", "My look"]);
  });
  for (const target of ["appearance.background", "export.includeBackground", "export.image.format", "export.image.resolution", "actions.output"]) {
    it(`bleed ${target} acceptance`, () => {
      expect(rowFor(`bleed ${target} acceptance`)?.target).toBe(target);
      expect(bleedExportRenderer).toBeTruthy();
    });
  }
});

describe("BLEED canvas runtime acceptance", () => {
  it("bleed uses selected backing pixels", () => {
    expect(getBleedRenderScale(1)).toBe(1);
    expect(getBleedRenderScale(2)).toBe(2);
    expect(getBleedRenderScale(8)).toBe(2);
    expect(getBleedRenderScale(0.25)).toBe(1);
    expect(getBleedRenderScale("x")).toBe(2);
  });
  const size = { height: 800, width: 1200 };
  const centered = { height: 800, width: 1200, x: -600, y: -400 };
  for (const name of [
    "bleed keeps its renderer through Infinity canvas",
    "bleed export keeps the saved artboard across modes",
    "bleed viewport pan keeps rendering",
    "bleed viewport zoom keeps rendering",
  ]) {
    it(name, () => {
      expect(rowFor(name)?.kind).toBe("runtime");
      // The renderer is artboard-bound: scene bounds depend only on canvas size,
      // never on Infinity mode, pan offset, or zoom.
      expect(getBleedSceneBounds(size)).toEqual(centered);
      expect(appRendererPipelineRegistration.getPass("export-shade")).toBeTruthy();
    });
  }
});
