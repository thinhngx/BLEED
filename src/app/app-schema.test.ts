import { describe, expect, it } from "vitest";

import { appAcceptance, validateProductAcceptanceCoverage } from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import {
  bleedDefaultMaterial,
  bleedFactoryPresets,
  bleedMaterialKeys,
  bleedPresetValues,
  createBleedFactoryPresetRecords,
  decodeBleedRecipe,
  encodeBleedRecipe,
  readBleedMaterial,
} from "./bleed-params";

describe("BLEED schema", () => {
  it("publishes the BLEED product sections on top of the runtime setup", () => {
    const ids = (appSchema.panels.controls?.sections ?? []).map((section) => section.id);
    for (const id of ["source", "inflate", "shading", "grain", "dissolve"]) {
      expect(ids).toContain(id);
    }
    expect(appSchema.panels.layers).toBeUndefined();
    expect(appSchema.panels.timeline).toBeUndefined();
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
  });

  it("uses only runtime media source and image export modules", () => {
    expect(appSchema.modulePlan.modules.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["media-source"]),
    );
    expect(appSchema.assembly.capabilities).not.toContain("timeline.playback");
  });

  it("declares measurable performance workload and scenarios", () => {
    expect(appPerformance.workloadEnvelope?.dimensions.map(({ id }) => id)).toEqual([
      "preview-pixels",
      "export-long-edge",
      "export-pixels",
    ]);
    expect(appPerformance.scenarios?.length).toBeGreaterThan(0);
  });

  it("declares production reload coverage for the BLEED schema", () => {
    expect(appSchema.persistence.storage).toBe("localStorage");
    expect(appAcceptance.find((entry) => entry.id === "persistence.reload")).toMatchObject({
      browser: { file: "e2e/app-persistence.spec.ts" },
      persistenceCoverage: "reload",
      target: "canvas.size.width",
    });
    expect(validateProductAcceptanceCoverage()).toEqual([]);
  });
});

describe("BLEED presets", () => {
  it("round-trips material-only recipes", () => {
    const recipe = encodeBleedRecipe(bleedDefaultMaterial);
    expect(decodeBleedRecipe(recipe)).toEqual(bleedDefaultMaterial);
  });

  it("drops non-material keys so presets never touch text, font or canvas", () => {
    const recipe = JSON.stringify({ font: "x", inflate: 0.2, size: 99, text: "nope", tracking: 1 });
    const decoded = decodeBleedRecipe(recipe);
    expect(Object.keys(decoded ?? {})).toEqual(["inflate"]);
    const values = bleedPresetValues(decoded ?? {});
    expect(Object.keys(values)).toEqual(["inflate.amount"]);
  });

  it("rejects malformed recipes", () => {
    expect(decodeBleedRecipe("{")).toBeNull();
    expect(decodeBleedRecipe("[]")).toBeNull();
    expect(decodeBleedRecipe(undefined)).toBeNull();
  });

  it("ships the factory presets with material keys only", () => {
    const records = createBleedFactoryPresetRecords();
    expect(records).toHaveLength(bleedFactoryPresets.length);
    expect(records.map((record) => record.name)).toEqual(["Blob", "Razor", "Pillow"]);
    for (const record of records) {
      const decoded = decodeBleedRecipe(record.recipe);
      expect(decoded).not.toBeNull();
      for (const key of Object.keys(decoded ?? {})) {
        expect(bleedMaterialKeys).toContain(key);
      }
    }
  });

  it("reads defaults back from an empty runtime value set", () => {
    expect(readBleedMaterial({})).toEqual(bleedDefaultMaterial);
  });
});
