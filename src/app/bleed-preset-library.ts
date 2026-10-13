// Pure preset-library model for the BLEED preset list (reference: drawPresets).
// The runtime value at `presets.library` is `{ activeId, items }`; every edit
// returns a new library so the custom control and panel actions share one owner.
import { defineToolcraftCustomControlType } from "@/toolcraft/runtime";

import {
  bleedPresetValues,
  createBleedFactoryPresetRecords,
  decodeBleedRecipe,
  encodeBleedRecipe,
  readBleedMaterial,
  type BleedPresetRecord,
} from "./bleed-params";

/** Custom panel control: the BLEED preset list (no built-in owns load/overwrite/rename per row). */
export const bleedPresetListType = defineToolcraftCustomControlType("bleedPresetList");

export type BleedPresetLibrary = Readonly<{
  activeId: string | null;
  items: readonly BleedPresetRecord[];
}>;

export function createBleedDefaultPresetLibrary(): BleedPresetLibrary {
  return { activeId: null, items: createBleedFactoryPresetRecords() };
}

function isRecord(item: unknown): item is BleedPresetRecord {
  if (!item || typeof item !== "object") return false;
  const record = item as Partial<BleedPresetRecord>;
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.recipe === "string";
}

/** Reads a persisted library; tolerates the earlier bare-array value model. */
export function readBleedPresetLibrary(value: unknown): BleedPresetLibrary {
  const source = Array.isArray(value)
    ? { activeId: null, items: value }
    : value && typeof value === "object"
      ? (value as { activeId?: unknown; items?: unknown })
      : null;
  if (!source || !Array.isArray(source.items)) return createBleedDefaultPresetLibrary();
  const items = source.items.filter(isRecord);
  const activeId =
    typeof source.activeId === "string" && items.some((item) => item.id === source.activeId)
      ? source.activeId
      : null;
  return { activeId, items };
}

/** Reference uniqueName: "Name", "Name 2", "Name 3"… skipping the edited row. */
export function uniqueBleedPresetName(
  library: BleedPresetLibrary,
  name: string,
  exceptId: string | null = null,
): string {
  const taken = new Set(library.items.filter((item) => item.id !== exceptId).map((item) => item.name));
  if (!taken.has(name)) return name;
  let index = 2;
  while (taken.has(`${name} ${index}`)) index += 1;
  return `${name} ${index}`;
}

function createPresetId(library: BleedPresetLibrary): string {
  let index = library.items.length + 1;
  while (library.items.some((item) => item.id === `user-${index}`)) index += 1;
  return `user-${index}`;
}

/** Runtime values applying one preset: material targets plus the new active row. */
export function applyBleedPreset(
  library: BleedPresetLibrary,
  id: string,
  target: string,
): Record<string, unknown> | null {
  const record = library.items.find((item) => item.id === id);
  const material = record ? decodeBleedRecipe(record.recipe) : null;
  if (!material) return null;
  return { ...bleedPresetValues(material), [target]: { ...library, activeId: id } };
}

export function saveBleedPreset(
  library: BleedPresetLibrary,
  values: Readonly<Record<string, unknown>>,
  name = "My look",
): BleedPresetLibrary {
  const id = createPresetId(library);
  const record = { id, name: uniqueBleedPresetName(library, name), recipe: encodeBleedRecipe(readBleedMaterial(values)) };
  return { activeId: id, items: [...library.items, record] };
}

export function overwriteBleedPreset(
  library: BleedPresetLibrary,
  id: string,
  values: Readonly<Record<string, unknown>>,
): BleedPresetLibrary {
  const recipe = encodeBleedRecipe(readBleedMaterial(values));
  return { activeId: id, items: library.items.map((item) => (item.id === id ? { ...item, recipe } : item)) };
}

export function renameBleedPreset(library: BleedPresetLibrary, id: string, name: string): BleedPresetLibrary {
  const trimmed = name.trim();
  if (!trimmed) return library;
  const next = uniqueBleedPresetName(library, trimmed, id);
  return { ...library, items: library.items.map((item) => (item.id === id ? { ...item, name: next } : item)) };
}

export function deleteBleedPreset(library: BleedPresetLibrary, id: string): BleedPresetLibrary {
  return {
    activeId: library.activeId === id ? null : library.activeId,
    items: library.items.filter((item) => item.id !== id),
  };
}

/** Reference "Restore factory": reset factory recipes, re-add deleted ones, keep user presets after them. */
export function restoreBleedFactoryPresets(library: BleedPresetLibrary): BleedPresetLibrary {
  const factory = createBleedFactoryPresetRecords();
  const factoryIds = new Set(factory.map((preset) => preset.id));
  return { ...library, items: [...factory, ...library.items.filter((item) => !factoryIds.has(item.id))] };
}

/** True when the current material no longer matches the active preset (reference "•"). */
export function isBleedPresetDrifted(
  library: BleedPresetLibrary,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const record = library.items.find((item) => item.id === library.activeId);
  const material = record ? decodeBleedRecipe(record.recipe) : null;
  if (!material) return false;
  const current = readBleedMaterial(values);
  return Object.entries(material).some(([key, value]) => current[key as keyof typeof current] !== value);
}
