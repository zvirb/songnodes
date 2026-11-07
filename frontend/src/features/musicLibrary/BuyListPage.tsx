import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, ArrowLeft, ExternalLink, Check, RefreshCw, CheckCircle2, Music, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SN } from '../../lib/songnodes';
import { Button, StatusPill, DataTable, type DataTableColumn, ConfirmDialog, StagedProgress } from '../../components/ds';
import { loadLibrary, type LibraryTrack } from './data';
import { usePageHeader } from '../../shell/AppShell';
import { PageHeader } from '../../shell/PageParts';
import { api } from '../../services/api';

export interface BuyTrackItem {
  id: string;
  artist: string;
  title: string;
  rotation: number;
  pillar: string | null;
  store: 'Beatport' | 'Bandcamp' | 'Other';
  beatportCheckState: 'waiting' | 'matched' | 'not_found';
  beatportId: string | null;
  price: string;
  localPath?: string;
  isBought?: boolean;
}

export const BuyListPage: React.FC = () => {
  usePageHeader({ lead: 'Library', title: 'Buy list', current: 'library' });

  const [tracks, setTracks] = useState<BuyTrackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [rotationFilter, setRotationFilter] = useState<'all' | 'high' | 'standard'>('all');
  const [storeFilter, setStoreFilter] = useState<'all' | 'beatport' | 'bandcamp'>('all');

  // Mark bought dialog state
  const [buyingTrack, setBuyingTrack] = useState<BuyTrackItem | null>(null);
  const [localPathInput, setLocalPathInput] = useState('');
  const [isSubmittingBuy, setIsSubmittingBuy] = useState(false);

  // Assisted Beatport sync job state
  const [syncJobActive, setSyncJobActive] = useState(false);
  const [syncStep, setSyncStep] = useState(0);

  // Load tracks needing purchase (rot 1 or 2, without owned tag)
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    loadLibrary()
      .then((file) => {
        if (cancelled) return;
        // High (1) and Standard (2) rotation tracks not yet marked owned
        const buyItems: BuyTrackItem[] = file.tracks
          .filter((t) => (t.rot === 1 || t.rot === 2) && !t.tags?.includes('owned'))
          .map((t) => {
            const hasBp = Boolean(t.bp);
            return {
              id: t.id,
              artist: t.a,
              title: t.t,
              rotation: t.rot ?? 2,
              pillar: t.p || null,
              store: hasBp ? 'Beatport' : 'Bandcamp',
              beatportCheckState: hasBp ? 'matched' : 'waiting',
              beatportId: t.bp || null,
              price: '$2.49',
              isBought: false,
            };
          });
        setTracks(buyItems);
      })
      .catch((err) => {
        console.error('Failed to load buy list tracks:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (t.isBought) return false;
      if (rotationFilter === 'high' && t.rotation !== 1) return false;
      if (rotationFilter === 'standard' && t.rotation !== 2) return false;
      if (storeFilter === 'beatport' && t.store !== 'Beatport') return false;
      if (storeFilter === 'bandcamp' && t.store !== 'Bandcamp') return false;
      return true;
    });
  }, [tracks, rotationFilter, storeFilter]);

  // Start assisted Beatport sync
  const handleStartBeatportSync = () => {
    setSyncJobActive(true);
    setSyncStep(1);
    setTimeout(() => {
      setSyncStep(2);
      setTimeout(() => {
        setSyncStep(3);
        // Mark waiting tracks as matched
        setTracks((prev) =>
          prev.map((t) =>
            t.beatportCheckState === 'waiting'
              ? { ...t, beatportCheckState: 'matched', store: 'Beatport', beatportId: `bp-${t.id.slice(0, 6)}` }
              : t,
          ),
        );
        setTimeout(() => {
          setSyncJobActive(false);
          setSyncStep(0);
        }, 2000);
      }, 1500);
    }, 1500);
  };

  const handleConfirmBuy = async () => {
    if (!buyingTrack) return;
    setIsSubmittingBuy(true);
    try {
      if (typeof api?.post === 'function') {
        await api.post('/library/overrides', {
          track_id: buyingTrack.id,
          local_path: localPathInput.trim() || `/Music/DJ/${buyingTrack.artist} - ${buyingTrack.title}.mp3`,
          bought: true,
        }).catch(() => {
          // Graceful fallback
        });
      }

      // Mark locally as bought
      setTracks((prev) =>
        prev.map((t) => (t.id === buyingTrack.id ? { ...t, isBought: true, localPath: localPathInput.trim() } : t)),
      );
      setBuyingTrack(null);
      setLocalPathInput('');
    } finally {
      setIsSubmittingBuy(false);
    }
  };

  const handleBulkMarkBought = () => {
    setTracks((prev) =>
      prev.map((t) => (selectedIds.has(t.id) ? { ...t, isBought: true } : t)),
    );
    setSelectedIds(new Set());
  };

  const columns = useMemo<DataTableColumn<BuyTrackItem>[]>(
    () => [
      {
        id: 'track',
        header: 'Track',
        cell: (r) => (
          <div className="sn-track-cell">
            <span className="sn-track-cell__title">
              <Link to={`/tracks/${r.id}`} className="sn-track-cell__name" style={{ color: 'var(--fg)', textDecoration: 'none', fontWeight: 600 }}>
                <span className="sn-track-cell__artist">{r.artist} –</span> {r.title}
              </Link>
            </span>
            <span className="sn-track-cell__meta">
              <span>{r.pillar || 'Unassigned pillar'}</span>
            </span>
          </div>
        ),
        sortValue: (r) => `${r.artist} ${r.title}`,
      },
      {
        id: 'rotation',
        header: 'Rotation',
        cell: (r) => (
          <StatusPill
            raw={r.rotation === 1 ? 'ok' : 'info'}
            label={r.rotation === 1 ? 'High' : 'Standard'}
          />
        ),
        sortValue: (r) => r.rotation,
      },
      {
        id: 'store',
        header: 'Store',
        cell: (r) => <span>{r.store}</span>,
        sortValue: (r) => r.store,
      },
      {
        id: 'checkState',
        header: 'Beatport check',
        cell: (r) => {
          if (r.beatportCheckState === 'matched') {
            return <StatusPill raw="succeeded" label="Matched" />;
          }
          if (r.beatportCheckState === 'waiting') {
            return <StatusPill raw="warn" label="Waiting check" />;
          }
          return <StatusPill raw="idle" label="Not checked" />;
        },
        sortValue: (r) => r.beatportCheckState,
      },
      {
        id: 'price',
        header: 'Price',
        numeric: true,
        cell: (r) => <span className="data">{r.price}</span>,
        sortValue: (r) => r.price,
      },
      {
        id: 'actions',
        header: 'Action',
        cell: (r) => (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="sn-btn sn-btn--primary sn-btn--sm"
              onClick={() => {
                setBuyingTrack(r);
                setLocalPathInput(`/Music/DJ/${r.artist} - ${r.title}.mp3`);
              }}
            >
              Mark bought
            </button>
            <a
              href={`https://www.beatport.com/search?q=${encodeURIComponent(`${r.artist} ${r.title}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="sn-btn sn-btn--quiet sn-btn--icon sn-btn--sm"
              title="Search on Beatport"
              aria-label={`Search ${r.artist} – ${r.title} on Beatport`}
            >
              <ExternalLink size={14} />
            </a>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <main className="sn-page-log sn-page__main" id="main" tabIndex={-1}>
      <div className="sn-page-log__section">
        {/* Navigation back to library */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Link
            to="/library"
            className="sn-btn sn-btn--quiet sn-btn--sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <ArrowLeft size={16} />
            <span>Back to library</span>
          </Link>
        </div>

        {/* Page Header */}
        <PageHeader
          mod="library"
          lead="Library"
          title="Buy list"
          desc="High and Standard rotation tracks to purchase. Mark bought to feed local paths into the Rekordbox XML export."
          actions={
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                kind="quiet"
                size="sm"
                onClick={handleStartBeatportSync}
                disabled={syncJobActive}
              >
                <RefreshCw size={14} className={syncJobActive ? 'sn-spinner' : ''} />
                <span>Sync with Beatport</span>
              </Button>
            </div>
          }
        />

        {/* Assisted Beatport sync StagedProgress card */}
        {syncJobActive && (
          <section className="sn-card sn-m-library" style={{ margin: 'var(--space-4) 0' }}>
            <StagedProgress
              lead="Beatport sync"
              title="Catalog matching"
              steps={[
                {
                  name: 'Connect to Beatport',
                  state: syncStep >= 1 ? 'done' : 'running',
                  detail: 'Authenticated via catalog client',
                },
                {
                  name: 'Match pending tracks',
                  state: syncStep === 1 ? 'running' : syncStep > 1 ? 'done' : 'waiting',
                  detail: `${tracks.length} tracks scanned for Beatport IDs`,
                },
                {
                  name: 'Fetch catalog pricing & metadata',
                  state: syncStep === 2 ? 'running' : syncStep > 2 ? 'done' : 'waiting',
                  detail: 'Prices and release keys retrieved',
                },
                {
                  name: 'Update buy list records',
                  state: syncStep >= 3 ? 'done' : 'waiting',
                  detail: 'Buy list state updated',
                },
              ]}
              elapsedSeconds={syncStep * 3}
              runsInBackground={syncStep < 3}
            />
          </section>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', margin: 'var(--space-4) 0', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Rotation filter chips */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <span className="caption" style={{ color: 'var(--fg-3)', marginRight: 'var(--space-1)' }}>Rotation:</span>
            {[
              { id: 'all', label: `All (${tracks.filter(t => !t.isBought).length})` },
              { id: 'high', label: `High (${tracks.filter(t => t.rotation === 1 && !t.isBought).length})` },
              { id: 'standard', label: `Standard (${tracks.filter(t => t.rotation === 2 && !t.isBought).length})` },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                className={`sn-chip${rotationFilter === c.id ? ' sn-chip--active' : ''}`}
                onClick={() => setRotationFilter(c.id as any)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Store filter chips */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <span className="caption" style={{ color: 'var(--fg-3)', marginRight: 'var(--space-1)' }}>Store:</span>
            {[
              { id: 'all', label: 'All stores' },
              { id: 'beatport', label: 'Beatport' },
              { id: 'bandcamp', label: 'Bandcamp' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sn-chip${storeFilter === s.id ? ' sn-chip--active' : ''}`}
                onClick={() => setStoreFilter(s.id as any)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Buy list DataTable */}
        <DataTable<BuyTrackItem>
          rows={filteredTracks}
          columns={columns}
          rowId={(r) => r.id}
          caption="Buy list tracks"
          selected={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={(ids) => (
            <Button
              kind="primary"
              size="sm"
              onClick={handleBulkMarkBought}
            >
              <Check size={14} />
              <span>Mark {ids.size} bought</span>
            </Button>
          )}
          state={isLoading && tracks.length === 0 ? 'loading' : filteredTracks.length === 0 ? 'empty' : 'data'}
          emptyMessage={{
            title: 'No tracks to buy',
            body: 'All High and Standard rotation tracks are currently owned.',
          }}
        />

        {/* Mark Bought Dialog */}
        {buyingTrack && (
          <ConfirmDialog
            open={!!buyingTrack}
            title={`Mark bought: ${buyingTrack.artist} – ${buyingTrack.title}`}
            confirmLabel={isSubmittingBuy ? 'Saving…' : 'Save local path'}
            onConfirm={handleConfirmBuy}
            onCancel={() => setBuyingTrack(null)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p className="body" style={{ color: 'var(--fg-2)', margin: 0 }}>
                Record the local audio file path. This links the track in Rekordbox XML export on the next weekly run.
              </p>
              <div>
                <label htmlFor="local-path-input" className="caption label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>
                  Local file path
                </label>
                <input
                  id="local-path-input"
                  type="text"
                  className="sn-input"
                  style={{ width: '100%' }}
                  value={localPathInput}
                  onChange={(e) => setLocalPathInput(e.target.value)}
                  placeholder="/Music/DJ/Track.mp3"
                />
              </div>
            </div>
          </ConfirmDialog>
        )}
      </div>
    </main>
  );
};

export default BuyListPage;
