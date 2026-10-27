import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Settings, AlertTriangle, ShieldCheck } from 'lucide-react';
import { checkAIAvailability, type TrackSummary } from '../../../services/aiService';
import { AIAssistantModal } from '../../../components/AIAssistantModal';
import '../../../components/AIAssistantModal.css';

export interface AITransitionHelperProps {
  sourceTrack: TrackSummary;
  targetTrack?: TrackSummary | null;
  onOpenSettings?: () => void;
  compact?: boolean;
}

export const AITransitionHelper: React.FC<AITransitionHelperProps> = ({
  sourceTrack,
  targetTrack,
  onOpenSettings,
  compact = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    checkAIAvailability().then((res) => {
      if (mounted) {
        setIsAvailable(res.available);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const sourceTitle = sourceTrack.title || sourceTrack.name || 'Current Track';
  const targetTitle = targetTrack?.title || targetTrack?.name || 'Next Track';

  return (
    <>
      <div className={`ai-transition-helper${compact ? ' ai-transition-helper--compact' : ''}`}>
        <div className="ai-transition-helper__header">
          <div className="ai-transition-helper__title">
            <Sparkles size={16} aria-hidden="true" style={{ color: 'var(--brand)' }} />
            <span>AI Transition Advisor</span>
          </div>

          <div className="ai-transition-helper__badge">
            {isAvailable === true ? (
              <span className="sn-pill sn-pill--outline" style={{ color: 'var(--status-ok)', borderColor: 'var(--status-ok)' }}>
                <ShieldCheck size={12} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} />
                AI Active
              </span>
            ) : isAvailable === false ? (
              <span className="sn-pill sn-pill--outline" style={{ color: 'var(--status-warn)', borderColor: 'var(--status-warn)' }}>
                <AlertTriangle size={12} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} />
                Unconfigured
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{sourceTitle}</span>
            <ArrowRight size={12} aria-hidden="true" />
            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{targetTitle}</span>
          </div>

          <button
            type="button"
            className="sn-btn sn-btn--sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Sparkles size={14} aria-hidden="true" style={{ marginRight: 'var(--space-1)' }} />
            Analyze Mix
          </button>
        </div>
      </div>

      <AIAssistantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sourceTrack={sourceTrack}
        targetTrack={targetTrack}
        onOpenSettings={onOpenSettings}
      />
    </>
  );
};

export default AITransitionHelper;
