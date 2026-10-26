import React, { useState, useEffect } from 'react';
import { usePageHeader } from '../../shell/AppShell';
import { PageHeader } from '../../shell/PageParts';
import { Button, Tabs, ConfirmDialog } from '../../components/ds';
import { InlineMessage, CopyButton, DataTable, type DataTableColumn } from './components/ui';
import { useUnifiedTracks } from '../../hooks/useUnifiedTracks';
import { buildPrompt } from './api/prompt';
import { parseAndValidate } from './api/parser';
import { dedupe, type CatalogSetlist, type DedupeResult } from './api/dedupe';
import { checkAIAvailability } from '../../services/aiService';
import { runDirectQuery } from './api/directRun';
import type { AISetlist, AISetlistTrack } from './api/schema';
import { SN } from '../../lib/songnodes';

const PAGE_MODULE = 'sources';

export default function AISetlistsPage() {
  usePageHeader({ lead: 'Sources', title: 'Import tracklist', current: 'sources' });
  const { tracks: catalogTracks, isLoading: tracksLoading } = useUnifiedTracks();
  const [catalogSetlists, setCatalogSetlists] = useState<CatalogSetlist[]>([]);
  const [localLedger, setLocalLedger] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<'prompt' | 'api'>('prompt');

  // Prompt builder state
  const [genre, setGenre] = useState('');
  const [djsOrEvents, setDjsOrEvents] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [count, setCount] = useState(5);
  const [userExtra, setUserExtra] = useState('');

  // Paste / Review State
  const [pastedJson, setPastedJson] = useState('');
  const [reviewResult, setReviewResult] = useState<DedupeResult | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selectedSetlists, setSelectedSetlists] = useState<Set<string>>(new Set());

  // Provider / API State
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('claude');
  const [isCallingAPI, setIsCallingAPI] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(true);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<{created: number, replayed: number, failed: number} | null>(null);
  const [failedSetlists, setFailedSetlists] = useState<AISetlist[]>([]);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [retryMode, setRetryMode] = useState(false);

  useEffect(() => {
    try {
      const ledger = JSON.parse(localStorage.getItem('songnodes_ai_setlists_ledger') || '[]');
      setLocalLedger(ledger);
    } catch {}

    fetch('/api/v1/setlists')
      .then(res => res.json())
      .then(data => setCatalogSetlists(data || []))
      .catch(() => {});

    checkAIAvailability().then(avail => {
      setProviders(avail.configuredProviders);
      if (avail.configuredProviders.length > 0 && !avail.configuredProviders.includes(selectedProvider as any)) {
        setSelectedProvider(avail.configuredProviders[0]);
      }
    });
  }, []);

  const generatedPrompt = buildPrompt({
    genre,
    djsOrEvents,
    dateRange,
    count,
    exclusions: {
      existingSetlists: catalogSetlists.map(c => `${c.dj_artist_name} @ ${c.event_name} (${c.set_date})`),
      existingTracks: catalogTracks.map(t => `${t.artist} - ${t.title}`),
      localLedger,
      userExtra
    }
  });

  const handleReview = (rawJson: string) => {
    setParseErrors([]);
    setReviewResult(null);
    setImportStats(null);
    setFailedSetlists([]);
    setSelectedSetlists(new Set());

    if (!rawJson.trim()) return;

    const { data, errors } = parseAndValidate(rawJson);
    if (errors.length > 0 || !data) {
      setParseErrors(errors);
      return;
    }

    const deduped = dedupe(data.setlists, catalogSetlists, localLedger, catalogTracks);
    setReviewResult(deduped);

    const newKeys = new Set(deduped.newSetlists.map(sl => `${sl.dj}|${sl.event}|${sl.date}`));
    setSelectedSetlists(newKeys);
  };

  const handleRunAPI = async () => {
    setIsCallingAPI(true);
    setApiError(null);
    setParseErrors([]);
    setReviewResult(null);
    try {
      const result = await runDirectQuery(selectedProvider as import("../../services/aiService").AIProvider, generatedPrompt, undefined, useWebSearch);
      setPastedJson(result);
      handleReview(result);
    } catch (e: any) {
      setApiError(e.message || "API call failed.");
    } finally {
      setIsCallingAPI(false);
    }
  };

  const performImport = async (setlistsToImport: AISetlist[]) => {
    setIsImporting(true);

    let created = 0;
    let failed = 0;
    let replayed = 0;

    const newLedgerAdditions: string[] = [];
    const currentFailed: AISetlist[] = [];

    for (let i = 0; i < setlistsToImport.length; i++) {
      const sl = setlistsToImport[i];
      setImportProgress(Math.round((i / setlistsToImport.length) * 100));
      try {
        const payload = {
          dj_artist: sl.dj,
          name: sl.event || 'AI Setlist',
          tracks: sl.tracks.map(t => ({
             artist: t.artist,
             title: t.title,
             track_number: t.position
          }))
        };
        const res = await fetch('/api/v1/tracks/import-tracklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.replayed) {
          replayed++;
        } else {
          created++;
        }
        newLedgerAdditions.push(`${sl.dj} @ ${sl.event} (${sl.date})`);
      } catch (e) {
        failed++;
        currentFailed.push(sl);
      }
    }

    setImportProgress(100);
    setIsImporting(false);

    setImportStats(prev => ({
       created: (prev?.created || 0) + created,
       replayed: (prev?.replayed || 0) + replayed,
       failed: currentFailed.length
    }));

    setFailedSetlists(currentFailed);

    try {
      const updatedLedger = [...localLedger, ...newLedgerAdditions];
      setLocalLedger(updatedLedger);
      localStorage.setItem('songnodes_ai_setlists_ledger', JSON.stringify(updatedLedger));
    } catch (err) {
      console.warn('Failed to save to local storage ledger', err);
    }
  };

  const handleImport = () => {
    if (!reviewResult || selectedSetlists.size === 0) return;
    setRetryMode(false);
    setConfirmImportOpen(true);
  };

  const handleRetryFailed = () => {
    if (failedSetlists.length > 0) {
      setRetryMode(true);
      setConfirmImportOpen(true);
    }
  };

  const executeImport = () => {
    setConfirmImportOpen(false);
    const setlistsToImport = retryMode ? failedSetlists : reviewResult!.newSetlists.filter(sl =>
      selectedSetlists.has(`${sl.dj}|${sl.event}|${sl.date}`)
    );
    performImport(setlistsToImport);
  };

  const columns: DataTableColumn<AISetlistTrack>[] = [
    { id: 'pos', header: '#', numeric: true, cell: (r) => r.position },
    { id: 'artist', header: 'Artist', cell: (r) => r.artist, defaultVisible: true, fixed: true },
    { id: 'title', header: 'Title', cell: (r) => r.title, defaultVisible: true, fixed: true },
    { id: 'mix', header: 'Mix', cell: (r) => r.mix || <span className="sn-none">–</span> },
    { id: 'label', header: 'Label', cell: (r) => r.label || <span className="sn-none">–</span> },
  ];

  return (
    <div className="sn-page sn-page--sources">
      <PageHeader
        mod={PAGE_MODULE}
        here="Import tracklist"
        lead="Sources"
        title="Import tracklist"
        desc="Find and import real, documented DJ setlists using AI providers."
      />
      <div className="sn-page__body">
        <Tabs
          label="Import Methods"
          value={activeTab}
          onChange={(v: any) => setActiveTab(v)}
          tabs={[
            { id: 'prompt', label: 'Copy Prompt' },
            { id: 'api', label: 'Use API' }
          ]}
        />
        <div className="sn-layout-stack" style={{ gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>

           <div className="sn-card">
             <h2 className="title-s sn-mb-3">Setlist Parameters</h2>
             <div className="sn-layout-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
               <label className="sn-field">
                 <span className="label">Genre / Style</span>
                 <input type="text" className="sn-input" value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. Techno, UKG" />
               </label>
               <label className="sn-field">
                 <span className="label">DJs or Events</span>
                 <input type="text" className="sn-input" value={djsOrEvents} onChange={e => setDjsOrEvents(e.target.value)} placeholder="e.g. Dekmantel, Boiler Room" />
               </label>
               <label className="sn-field">
                 <span className="label">Count</span>
                 <input type="number" className="sn-input" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={20} />
               </label>
               <label className="sn-field">
                 <span className="label">Additional Exclusions</span>
                 <input type="text" className="sn-input" value={userExtra} onChange={e => setUserExtra(e.target.value)} placeholder="Specific DJs or keywords to avoid" />
               </label>
             </div>
           </div>

           {activeTab === 'prompt' ? (
             <div className="sn-card">
               <h2 className="title-s sn-mb-3">1. Copy Prompt</h2>
               <div className="sn-tablebox" style={{ maxHeight: 200, padding: 'var(--space-3)' }}>
                 <pre className="data" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{generatedPrompt}</pre>
               </div>
               <div className="sn-mt-3">
                 <CopyButton value={generatedPrompt} what="Prompt" label="Copy prompt" />
               </div>

               <h2 className="title-s sn-mt-6 sn-mb-3">2. Paste Result</h2>
               <textarea
                 className="sn-input"
                 rows={8}
                 value={pastedJson}
                 onChange={e => setPastedJson(e.target.value)}
                 placeholder="Paste the JSON response here..."
               />
               <div className="sn-mt-3">
                 <button className="sn-btn sn-btn--primary" onClick={() => handleReview(pastedJson)} disabled={!pastedJson.trim()}>Review Data</button>
               </div>
             </div>
           ) : (
             <div className="sn-card">
                <h2 className="title-s sn-mb-3">Provider Settings</h2>
                {providers.length === 0 ? (
                   <InlineMessage status="warn">No AI providers configured. Add keys in Settings.</InlineMessage>
                ) : (
                   <div className="sn-row sn-row--compact">
                     <label className="sn-field sn-field--inline">
                       <span className="label">Provider</span>
                       <select className="sn-input" value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                         {providers.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                       </select>
                     </label>
                     {selectedProvider === 'gemini' && (
                       <label className="sn-field sn-field--inline" style={{ marginLeft: 'var(--space-4)' }}>
                         <input type="checkbox" checked={useWebSearch} onChange={e => setUseWebSearch(e.target.checked)} />
                         <span className="label sn-ml-2">Enable Web Search</span>
                       </label>
                     )}
                     <button className="sn-btn sn-btn--primary" onClick={handleRunAPI} disabled={isCallingAPI}>
                       {isCallingAPI ? 'Requesting...' : 'Run Search'}
                     </button>
                   </div>
                )}
                {apiError && <div className="sn-mt-3"><InlineMessage status="bad">{apiError}</InlineMessage></div>}
             </div>
           )}

           {parseErrors.length > 0 && (
             <div className="sn-card sn-card--danger">
               <h2 className="title-s">Validation Errors</h2>
               <ul className="sn-list sn-mt-2">
                 {parseErrors.map((err, i) => <li key={i} className="body">{err}</li>)}
               </ul>
             </div>
           )}

           {reviewResult && (
             <div className="sn-card">
               <h2 className="title-s sn-mb-4">Review Summary</h2>
               <div className="sn-layout-grid sn-mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)'}}>
                  <div className="sn-stat">
                    <div className="figure">{reviewResult.newSetlists.length}</div>
                    <div className="label">NEW SETLISTS</div>
                  </div>
                  <div className="sn-stat">
                    <div className="figure" style={{ color: 'var(--fg-3)'}}>{reviewResult.existingSetlists.length}</div>
                    <div className="label">EXCLUDED</div>
                  </div>
                  <div className="sn-stat">
                    <div className="figure">{reviewResult.tracksNew}</div>
                    <div className="label">NEW TRACKS</div>
                  </div>
                  <div className="sn-stat">
                    <div className="figure" style={{ color: 'var(--fg-3)'}}>{reviewResult.tracksExisting}</div>
                    <div className="label">EXISTING TRACKS</div>
                  </div>
               </div>

               {reviewResult.existingSetlists.length > 0 && (
                  <div className="sn-mb-6">
                    <h3 className="title-lead sn-mb-2">Excluded Setlists</h3>
                    <ul className="sn-list">
                      {reviewResult.existingSetlists.map((ex, i) => (
                         <li key={i} className="body-s">
                           <span style={{ color: 'var(--fg-2)' }}>{ex.setlist.dj} @ {ex.setlist.event} ({ex.setlist.date})</span> — {ex.reason}
                         </li>
                      ))}
                    </ul>
                  </div>
               )}

               {reviewResult.newSetlists.length > 0 && (
                 <div className="sn-mb-6">
                   <h3 className="title-lead sn-mb-2">New Setlists to Import</h3>
                   <div className="sn-layout-stack" style={{ gap: 'var(--space-6)' }}>
                     {reviewResult.newSetlists.map(sl => {
                        const slKey = `${sl.dj}|${sl.event}|${sl.date}`;
                        const isSelected = selectedSetlists.has(slKey);
                        return (
                          <div key={slKey}>
                            <div className="sn-row sn-mb-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedSetlists);
                                  if (e.target.checked) next.add(slKey);
                                  else next.delete(slKey);
                                  setSelectedSetlists(next);
                                }}
                              />
                              <span className="body-strong">{sl.dj} @ {sl.event} ({sl.date || 'Unknown Date'})</span>
                              <a href={sl.source_url} target="_blank" rel="noreferrer" className="label sn-link sn-ml-auto">Source</a>
                            </div>
                            {isSelected && (
                              <DataTable
                                rows={sl.tracks}
                                columns={columns}
                                rowId={(t) => `${t.position}-${t.artist}-${t.title}`}
                                caption={`Tracks for ${sl.dj} @ ${sl.event}`}
                                density="compact"
                              />
                            )}
                          </div>
                        );
                     })}
                   </div>
                 </div>
               )}

               <div className="sn-mt-6" aria-live="polite">
                 <button
                   className="sn-btn sn-btn--primary"
                   disabled={selectedSetlists.size === 0 || isImporting}
                   onClick={handleImport}
                 >
                   {isImporting ? `Importing... ${importProgress}%` : `Load ${selectedSetlists.size} new setlists`}
                 </button>
               </div>

               {importStats && (
                 <div className="sn-mt-4">
                   <InlineMessage status={importStats.failed > 0 ? "warn" : "ok"}>
                     Import complete: {importStats.created} created, {importStats.replayed} replayed, {importStats.failed} failed.
                   </InlineMessage>
                   {failedSetlists.length > 0 && (
                     <button className="sn-btn sn-mt-2" onClick={handleRetryFailed}>Retry Failed Imports</button>
                   )}
                 </div>
               )}
             </div>
           )}
        </div>
      </div>
      <ConfirmDialog
         open={confirmImportOpen}
         title={retryMode ? "Retry failed imports?" : `Import ${selectedSetlists.size} setlist(s)?`}
         confirmLabel={retryMode ? "Retry imports" : "Import setlists"}
         onCancel={() => setConfirmImportOpen(false)}
         onConfirm={executeImport}
      >
        <p className="body">{retryMode ? "This will retry the failed setlists." : "These setlists and their tracks will be permanently added to the backend catalog."}</p>
      </ConfirmDialog>
    </div>
  );
}
