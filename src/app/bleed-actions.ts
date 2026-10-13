import type { ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react/controls-panel/actions/controls-panel-actions";

import {
  readBleedPresetLibrary,
  restoreBleedFactoryPresets,
  saveBleedPreset,
} from "./bleed-preset-library";

export const BLEED_PRESET_LIBRARY = "presets.library";
export const BLEED_SEED = "grain.seed";

export const bleedActionValues = {
  factory: "preset-factory",
  newSeed: "seed-new",
  save: "preset-save",
} as const;

/** BLEED reference: new seed = +(Math.random()*100).toFixed(2). */
export function createBleedSeed(random: () => number = Math.random): number {
  return Number((random() * 100).toFixed(2));
}

export const handleBleedPanelAction: ToolcraftPanelActionHandler = ({ action, dispatch, state }) => {
  const values = state.values;
  const library = readBleedPresetLibrary(values[BLEED_PRESET_LIBRARY]);

  switch (action.value) {
    case bleedActionValues.newSeed: {
      dispatch({ label: "New seed", target: BLEED_SEED, type: "controls.setValue", value: createBleedSeed() });
      return;
    }
    case bleedActionValues.save: {
      dispatch({ label: "Save preset", target: BLEED_PRESET_LIBRARY, type: "controls.setValue", value: saveBleedPreset(library, values) });
      return;
    }
    case bleedActionValues.factory: {
      dispatch({ label: "Restore factory presets", target: BLEED_PRESET_LIBRARY, type: "controls.setValue", value: restoreBleedFactoryPresets(library) });
      return;
    }
    default:
      return;
  }
};
