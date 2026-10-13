import { describe, expect, it } from "vitest";

import { decodeBleedRecipe } from "./bleed-params";
import {
  applyBleedPreset,
  createBleedDefaultPresetLibrary,
  deleteBleedPreset,
  isBleedPresetDrifted,
  overwriteBleedPreset,
  readBleedPresetLibrary,
  renameBleedPreset,
  uniqueBleedPresetName,
} from "./bleed-preset-library";

const library = createBleedDefaultPresetLibrary();
const first = library.items[0]!;

describe("BLEED preset library", () => {
  it("reads persisted objects, the earlier bare-array model, and junk", () => {
    expect(readBleedPresetLibrary({ activeId: first.id, items: library.items }).activeId).toBe(first.id);
    expect(readBleedPresetLibrary(library.items).items).toHaveLength(3);
    expect(readBleedPresetLibrary({ activeId: "gone", items: [] })).toEqual({ activeId: null, items: [] });
    expect(readBleedPresetLibrary(42).items).toHaveLength(3);
  });

  it("loads material targets plus the active row, never source or canvas", () => {
    const values = applyBleedPreset(library, first.id, "presets.library")!;
    expect(values["presets.library"]).toMatchObject({ activeId: first.id });
    expect(Object.keys(values).some((key) => key.startsWith("source.") || key.startsWith("canvas."))).toBe(false);
    expect(applyBleedPreset(library, "missing", "presets.library")).toBeNull();
  });

  it("overwrites, renames uniquely, and deletes", () => {
    const over = overwriteBleedPreset(library, first.id, { "inflate.amount": 0.77 });
    expect(decodeBleedRecipe(over.items[0]!.recipe)?.inflate).toBe(0.77);
    expect(renameBleedPreset(library, first.id, "Razor").items[0]!.name).toBe("Razor 2");
    expect(renameBleedPreset(library, first.id, "   ")).toBe(library);
    expect(uniqueBleedPresetName(library, first.name, first.id)).toBe(first.name);
    const removed = deleteBleedPreset({ ...library, activeId: first.id }, first.id);
    expect(removed.activeId).toBeNull();
    expect(removed.items).toHaveLength(2);
  });

  it("flags drift only after the material changes", () => {
    const values = applyBleedPreset(library, first.id, "presets.library")!;
    const active = { ...library, activeId: first.id };
    expect(isBleedPresetDrifted(active, values)).toBe(false);
    expect(isBleedPresetDrifted(active, { ...values, "inflate.amount": 0.123 })).toBe(true);
  });
});
