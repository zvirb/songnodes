import type { KeyboardEvent } from 'react';

/** The parts of a keydown event the hook reads; a React KeyboardEvent satisfies it. */
export type TableNavKeyEvent = Pick<KeyboardEvent<HTMLElement>, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target' | 'preventDefault'>;

interface UseTableKeyboardNavProps {
  rowIds: string[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onOpen: (id: string) => void;
  shortcuts: Record<string, (id: string) => void>;
  describe: (id: string) => string;
}

export function useTableKeyboardNav({
  rowIds,
  activeId,
  onActiveChange,
  onOpen,
  shortcuts,
  describe
}: UseTableKeyboardNavProps) {
  const currentIndex = activeId ? rowIds.indexOf(activeId) : -1;

  const handleKeyDown = (e: TableNavKeyEvent) => {
    // Ignore if Ctrl/Meta/Alt are held
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // Ignore if focus is in an input, select, contenteditable, or dialog
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const tagName = target.tagName.toLowerCase();

    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable ||
      target.closest('dialog') ||
      target.closest('[role="dialog"]')
    ) {
      return;
    }

    const key = e.key;
    const isDown = key === 'j' || key === 'J' || key === 'ArrowDown';
    const isUp = key === 'k' || key === 'K' || key === 'ArrowUp';
    const isEnter = key === 'Enter';

    // Normalize single letter shortcuts for matching
    const shortcutKey = key === ' ' ? ' ' : key.toLowerCase();

    if (isDown) {
      e.preventDefault();
      if (rowIds.length === 0) return;
      const nextIndex = currentIndex < rowIds.length - 1 ? currentIndex + 1 : currentIndex;
      if (nextIndex === -1) {
        onActiveChange(rowIds[0]);
      } else {
        onActiveChange(rowIds[nextIndex]);
      }
    } else if (isUp) {
      e.preventDefault();
      if (rowIds.length === 0) return;
      if (currentIndex > 0) {
        onActiveChange(rowIds[currentIndex - 1]);
      }
    } else if (isEnter && activeId) {
      e.preventDefault();
      onOpen(activeId);
    } else if (activeId && shortcuts[shortcutKey]) {
      e.preventDefault();
      shortcuts[shortcutKey](activeId);
    }
  };

  const announcement =
    activeId && currentIndex !== -1
      ? `${currentIndex + 1} of ${rowIds.length}: ${describe(activeId)}`
      : '';

  return {
    boxProps: {
      tabIndex: 0,
      'data-keyboard': '',
      'aria-keyshortcuts': 'J K Enter Space T X',
      onKeyDown: handleKeyDown
    },
    announcement
  };
}
