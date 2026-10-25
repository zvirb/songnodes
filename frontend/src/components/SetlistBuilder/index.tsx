/**
 * SetlistBuilder - Main Component
 * Standardized setlist builder with undo/redo, virtualization, and analytics using Design System tokens
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Save, Undo2, Redo2, Download, Upload, Trash2, HelpCircle, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSetlistState } from './useSetlistState';
import { useAutoSave } from './useAutoSave';
import { VirtualizedTrackList } from './VirtualizedTrackList';
import { AnalyticsPanel } from './AnalyticsPanel';
import { TrackEditModal } from '../TrackEditModal';
import type { Setlist, SetlistTrack, ExportFormat } from './types';
import { formatDuration } from './utils';

interface SetlistBuilderProps {
  initialSetlist?: Setlist | null;
  onSave?: (setlist: Setlist) => Promise<void>;
  className?: string;
}

export const SetlistBuilder: React.FC<SetlistBuilderProps> = ({
  initialSetlist = null,
  onSave,
  className = '',
}) => {
  const {
    setlist,
    setSetlist,
    addTrack,
    removeTrack,
    moveTrack,
    updateTrack,
    undo,
    redo,
    canUndo,
    canRedo,
    clearSetlist,
  } = useSetlistState(initialSetlist);

  const [setlistName, setSetlistName] = useState(initialSetlist?.name || 'New Setlist');
  const [editingTrack, setEditingTrack] = useState<SetlistTrack | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Auto-save functionality
  const saveFunction = useCallback(
    async (data: Setlist) => {
      if (onSave) {
        await onSave(data);
        toast.success('Setlist saved successfully');
      } else {
        localStorage.setItem('setlist-autosave', JSON.stringify(data));
      }
    },
    [onSave]
  );

  const { saveStatus, forceSave } = useAutoSave(setlist, saveFunction);

  // Update setlist name when changed
  useEffect(() => {
    if (setlist && setlistName.trim() && setlistName !== setlist.name) {
      const updatedSetlist = { ...setlist, name: setlistName, updated_at: new Date() };
      setSetlist(updatedSetlist);
    }
  }, [setlistName, setlist, setSetlist]);

  // Keyboard shortcuts help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        forceSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forceSave]);

  const handleReorder = useCallback(
    (from: number, to: number) => {
      moveTrack(from, to);
      toast.success('Track moved');
    },
    [moveTrack]
  );

  const handleRemove = useCallback(
    (trackId: string) => {
      removeTrack(trackId);
      toast.success('Track removed from setlist');
    },
    [removeTrack]
  );

  const handleEdit = useCallback(
    (trackId: string) => {
      if (!setlist) return;
      const track = setlist.tracks.find((t) => t.id === trackId);
      if (track) {
        setEditingTrack(track);
      }
    },
    [setlist]
  );

  const handleSaveEdit = useCallback(
    (trackId: string, updates: Partial<SetlistTrack>) => {
      updateTrack(trackId, updates);
      setEditingTrack(null);
      toast.success('Track updated');
    },
    [updateTrack]
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!setlist || setlist.tracks.length === 0) {
        toast.error('No tracks to export');
        return;
      }

      try {
        let exportData: string;
        let filename: string;
        let mimeType: string;

        switch (format) {
          case 'json':
            exportData = JSON.stringify(setlist, null, 2);
            filename = `${setlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
            mimeType = 'application/json';
            break;

          case 'csv':
            const csvRows = [
              ['Position', 'Artist', 'Track', 'BPM', 'Key', 'Duration'].join(','),
              ...setlist.tracks.map((t, i) =>
                [
                  i + 1,
                  `"${t.track.artist}"`,
                  `"${t.track.name}"`,
                  t.track.bpm || '',
                  t.track.key || '',
                  formatDuration(t.track.duration),
                ].join(',')
              ),
            ];
            exportData = csvRows.join('\n');
            filename = `${setlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
            mimeType = 'text/csv';
            break;

          case 'm3u':
            const m3uLines = [
              '#EXTM3U',
              ...setlist.tracks.map(
                (t) =>
                  `#EXTINF:${Math.floor(t.track.duration || 0)},${t.track.artist} - ${t.track.name}\n# (not a file path)`
              ),
            ];
            exportData = m3uLines.join('\n');
            filename = `${setlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.m3u`;
            mimeType = 'audio/x-mpegurl';
            break;

          case 'clipboard':
            const clipboardText = setlist.tracks
              .map((t, i) => `${i + 1}. ${t.track.artist} - ${t.track.name}`)
              .join('\n');
            navigator.clipboard.writeText(clipboardText);
            toast.success('Setlist copied to clipboard');
            return;

          default:
            toast.error(`Export to ${format} not yet implemented`);
            return;
        }

        const blob = new Blob([exportData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Exported as ${format.toUpperCase()}`);
      } catch (error) {
        console.error('Export error:', error);
        toast.error('Failed to export setlist');
      }
    },
    [setlist]
  );

  const totalDuration = setlist?.tracks.reduce((sum, t) => sum + (t.track.duration || 0), 0) || 0;

  return (
    <div
      className={`flex flex-col h-full rounded-[var(--radius-sheet)] overflow-hidden ${className}`}
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      {/* Header Band */}
      <div
        className="flex-shrink-0 p-[var(--space-4)] border-b transition-colors"
        style={{
          backgroundColor: 'var(--mod-sets-bg)',
          borderColor: 'var(--mod-sets-line)',
        }}
      >
        <div className="flex items-center justify-between mb-[var(--space-3)]">
          <div className="flex-1 flex flex-col gap-[var(--space-1)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="font-[family-name:var(--font-display)] text-[1rem] font-normal text-[var(--mod-sets-muted)]">
                Set builder:
              </span>
              <input
                type="text"
                value={setlistName}
                onChange={(e) => setSetlistName(e.target.value)}
                className="font-[family-name:var(--font-display)] text-[1.375rem] font-bold bg-transparent border-b border-transparent focus:border-[var(--brand)] outline-none px-1 text-[var(--mod-sets-ink)]"
                placeholder="Setlist name..."
                aria-label="Setlist name"
              />
            </div>
            <div className="font-[family-name:var(--font-body)] text-[0.8125rem] text-[var(--mod-sets-muted)] flex items-center gap-[var(--space-3)]">
              <span>{setlist?.tracks.length || 0} tracks</span>
              <span>•</span>
              <span className="font-[family-name:var(--font-data)]">{formatDuration(totalDuration)}</span>
              <span>•</span>
              <span className="text-[0.75rem]">
                {saveStatus.status === 'saving'
                  ? 'Saving…'
                  : saveStatus.status === 'saved'
                  ? 'Saved'
                  : 'Auto-save ready'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-[var(--space-2)]">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              className="p-[var(--space-2)] rounded-[var(--radius-control)] hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--mod-sets-ink)] transition-colors"
              aria-label="Undo (Cmd+Z)"
              title="Undo (Cmd+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              className="p-[var(--space-2)] rounded-[var(--radius-control)] hover:bg-[var(--hover-bg)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--mod-sets-ink)] transition-colors"
              aria-label="Redo (Cmd+Shift+Z)"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 size={18} />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-[var(--space-2)] rounded-[var(--radius-control)] hover:bg-[var(--hover-bg)] text-[var(--mod-sets-ink)] transition-colors"
              aria-label="Help (Cmd+/)"
              title="Help (Cmd+/)"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <button
            onClick={() => handleExport('json')}
            disabled={!setlist || setlist.tracks.length === 0}
            className="px-3 py-1.5 font-[family-name:var(--font-body)] text-[0.8125rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            style={{
              backgroundColor: 'var(--mod-sets-raised)',
              color: 'var(--mod-sets-ink)',
              border: '1px solid var(--mod-sets-line)',
            }}
          >
            <Download size={14} />
            Export JSON
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={!setlist || setlist.tracks.length === 0}
            className="px-3 py-1.5 font-[family-name:var(--font-body)] text-[0.8125rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            style={{
              backgroundColor: 'var(--mod-sets-raised)',
              color: 'var(--mod-sets-ink)',
              border: '1px solid var(--mod-sets-line)',
            }}
          >
            <Download size={14} />
            Export CSV
          </button>

          <button
            onClick={() => handleExport('clipboard')}
            disabled={!setlist || setlist.tracks.length === 0}
            className="px-3 py-1.5 font-[family-name:var(--font-body)] text-[0.8125rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            style={{
              backgroundColor: 'var(--mod-sets-raised)',
              color: 'var(--mod-sets-ink)',
              border: '1px solid var(--mod-sets-line)',
            }}
          >
            <Upload size={14} />
            Copy List
          </button>

          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            disabled={!setlist || setlist.tracks.length < 2}
            className="px-3 py-1.5 font-[family-name:var(--font-body)] text-[0.8125rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            style={{
              backgroundColor: showAnalytics ? 'var(--brand)' : 'var(--mod-sets-raised)',
              color: showAnalytics ? 'var(--on-brand)' : 'var(--mod-sets-ink)',
              border: '1px solid var(--mod-sets-line)',
            }}
          >
            <BarChart2 size={14} />
            {showAnalytics ? 'Hide Analytics' : 'Analytics'}
          </button>

          <button
            onClick={clearSetlist}
            disabled={!setlist || setlist.tracks.length === 0}
            className="px-3 py-1.5 font-[family-name:var(--font-body)] text-[0.8125rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors ml-auto"
            style={{
              backgroundColor: 'var(--status-bad-bg)',
              color: 'var(--status-bad)',
              border: '1px solid var(--status-bad)',
            }}
          >
            <Trash2 size={14} />
            Clear Set
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-[var(--space-4)]">
        {showAnalytics && setlist && setlist.tracks.length >= 2 ? (
          <div className="h-full overflow-auto pr-1">
            <AnalyticsPanel setlist={setlist} />
          </div>
        ) : (
          <div className="h-full">
            <VirtualizedTrackList
              tracks={setlist?.tracks || []}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onEdit={handleEdit}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {editingTrack && (
        <TrackEditModal
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSave={handleSaveEdit}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'var(--overlay)',
            zIndex: 'var(--z-dialog)',
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            className="rounded-[var(--radius-sheet)] p-[var(--space-6)] max-w-md w-full flex flex-col gap-[var(--space-4)]"
            style={{
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--line-strong)',
              boxShadow: 'var(--shadow-3)',
              color: 'var(--fg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-display)] text-[1.375rem] font-bold text-[var(--fg)]">
              Keyboard Shortcuts
            </h3>
            <div className="flex flex-col gap-[var(--space-2)] text-[0.8125rem] font-[family-name:var(--font-body)]">
              <div className="flex justify-between items-center py-1 border-b border-[var(--line)]">
                <span className="text-[var(--fg-2)]">Undo action</span>
                <kbd className="px-2 py-0.5 font-[family-name:var(--font-data)] bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--radius-chip)] text-[var(--fg)]">
                  Cmd+Z
                </kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--line)]">
                <span className="text-[var(--fg-2)]">Redo action</span>
                <kbd className="px-2 py-0.5 font-[family-name:var(--font-data)] bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--radius-chip)] text-[var(--fg)]">
                  Cmd+Shift+Z
                </kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--line)]">
                <span className="text-[var(--fg-2)]">Save setlist</span>
                <kbd className="px-2 py-0.5 font-[family-name:var(--font-data)] bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--radius-chip)] text-[var(--fg)]">
                  Cmd+S
                </kbd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--line)]">
                <span className="text-[var(--fg-2)]">Toggle help</span>
                <kbd className="px-2 py-0.5 font-[family-name:var(--font-data)] bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--radius-chip)] text-[var(--fg)]">
                  Cmd+/
                </kbd>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-[var(--space-2)] w-full py-2 font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold rounded-[var(--radius-control)] transition-colors"
              style={{
                backgroundColor: 'var(--brand)',
                color: 'var(--on-brand)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetlistBuilder;

export type { Setlist, SetlistTrack, Track, TransitionQuality, SetlistAnalytics } from './types';
