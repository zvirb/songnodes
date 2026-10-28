import React, { useState, useEffect } from 'react';
import { SnIcon } from '../../../lib/songnodes';
import { getFavorites, saveFavorite, removeFavorite, type FavoriteItem } from '../../../utils/favoriteQueries';
import { Dialog, TextField, showToast } from '../../../components/ds';
import { DEFAULT_FILTERS, type CrateFilters } from '../setBuilder';

interface FilterPresetsProps {
  currentFilters: CrateFilters;
  onApply: (f: CrateFilters) => void;
}

const PRESETS_NS = 'library-crate-presets';

export const FilterPresets: React.FC<FilterPresetsProps> = ({ currentFilters, onApply }) => {
  const [presets, setPresets] = useState<FavoriteItem<CrateFilters>[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const loadPresets = () => {
    setPresets(getFavorites<CrateFilters>(PRESETS_NS));
  };

  useEffect(() => {
    loadPresets();

    const onStorage = (e: StorageEvent) => {
      if (e.key === `sn-favs-${PRESETS_NS}`) loadPresets();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isMatch = (a: CrateFilters, b: CrateFilters) => {
    if (a.q !== b.q || a.src !== b.src || a.key !== b.key || a.rev !== b.rev || a.multi !== b.multi) return false;
    const arrayMatch = (arr1: any[], arr2: any[]) => arr1.length === arr2.length && arr1.every((v) => arr2.includes(v));
    if (!arrayMatch(a.pillar, b.pillar)) return false;
    if (!arrayMatch(a.tier, b.tier)) return false;
    if (!arrayMatch(a.rot, b.rot)) return false;
    if (!arrayMatch(a.tags, b.tags)) return false;
    return true;
  };

  const isDefault = isMatch(currentFilters, DEFAULT_FILTERS);

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
    showToast(`Preset deleted`, {
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

      {presets.length > 0 && (
        <ul className="sn-filter-chip-group__list">
          {presets.map((p) => {
            const active = isMatch(p.payload, currentFilters);
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
        <TextField
          label="Preset name"
          value={newName}
          onChange={setNewName}
          maxLength={40}
          autoFocus
        />
      </Dialog>
    </div>
  );
};
