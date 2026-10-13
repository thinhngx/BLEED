import * as React from "react";
import { ArrowsClockwise, PencilSimple, X } from "@phosphor-icons/react";
import type { ToolcraftCustomControlRendererProps } from "@/toolcraft/runtime/react";
import { Button, Input, pressedSelectedItemClassName } from "@/toolcraft/ui";

import {
  applyBleedPreset,
  deleteBleedPreset,
  isBleedPresetDrifted,
  overwriteBleedPreset,
  readBleedPresetLibrary,
  renameBleedPreset,
  type BleedPresetLibrary,
} from "./bleed-preset-library";

const LIBRARY_TARGET = "presets.library";

/**
 * BLEED preset list (reference drawPresets): click a name to load it, the active
 * row is highlighted (• when edited since loading), and each row can be
 * overwritten with the current material, renamed inline, or deleted. Recipes stay
 * internal; nothing here exposes JSON.
 */
export function BleedPresetListControl({
  dispatch,
  setValue,
  state,
  value,
}: ToolcraftCustomControlRendererProps): React.JSX.Element {
  const library = readBleedPresetLibrary(value);
  const drifted = isBleedPresetDrifted(library, state.values);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const commit = (next: BleedPresetLibrary) => setValue(next);

  const apply = (id: string, name: string) => {
    const values = applyBleedPreset(library, id, LIBRARY_TARGET);
    if (values) dispatch({ label: `Load ${name}`, type: "controls.apply", values });
  };

  const finishRename = (id: string) => {
    if (editingId !== id) return;
    setEditingId(null);
    const current = library.items.find((item) => item.id === id);
    if (current && draft.trim() && draft.trim() !== current.name) {
      commit(renameBleedPreset(library, id, draft));
    }
  };

  if (library.items.length === 0) {
    return <p className="px-0.5 py-1 text-xs text-muted-foreground">No presets. Save the current look to add one.</p>;
  }

  return (
    <ul aria-label="Presets" className="flex flex-col gap-0.5" data-bleed-preset-list="">
      {library.items.map((item) => {
        const active = item.id === library.activeId;
        return (
          <li className="flex min-w-0 items-center gap-0.5" data-bleed-preset-row={item.id} key={item.id}>
            {editingId === item.id ? (
              <Input
                aria-label={`Rename ${item.name}`}
                autoFocus
                className="h-7 min-w-0 flex-1"
                onBlur={() => finishRename(item.id)}
                onChange={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") finishRename(item.id);
                  if (event.key === "Escape") setEditingId(null);
                }}
                value={draft}
              />
            ) : (
              <Button
                aria-pressed={active}
                className={`min-w-0 flex-1 justify-start ${pressedSelectedItemClassName}`}
                onClick={() => apply(item.id, item.name)}
                onDoubleClick={() => {
                  setDraft(item.name);
                  setEditingId(item.id);
                }}
                title={`Load ${item.name}`}
                type="button"
                variant="ghost"
              >
                <span className="truncate">{item.name}</span>
                {active && drifted ? (
                  <span aria-label="edited since loading" className="shrink-0 text-[color:var(--link)]" title="Edited since loading">
                    •
                  </span>
                ) : null}
              </Button>
            )}
            <Button
              aria-label={`Overwrite ${item.name} with current settings`}
              onClick={() => commit(overwriteBleedPreset(library, item.id, state.values))}
              size="icon"
              title="Overwrite with current settings"
              type="button"
              variant="ghost"
            >
              <ArrowsClockwise />
            </Button>
            <Button
              aria-label={`Rename ${item.name}`}
              onClick={() => {
                setDraft(item.name);
                setEditingId(item.id);
              }}
              size="icon"
              title="Rename"
              type="button"
              variant="ghost"
            >
              <PencilSimple />
            </Button>
            <Button
              aria-label={`Delete ${item.name}`}
              onClick={() => commit(deleteBleedPreset(library, item.id))}
              size="icon"
              title="Delete"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
