import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Bot,
  Settings,
  History,
  AlertTriangle,
  RotateCcw,
  Zap,
  Music,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  checkAIAvailability,
  generateTransitionNotes,
  getPromptHistory,
  clearPromptHistory,
  type AIProvider,
  type TrackSummary,
  type AITransitionResponse,
  type AIPromptHistoryItem,
  type AvailabilityResult,
} from '../services/aiService';
import { Dialog, SegmentedControl, Tabs, TabPanel, LoadingPanel } from './ds';
import './AIAssistantModal.css';

export interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTrack?: TrackSummary | null;
  targetTrack?: TrackSummary | null;
  onOpenSettings?: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  sourceTrack,
  targetTrack,
  onOpenSettings,
}) => {
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(true);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [response, setResponse] = useState<AITransitionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'history'>('analysis');
  const [history, setHistory] = useState<AIPromptHistoryItem[]>([]);

  const defaultSource: TrackSummary = sourceTrack || {
    title: 'Source Track',
    artist: 'Select a Track',
    bpm: 124,
    camelotKey: '8A',
    energy: 6,
    genre: 'House',
  };

  const defaultTarget: TrackSummary = targetTrack || {
    title: 'Target Track',
    artist: 'Select a Track',
    bpm: 126,
    camelotKey: '9A',
    energy: 7,
    genre: 'Tech House',
  };

  const runAvailabilityCheck = useCallback(async () => {
    setCheckingAvailability(true);
    const result = await checkAIAvailability();
    setAvailability(result);
    if (result.defaultProvider) {
      setSelectedProvider(result.defaultProvider);
    }
    setCheckingAvailability(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      runAvailabilityCheck();
      setHistory(getPromptHistory());
    }
  }, [isOpen, runAvailabilityCheck]);

  const handleGenerate = async () => {
    if (!availability?.available) return;

    setLoading(true);
    setResponse(null);

    const res = await generateTransitionNotes({
      sourceTrack: defaultSource,
      targetTrack: defaultTarget,
      provider: selectedProvider,
      customPrompt: customPrompt.trim() || undefined,
    });

    setResponse(res);
    setHistory(getPromptHistory());
    setLoading(false);
  };

  const handleClearHistory = () => {
    clearPromptHistory();
    setHistory([]);
  };

  const providerOptions = (availability?.configuredProviders || ['claude', 'openai', 'gemini']).map(
    (p) => ({
      value: p,
      label: p.charAt(0).toUpperCase() + p.slice(1),
    })
  );

  return (
    <Dialog
      open={isOpen}
      title="AI Setlist Reasoning & Transition Assistant"
      sub="Acoustic analysis & dynamic DJ mixing notes powered by AI reasoning models"
      size="l"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {availability?.available && (
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={handleGenerate}
              disabled={loading}
              aria-busy={loading || undefined}
            >
              {loading ? (
                <>
                  <span className="sn-spinner" aria-hidden="true" />
                  Analyzing Transition...
                </>
              ) : (
                <>
                  <Sparkles size={16} aria-hidden="true" />
                  Generate Transition Notes
                </>
              )}
            </button>
          )}
          <button type="button" className="sn-btn" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="ai-assistant-modal">
        {/* Availability Gatekeeping Prompt */}
        {checkingAvailability ? (
          <LoadingPanel message="Checking AI API key status..." rows={2} />
        ) : !availability?.available ? (
          <div className="ai-assistant-modal__unconfig-alert" role="alert">
            <div className="ai-assistant-modal__unconfig-header">
              <AlertTriangle size={20} aria-hidden="true" />
              <span>AI Service Unconfigured</span>
            </div>
            <p className="ai-assistant-modal__unconfig-text">
              No valid AI API key (Claude, OpenAI, or Gemini) is currently configured. To enable AI transition
              reasoning and setlist compatibility recommendations, please add your API key in Settings.
            </p>
            {onOpenSettings && (
              <button
                type="button"
                className="sn-btn sn-btn--sm ai-assistant-modal__unconfig-action"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                <Settings size={14} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} />
                Configure Keys in Settings
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Track Comparison Header */}
            <div className="ai-assistant-modal__track-comparison">
              <div className="ai-assistant-modal__track-card">
                <span className="ai-assistant-modal__track-role">Source Track (Deck A)</span>
                <span className="ai-assistant-modal__track-title">
                  {defaultSource.title || defaultSource.name}
                </span>
                <span className="ai-assistant-modal__track-artist">{defaultSource.artist}</span>
                <div className="ai-assistant-modal__track-meta">
                  <span className="sn-tag">{defaultSource.bpm} BPM</span>
                  <span className="sn-tag">Key {defaultSource.camelotKey || defaultSource.camelot_key}</span>
                  {defaultSource.energy != null && (
                    <span className="sn-tag">Energy {defaultSource.energy}/10</span>
                  )}
                  {defaultSource.genre && <span className="sn-tag">{defaultSource.genre}</span>}
                </div>
              </div>

              <div className="ai-assistant-modal__vs">VS</div>

              <div className="ai-assistant-modal__track-card">
                <span className="ai-assistant-modal__track-role">Target Track (Deck B)</span>
                <span className="ai-assistant-modal__track-title">
                  {defaultTarget.title || defaultTarget.name}
                </span>
                <span className="ai-assistant-modal__track-artist">{defaultTarget.artist}</span>
                <div className="ai-assistant-modal__track-meta">
                  <span className="sn-tag">{defaultTarget.bpm} BPM</span>
                  <span className="sn-tag">Key {defaultTarget.camelotKey || defaultTarget.camelot_key}</span>
                  {defaultTarget.energy != null && (
                    <span className="sn-tag">Energy {defaultTarget.energy}/10</span>
                  )}
                  {defaultTarget.genre && <span className="sn-tag">{defaultTarget.genre}</span>}
                </div>
              </div>
            </div>

            {/* Provider and Controls */}
            <div className="ai-assistant-modal__provider-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Bot size={16} aria-hidden="true" style={{ color: 'var(--brand)' }} />
                <span className="ai-assistant-modal__provider-label">AI Model Provider:</span>
              </div>
              <SegmentedControl
                label="Provider Selection"
                options={providerOptions}
                value={selectedProvider}
                onChange={(val) => setSelectedProvider(val as AIProvider)}
                size="sm"
              />
            </div>

            {/* Custom Instructions Field */}
            <div className="sn-field">
              <label htmlFor="ai-custom-instructions" className="label">
                Custom Mixing Focus or Cue Notes (Optional)
              </label>
              <input
                id="ai-custom-instructions"
                className="sn-input"
                type="text"
                placeholder="e.g. Focus on vocal overlay avoid, or fast 8-bar drop swap"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>

            {/* Tabs for Analysis and History */}
            <Tabs
              label="AI Views"
              idBase="ai-modal"
              tabs={[
                { id: 'analysis', label: 'Transition Notes' },
                { id: 'history', label: 'Prompt History', count: history.length },
              ]}
              value={activeTab}
              onChange={(t) => setActiveTab(t as 'analysis' | 'history')}
            />

            <TabPanel idBase="ai-modal" id="analysis">
              {loading ? (
                <div className="ai-assistant-modal__loading">
                  <LoadingPanel message={`Generating DJ mixing analysis via ${selectedProvider.toUpperCase()}...`} rows={4} />
                </div>
              ) : response?.analysis ? (
                <div className="ai-assistant-modal__results">
                  <div className="ai-assistant-modal__section">
                    <h4 className="ai-assistant-modal__section-title">
                      <Music size={16} aria-hidden="true" />
                      Harmonic Compatibility
                    </h4>
                    <div className="ai-assistant-modal__section-content">
                      {response.analysis.harmonicCompatibility}
                    </div>
                  </div>

                  <div className="ai-assistant-modal__section">
                    <h4 className="ai-assistant-modal__section-title">
                      <Zap size={16} aria-hidden="true" />
                      Tempo & Beatmatching
                    </h4>
                    <div className="ai-assistant-modal__section-content">
                      {response.analysis.tempoTransition}
                    </div>
                  </div>

                  <div className="ai-assistant-modal__section">
                    <h4 className="ai-assistant-modal__section-title">
                      <Sliders size={16} aria-hidden="true" />
                      EQ & Blending Strategy
                    </h4>
                    <div className="ai-assistant-modal__section-content">
                      {response.analysis.eqBlending}
                    </div>
                  </div>

                  <div className="ai-assistant-modal__section">
                    <h4 className="ai-assistant-modal__section-title">
                      <Sparkles size={16} aria-hidden="true" />
                      Creative Setlist Notes
                    </h4>
                    <div className="ai-assistant-modal__section-content">
                      {response.analysis.creativeNotes}
                    </div>
                  </div>
                </div>
              ) : response?.content ? (
                <div className="ai-assistant-modal__section">
                  <div className="ai-assistant-modal__section-content">{response.content}</div>
                </div>
              ) : (
                <div
                  className="sn-empty-state sn-empty-state--compact"
                  style={{ backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)' }}
                >
                  <Sparkles size={28} style={{ color: 'var(--brand)', marginBottom: 'var(--space-2)' }} />
                  <h3 className="sn-empty-state__title">Ready for AI Analysis</h3>
                  <p className="sn-empty-state__text">
                    Click "Generate Transition Notes" above to analyze BPM shifts, key compatibility, EQ blending techniques, and creative setlist cues.
                  </p>
                </div>
              )}
            </TabPanel>

            <TabPanel idBase="ai-modal" id="history">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span className="label">Past Prompt Executions</span>
                {history.length > 0 && (
                  <button type="button" className="sn-btn sn-btn--quiet sn-btn--sm" onClick={handleClearHistory}>
                    <RotateCcw size={12} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} />
                    Clear History
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="sn-empty-state sn-empty-state--compact" style={{ padding: 'var(--space-4)' }}>
                  <History size={20} style={{ color: 'var(--fg-3)' }} />
                  <p className="sn-empty-state__text">No previous prompt history found.</p>
                </div>
              ) : (
                <div className="ai-assistant-modal__history">
                  {history.map((item) => (
                    <div key={item.id} className="ai-assistant-modal__history-item">
                      <div className="ai-assistant-modal__history-head">
                        <span className="sn-tag">{item.provider.toUpperCase()}</span>
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="ai-assistant-modal__history-tracks">
                        {item.sourceTrack} → {item.targetTrack}
                      </div>
                      <div className="ai-assistant-modal__history-snippet">{item.response}</div>
                    </div>
                  ))}
                </div>
              )}
            </TabPanel>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default AIAssistantModal;
