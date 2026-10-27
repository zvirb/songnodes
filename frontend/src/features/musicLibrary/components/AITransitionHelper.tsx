import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Settings, AlertTriangle, ShieldCheck } from 'lucide-react';
import { checkAIAvailability, type TrackSummary } from '../../../services/aiService';
import { AIAssistantModal } from '../../../components/AIAssistantModal';
import { StatusPill } from '../../../lib/songnodes';
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
            <Sparkles size={16} aria-hidden="true" className="sn-color-brand" />
            <span>AI Transition Advisor</span>
          </div>

          <div className="ai-transition-helper__badge">
            {isAvailable === true ? (
              <StatusPill raw="ok" label="AI Active" />
            ) : isAvailable === false ? (
              <StatusPill raw="warn" label="Unconfigured" />
            ) : null}
          </div>
        </div>

        <div className="sn-row sn-justify-between sn-gap-2">
          <div className="sn-row sn-color-fg-2 body-s sn-gap-1">
            <span className="body-strong sn-color-fg">{sourceTitle}</span>
            <ArrowRight size={12} aria-hidden="true" />
            <span className="body-strong sn-color-fg">{targetTitle}</span>
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
