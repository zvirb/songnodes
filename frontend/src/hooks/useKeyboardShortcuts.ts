import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export const useKeyboardShortcuts = () => {
  const setActivePanel = useStore(state => state.setActivePanel);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const clearHighlights = useStore(state => state.clearHighlights);
  const resetFilters = useStore(state => state.resetFilters);
  const clearSetlist = useStore(state => state.clearSetlist);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Panel shortcuts
      if (e.altKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActivePanel('graph');
            break;
          case '2':
            e.preventDefault();
            setActivePanel('setlist');
            break;
          case '3':
            e.preventDefault();
            setActivePanel('path');
            break;
          case '4':
            e.preventDefault();
            setActivePanel('search');
            break;
          case '5':
            e.preventDefault();
            setActivePanel('filters');
            break;
          case 'b':
            e.preventDefault();
            toggleSidebar();
            break;
        }
      }

      // Other shortcuts
      switch (e.key) {
        case 'Escape':
          clearHighlights();
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetFilters();
          }
          break;
        case 'Delete':
          if (e.shiftKey) {
            clearSetlist();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePanel, toggleSidebar, clearHighlights, resetFilters, clearSetlist]);
};