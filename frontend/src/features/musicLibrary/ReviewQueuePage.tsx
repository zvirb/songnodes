import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '../../shell/PageParts';
import { StatusPill, SnIcon } from '../../lib/songnodes';
import {
  DataTable,
  type DataTableColumn,
  EditableCell,
  EmptyPanel,
  LoadingPanel,
  showToast,
  Button,
} from '../../components/ds';
import { API_BASE_URL } from '../../lib/apiBase';

export interface ReviewQueueItem {
  track_id: string;
  artist: string;
  title: string;
  mix_version?: string | null;
  bpm?: number | null;
  key?: string | null;
  energy_score?: number | null;
  genre?: string | null;
  genre_pillar?: string | null;
  rotation_status?: string | null;
  local_path?: string | null;
  reason: string;
  bpm_method?: string | null;
  source_method?: string | null;
  crate?: string | null;
}

const PILLAR_OPTIONS = [
  { value: 'House', label: 'House' },
  { value: 'Techno', label: 'Techno' },
  { value: 'UKG', label: 'UKG' },
  { value: 'Electro', label: 'Electro' },
  { value: 'Alternative', label: 'Alternative' },
  { value: 'Dance', label: 'Dance' },
];

const ROTATION_OPTIONS = [
  { value: 'High Rotation', label: 'High Rotation' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Cold Crash', label: 'Cold Crash' },
];

export const ReviewQueuePage: React.FC = () => {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'missing_bpm' | 'energy_estimate' | 'needs_review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPillar, setBulkPillar] = useState('House');
  const [bulkRotation, setBulkRotation] = useState('Standard');

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/library/review-queue?limit=500`);
      if (!res.ok) {
        throw new Error(`Failed to load review queue: ${res.statusText}`);
      }
      const data: ReviewQueueItem[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const handleSaveOverride = useCallback(
    async (
      track: ReviewQueueItem,
      patch: { energy_score?: number; genre_pillar?: string; rotation_status?: string; local_path?: string }
    ) => {
      const payload = {
        track_id: track.track_id,
        artist: track.artist,
        title: track.title,
        energy_score: patch.energy_score !== undefined ? patch.energy_score : track.energy_score,
        genre_pillar: patch.genre_pillar !== undefined ? patch.genre_pillar : track.genre_pillar,
        rotation_status: patch.rotation_status !== undefined ? patch.rotation_status : track.rotation_status,
        local_path: patch.local_path !== undefined ? patch.local_path : track.local_path,
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/library/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Failed to save override' }));
        throw new Error(errData.detail || 'Failed to save override');
      }

      // Update local item
      setItems((prev) =>
        prev
          .map((it) => (it.track_id === track.track_id ? { ...it, ...patch } : it))
          // If energy was set, the track is resolved and leaves the review queue
          .filter((it) => patch.energy_score === undefined || it.track_id !== track.track_id)
      );

      showToast(`Override saved for ${track.artist} – ${track.title}`);
    },
    []
  );

  const handleBulkSetPillar = async () => {
    if (selectedIds.size === 0) return;
    const targetTracks = items.filter((it) => selectedIds.has(it.track_id));
    for (const track of targetTracks) {
      try {
        await handleSaveOverride(track, { genre_pillar: bulkPillar });
      } catch (err) {
        console.error('Bulk save failed for', track.track_id, err);
      }
    }
    showToast(`Set pillar to ${bulkPillar} for ${selectedIds.size} tracks`);
    setSelectedIds(new Set());
  };

  const handleBulkSetRotation = async () => {
    if (selectedIds.size === 0) return;
    const targetTracks = items.filter((it) => selectedIds.has(it.track_id));
    for (const track of targetTracks) {
      try {
        await handleSaveOverride(track, { rotation_status: bulkRotation });
      } catch (err) {
        console.error('Bulk save failed for', track.track_id, err);
      }
    }
    showToast(`Set rotation to ${bulkRotation} for ${selectedIds.size} tracks`);
    setSelectedIds(new Set());
  };

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeFilter !== 'all') {
      result = result.filter((it) => it.reason === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (it) => it.artist.toLowerCase().includes(q) || it.title.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      missing_bpm: items.filter((it) => it.reason === 'missing_bpm').length,
      energy_estimate: items.filter((it) => it.reason === 'energy_estimate').length,
      needs_review: items.filter((it) => it.reason === 'needs_review').length,
    };
  }, [items]);

  const columns: DataTableColumn<ReviewQueueItem>[] = useMemo(
    () => [
      {
        id: 'track',
        header: 'Track',
        width: '28%',
        cell: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontWeight: 600 }}>{row.artist}</span>
            <span style={{ color: 'var(--fg-2)', fontSize: '0.8125rem' }}>
              {row.title} {row.mix_version ? <span className="sn-muted">({row.mix_version})</span> : null}
            </span>
            {row.crate ? (
              <span className="sn-muted" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-data)' }}>
                {row.crate}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'reason',
        header: 'Issue',
        width: '14%',
        cell: (row) => {
          if (row.reason === 'missing_bpm') {
            return <StatusPill raw="warn" label="Missing BPM" />;
          }
          if (row.reason === 'energy_estimate') {
            return <StatusPill raw="info" label="Energy estimate" />;
          }
          return <StatusPill raw="idle" label="Needs check" />;
        },
      },
      {
        id: 'energy',
        header: 'Energy',
        width: '12%',
        cell: (row) => (
          <EditableCell<number>
            type="number"
            min={1}
            max={10}
            step={1}
            value={row.energy_score != null ? Math.round(row.energy_score) : 6}
            ariaLabel={`Energy for ${row.artist} – ${row.title}`}
            onSave={(val) => handleSaveOverride(row, { energy_score: val })}
          />
        ),
      },
      {
        id: 'pillar',
        header: 'Pillar',
        width: '14%',
        cell: (row) => (
          <EditableCell<string>
            type="select"
            value={row.genre_pillar || 'House'}
            options={PILLAR_OPTIONS}
            ariaLabel={`Genre pillar for ${row.artist} – ${row.title}`}
            onSave={(val) => handleSaveOverride(row, { genre_pillar: val })}
          />
        ),
      },
      {
        id: 'rotation',
        header: 'Rotation',
        width: '14%',
        cell: (row) => (
          <EditableCell<string>
            type="select"
            value={row.rotation_status || 'Standard'}
            options={ROTATION_OPTIONS}
            ariaLabel={`Rotation for ${row.artist} – ${row.title}`}
            onSave={(val) => handleSaveOverride(row, { rotation_status: val })}
          />
        ),
      },
      {
        id: 'local_path',
        header: 'Local path',
        width: '18%',
        cell: (row) => (
          <EditableCell<string>
            type="text"
            value={row.local_path || ''}
            ariaLabel={`Local file path for ${row.artist} – ${row.title}`}
            onSave={(val) => handleSaveOverride(row, { local_path: val })}
          />
        ),
      },
    ],
    [handleSaveOverride]
  );

  return (
    <main className="sn-page__main sn-m-library" id="main" tabIndex={-1}>
      <PageHeader
        lead="Library"
        title="Review queue"
        desc="Curate tracks needing metadata verification, energy score estimates, and rotation confirmation before weekly run."
        actions={
          <Button kind="secondary" size="sm" onClick={() => void fetchQueue()}>
            Refresh queue
          </Button>
        }
      />

      {/* Toolbar: filter chips and search */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-6)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="sn-chip sn-filter-chip"
            aria-pressed={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          >
            All <span className="sn-filter-chip__count">{counts.all}</span>
          </button>
          <button
            type="button"
            className="sn-chip sn-filter-chip"
            aria-pressed={activeFilter === 'missing_bpm'}
            onClick={() => setActiveFilter('missing_bpm')}
          >
            Missing BPM <span className="sn-filter-chip__count">{counts.missing_bpm}</span>
          </button>
          <button
            type="button"
            className="sn-chip sn-filter-chip"
            aria-pressed={activeFilter === 'energy_estimate'}
            onClick={() => setActiveFilter('energy_estimate')}
          >
            Energy estimate <span className="sn-filter-chip__count">{counts.energy_estimate}</span>
          </button>
          <button
            type="button"
            className="sn-chip sn-filter-chip"
            aria-pressed={activeFilter === 'needs_review'}
            onClick={() => setActiveFilter('needs_review')}
          >
            Needs check <span className="sn-filter-chip__count">{counts.needs_review}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            type="search"
            className="sn-input"
            placeholder="Filter by artist or title…"
            value={searchQuery}
            aria-label="Filter review queue tracks"
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ height: 32, fontSize: '0.8125rem', width: 240 }}
          />
          {searchQuery ? (
            <button
              type="button"
              className="sn-btn sn-btn--quiet sn-btn--sm"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Table or Loading/Empty state */}
      {loading ? (
        <LoadingPanel message="Loading review queue tracks…" rows={5} />
      ) : error ? (
        <EmptyPanel icon={SnIcon as any} title="Failed to load review queue" actions={<Button onClick={() => void fetchQueue()}>Try again</Button>}>
          {error}
        </EmptyPanel>
      ) : items.length === 0 ? (
        <EmptyPanel icon={SnIcon as any} title="Review queue is clear">
          All tracks have verified metadata. The weekly run has no pending checks.
        </EmptyPanel>
      ) : filteredItems.length === 0 ? (
        <EmptyPanel
          icon={SnIcon as any}
          title="No tracks match filter"
          actions={<Button onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}>Clear filters</Button>}
        >
          No queued tracks match the current filter and search query.
        </EmptyPanel>
      ) : (
        <DataTable<ReviewQueueItem>
          caption="Library review queue"
          rows={filteredItems}
          columns={columns}
          rowId={(r) => r.track_id}
          keyboard
          density="comfortable"
          selected={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={(ids) => (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className="sn-muted" style={{ fontSize: '0.8125rem' }}>
                {ids.size} selected
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <select
                  className="sn-select"
                  value={bulkPillar}
                  aria-label="Bulk genre pillar"
                  onChange={(e) => setBulkPillar(e.target.value)}
                  style={{ height: 28, fontSize: '0.8125rem' }}
                >
                  {PILLAR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="sn-btn sn-btn--sm"
                  onClick={() => void handleBulkSetPillar()}
                >
                  Set pillar
                </button>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <select
                  className="sn-select"
                  value={bulkRotation}
                  aria-label="Bulk rotation"
                  onChange={(e) => setBulkRotation(e.target.value)}
                  style={{ height: 28, fontSize: '0.8125rem' }}
                >
                  {ROTATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="sn-btn sn-btn--sm"
                  onClick={() => void handleBulkSetRotation()}
                >
                  Set rotation
                </button>
              </div>
            </div>
          )}
        />
      )}
    </main>
  );
};

export default ReviewQueuePage;
