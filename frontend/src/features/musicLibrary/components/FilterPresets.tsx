import React, { useState, useEffect, useRef } from 'react';
import { SnIcon } from '../../../lib/songnodes';
import { getFavorites, saveFavorite, removeFavorite, type FavoriteItem } from '../../../utils/favoriteQueries';
import { Dialog, TextField, showToast } from '../../../components/ds';
import { DEFAULT_FILTERS, type CrateFilters } from '../setBuilder';

interface FilterPresetsProps {
  currentFilters: CrateFilters;
  onApply: (f: CrateFilters) => void;
}

const PRESETS_NS = 'library-crate-presets';

const sameSet = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v) => b.includes(v));

/** True when two filter states select the same tracks (array order does not matter). */
function sameFilters(a: CrateFilters, b: CrateFilters): boolean {
  return a.q === b.q && a.src === b.src && a.key === b.key && a.rev === b.rev && a.multi === b.multi
    && sameSet(a.pillar, b.pillar) && sameSet(a.tier, b.tier) && sameSet(a.rot, b.rot) && sameSet(a.tags, b.tags);
}

export const FilterPresets: React.FC<FilterPresetsProps> = ({ currentFilters, onApply }) => {
  const [presets, setPresets] = useState<FavoriteItem<CrateFilters>[]>(() => getFavorites<CrateFilters>(PRESETS_NS));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const nameFormRef = useRef<HTMLFormElement>(null);

  // The dialog focuses its close button; move focus to the name field once it opens.
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const t = window.setTimeout(() => nameFormRef.current?.querySelector('input')?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [dialogOpen]);

  const loadPresets = () => setPresets(getFavorites<CrateFilters>(PRESETS_NS));

  // Presets saved in another tab show up here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `sn-favs-${PRESETS_NS}`) setPresets(getFavorites<CrateFilters>(PRESETS_NS));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isDefault = sameFilters(currentFilters, DEFAULT_FILTERS);

  const handleSave = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    saveFavorite(PRESETS_NS, { label: trimmed, payload: currentFilters });
    loadPresets();
    setDialogOpen(false);
    setNewName('');
  };

  const handleDelete = (preset: FavoriteItem<CrateFilters>) => {
    removeFavorite(PRESETS_NS, preset.id);
    loadPresets();
    showToast(`Preset deleted: ${preset.label}`, {
      label: 'Undo',
      onClick: () => {
        saveFavorite(PRESETS_NS, { label: preset.label, payload: preset.payload });
        loadPresets();
      },
    });
  };

  return (
    <div className="sn-filter-rail__section sn-filter-chip-group" role="group" aria-labelledby="f-presets">
      <div className="sn-filter-chip-group__head">
        <span className="sn-filter-chip-group__legend" id="f-presets">Presets</span>
      </div>

      {presets.length > 0 && (
        <ul className="sn-filter-chip-group__list">
          {presets.map((p) => {
            const active = sameFilters(p.payload, currentFilters);
            return (
              <li key={p.id} className="sn-filter-chip-preset">
                <button
                  type="button"
                  className="sn-chip sn-filter-chip"
                  aria-pressed={active}
                  onClick={() => onApply(p.payload)}
                >
                  {p.label}
                </button>
                <button
                  type="button"
                  className="sn-filter-chip-preset__remove"
                  aria-label={`Delete preset ${p.label}`}
                  onClick={() => handleDelete(p)}
                >
                  <SnIcon name="x" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Below the list (FilterChip README, Preset): the rail is too narrow to share a row with the legend. */}
      <div>
        <button
          type="button"
          className="sn-btn sn-btn--quiet sn-btn--sm"
          disabled={isDefault}
          onClick={() => {
            setNewName('');
            setDialogOpen(true);
          }}
        >
          <SnIcon name="save" />
          <span>Save current filters</span>
        </button>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Save preset"
        footer={
          <>
            <button type="button" className="sn-btn sn-btn--quiet" onClick={() => setDialogOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={handleSave}
              disabled={!newName.trim()}
            >
              Save preset
            </button>
          </>
        }
      >
        <form ref={nameFormRef} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <TextField
          label="Preset name"
          value={newName}
          onChange={setNewName}
          maxLength={40}
        />
        </form>
      </Dialog>
    </div>
  );
};
