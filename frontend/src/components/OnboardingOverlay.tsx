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
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="onboarding-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--color-modal-overlay)',
          backdropFilter: 'blur(10px)'
        }}
      />
      <div
        className="onboarding-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-modal-bg)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-modal)',
          boxShadow: 'var(--shadow-modal)',
          color: 'var(--color-text-primary)',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          zIndex: 1
        }}
      >
        <button
          type="button"
          className="onboarding-close"
          onClick={onClose}
          aria-label="Close orientation guide"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-tertiary)',
            fontSize: '24px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>

        <div className="onboarding-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <Sparkles size={28} strokeWidth={1.6} aria-hidden="true" style={{ color: 'var(--color-brand-primary)' }} />
          <div>
            <h2 id="onboarding-title" style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              Welcome to SongNodes DJ
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
              Quick orientation for navigating PLAN vs PLAY modes and keeping your graph healthy.
            </p>
          </div>
        </div>

        <div className="onboarding-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <section
            style={{
              backgroundColor: 'var(--color-bg-elevated-1)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '16px'
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--color-brand-primary)' }}>
              <PlayCircle size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>PLAN vs PLAY</h3>
            </header>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <li><strong style={{ color: 'var(--color-text-primary)' }}>PLAN mode</strong> exposes filters, path builder, and library tools to sculpt a setlist.</li>
              <li><strong style={{ color: 'var(--color-text-primary)' }}>PLAY mode</strong> keeps decisions lightweight with the Now Playing deck and quick actions.</li>
              <li>Toggle any time: the state of your setlist and graph context stays in sync.</li>
            </ul>
          </section>

          <section
            style={{
              backgroundColor: 'var(--color-bg-elevated-1)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '16px'
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--color-brand-secondary)' }}>
              <Layers size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>Graph · Setlist · Filters</h3>
            </header>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <li>Use the graph to audition transitions, then drop favourites straight into the setlist.</li>
              <li>Graph filters and the command palette drill into keys, energy, or communities in seconds.</li>
              <li>Path Builder turns start / end / waypoint picks into harmonically safe routes.</li>
            </ul>
          </section>

          <section
            style={{
              backgroundColor: 'var(--color-bg-elevated-1)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '16px'
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--color-warning)' }}>
              <LifeBuoy size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>When Data Looks Thin</h3>
            </header>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <li>Verify the gateway + REST API are up: <code style={{ backgroundColor: 'var(--color-bg-elevated-3)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-family-mono)' }}>docker compose up -d postgres redis rest-api api-gateway</code>.</li>
              <li>Queue fresh material via the Target Tracks manager, then trigger scrapers from the header.</li>
              <li>Need a reset? The health check script in <code style={{ backgroundColor: 'var(--color-bg-elevated-3)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-family-mono)' }}>./scripts/health_check.sh</code> validates dependencies.</li>
            </ul>
          </section>
        </div>

        <div className="onboarding-shortcuts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {keyboardShortcuts.map(({ combo, description }) => (
            <div
              key={combo}
              className="onboarding-shortcut"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'var(--color-bg-elevated-2)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px'
              }}
            >
              <kbd
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--font-size-xs)',
                  backgroundColor: 'var(--color-bg-elevated-3)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 6px',
                  color: 'var(--color-brand-primary)'
                }}
              >
                {combo}
              </kbd>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{description}</span>
            </div>
          ))}
        </div>

        <div className="onboarding-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
          <button
            type="button"
            className="onboarding-secondary"
            onClick={onDisable}
            style={{
              padding: '10px 18px',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}
          >
            Don&apos;t show again
          </button>
          <button
            type="button"
            className="onboarding-primary"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              backgroundColor: 'var(--color-brand-primary)',
              border: 'none',
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-text-inverse)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer'
            }}
          >
            Start exploring
          </button>
        </div>

        <footer
          className="onboarding-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border-subtle)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)'
          }}
        >
          <BookOpenCheck size={18} strokeWidth={1.6} aria-hidden="true" style={{ color: 'var(--color-info)' }} />
          <span>
            Need more detail? The architecture and ops playbooks live under <code style={{ backgroundColor: 'var(--color-bg-elevated-2)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-family-mono)' }}>docs/</code>.
          </span>
        </footer>
      </div>
    </div>
  );
};
