import React from 'react';
import { BookOpenCheck, Layers, LifeBuoy, PlayCircle, Sparkles } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from './ui/Modal';
import { Button } from './ui/Button';

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

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  open,
  onClose,
  onDisable,
}) => {
  if (!open) {
    return null;
  }

  return (
    <Modal open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <ModalContent size="lg">
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-primary,#3b82f6)]/10 text-[var(--color-brand-primary)] shrink-0">
              <Sparkles size={24} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <ModalTitle className="text-xl font-bold text-[var(--color-text-primary)]">
                Welcome to SongNodes DJ
              </ModalTitle>
              <ModalDescription className="text-xs text-[var(--color-text-secondary)]">
                Quick orientation for navigating PLAN vs PLAY modes and keeping your graph healthy.
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Spotlight Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* PLAN vs PLAY */}
            <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 space-y-2 hover:border-[var(--color-brand-primary)]/50 transition-colors">
              <header className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-primary)]">
                <PlayCircle size={18} strokeWidth={1.8} aria-hidden="true" />
                <h3>PLAN vs PLAY</h3>
              </header>
              <ul className="space-y-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <li>
                  <strong className="text-[var(--color-text-primary)]">PLAN mode</strong> exposes filters, path builder, and library tools.
                </li>
                <li>
                  <strong className="text-[var(--color-text-primary)]">PLAY mode</strong> keeps decisions lightweight with the Now Playing deck.
                </li>
                <li>Toggle any time without losing setlist context.</li>
              </ul>
            </section>

            {/* Graph & Tools */}
            <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 space-y-2 hover:border-[var(--color-brand-primary)]/50 transition-colors">
              <header className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-primary)]">
                <Layers size={18} strokeWidth={1.8} aria-hidden="true" />
                <h3>Graph & Setlist</h3>
              </header>
              <ul className="space-y-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <li>Audition transitions in 3D graph view.</li>
                <li>Filter by keys, energy levels, or communities.</li>
                <li>Path Builder calculates harmonically safe routes.</li>
              </ul>
            </section>

            {/* Ops & System Health */}
            <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 space-y-2 hover:border-[var(--color-brand-primary)]/50 transition-colors">
              <header className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-primary)]">
                <LifeBuoy size={18} strokeWidth={1.8} aria-hidden="true" />
                <h3>Graph Health</h3>
              </header>
              <ul className="space-y-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <li>Verify docker services: <code>rest-api</code> & <code>postgres</code>.</li>
                <li>Queue material via Target Tracks manager.</li>
                <li>Run <code>./scripts/health_check.sh</code> if needed.</li>
              </ul>
            </section>
          </div>

          {/* Stepper / Keyboard Shortcuts Indicator */}
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Pro DJ Shortcuts
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {keyboardShortcuts.map(({ combo, description }) => (
                <div
                  key={combo}
                  className="flex items-center justify-between gap-2 rounded bg-[var(--color-bg-tertiary)] px-2.5 py-1.5 text-xs"
                >
                  <kbd className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--color-brand-primary)]">
                    {combo}
                  </kbd>
                  <span className="text-[var(--color-text-secondary)] text-right truncate">
                    {description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="flex-row items-center justify-between sm:justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <BookOpenCheck size={16} strokeWidth={1.6} aria-hidden="true" />
            <span className="hidden sm:inline">Docs available under <code>docs/</code></span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDisable}>
              Don't show again
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Start exploring
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
