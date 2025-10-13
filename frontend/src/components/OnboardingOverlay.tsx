import React, { useEffect } from 'react';
import { BookOpenCheck, Layers, LifeBuoy, PlayCircle, Sparkles } from 'lucide-react';

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
  onDisable: () => void;
}

const keyboardShortcuts = [
  { combo: 'Ctrl/Cmd + K', description: 'Global command palette' },
  { combo: '1 / 2 / 3 / 4', description: 'Switch Select, Path, Setlist, Filter tools' },
  { combo: 'Space', description: 'Pause or resume graph physics' },
  { combo: 'Ctrl/Cmd + P', description: 'Jump to Path Builder' },
];

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ open, onClose, onDisable }) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-backdrop" onClick={onClose} />
      <div className="onboarding-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="onboarding-close" onClick={onClose} aria-label="Close orientation guide">
          ×
        </button>

        <div className="onboarding-header">
          <Sparkles size={28} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <h2 id="onboarding-title">Welcome to SongNodes DJ</h2>
            <p>Quick orientation for navigating PLAN vs PLAY modes and keeping your graph healthy.</p>
          </div>
        </div>

        <div className="onboarding-grid">
          <section>
            <header>
              <PlayCircle size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3>PLAN vs PLAY</h3>
            </header>
            <ul>
              <li><strong>PLAN mode</strong> exposes filters, path builder, and library tools to sculpt a setlist.</li>
              <li><strong>PLAY mode</strong> keeps decisions lightweight with the Now Playing deck and quick actions.</li>
              <li>Toggle any time: the state of your setlist and graph context stays in sync.</li>
            </ul>
          </section>

          <section>
            <header>
              <Layers size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3>Graph · Setlist · Filters</h3>
            </header>
            <ul>
              <li>Use the graph to audition transitions, then drop favourites straight into the setlist.</li>
              <li>Graph filters and the command palette drill into keys, energy, or communities in seconds.</li>
              <li>Path Builder turns start / end / waypoint picks into harmonically safe routes.</li>
            </ul>
          </section>

          <section>
            <header>
              <LifeBuoy size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3>When Data Looks Thin</h3>
            </header>
            <ul>
              <li>Verify the gateway + REST API are up: <code>docker compose up -d postgres redis rest-api api-gateway</code>.</li>
              <li>Queue fresh material via the Target Tracks manager, then trigger scrapers from the header.</li>
              <li>Need a reset? The health check script in <code>./scripts/health_check.sh</code> validates dependencies.</li>
            </ul>
          </section>
        </div>

        <div className="onboarding-shortcuts">
          {keyboardShortcuts.map(({ combo, description }) => (
            <div key={combo} className="onboarding-shortcut">
              <kbd>{combo}</kbd>
              <span>{description}</span>
            </div>
          ))}
        </div>

        <div className="onboarding-actions">
          <button type="button" className="onboarding-secondary" onClick={onDisable}>
            Don&apos;t show again
          </button>
          <button type="button" className="onboarding-primary" onClick={onClose}>
            Start exploring
          </button>
        </div>

        <footer className="onboarding-footer">
          <BookOpenCheck size={18} strokeWidth={1.6} aria-hidden="true" />
          <span>
            Need more detail? The architecture and ops playbooks live under <code>docs/</code>.
          </span>
        </footer>
      </div>
    </div>
  );
};
