/**
 * useSetlistState Hook
 * Implements undo/redo functionality using Immer for immutable updates
 */

import { useState, useCallback, useEffect } from 'react';
import { produce } from 'immer';
import type { Setlist, SetlistTrack, Track, SetlistState } from './types';

const MAX_HISTORY_SIZE = 50;

export const useSetlistState = (initialSetlist: Setlist | null = null) => {
  const [state, setState] = useState<SetlistState>({
    setlist: initialSetlist,
    undoStack: [],
    redoStack: [],
  });

  // Helper function to add to history
  const addToHistory = useCallback((newSetlist: Setlist | null) => {
    setState(prevState => {
      if (!prevState.setlist) return prevState;

      return {
        setlist: newSetlist,
        undoStack: [
          ...prevState.undoStack.slice(-(MAX_HISTORY_SIZE - 1)),
          prevState.setlist,
        ],
        redoStack: [], // Clear redo stack on new action
      };
    });
  }, []);

  // Set entire setlist
  const setSetlist = useCallback((setlist: Setlist) => {
    setState({
      setlist,
      undoStack: [],
      redoStack: [],
    });
  }, []);

  // Add track to setlist
  const addTrack = useCallback((track: Track, position?: number) => {
    const newSetlist = produce(state.setlist, draft => {
      if (!draft) return;

      const newTrack: SetlistTrack = {
        id: `${track.id}-${Date.now()}`,
        track,
        position: position ?? draft.tracks.length,
      };

      if (position !== undefined && position < draft.tracks.length) {
        draft.tracks.splice(position, 0, newTrack);
        // Update positions
        draft.tracks.forEach((t, idx) => {
          t.position = idx;
        });
      } else {
        draft.tracks.push(newTrack);
      }

      draft.updated_at = new Date();
    });

    if (newSetlist) {
      addToHistory(newSetlist);
    }
  }, [state.setlist, addToHistory]);

  // Remove track from setlist
  const removeTrack = useCallback((trackId: string) => {
    const newSetlist = produce(state.setlist, draft => {
      if (!draft) return;

      const index = draft.tracks.findIndex(t => t.id === trackId);
      if (index !== -1) {
        draft.tracks.splice(index, 1);
        // Update positions
        draft.tracks.forEach((t, idx) => {
          t.position = idx;
        });
        draft.updated_at = new Date();
      }
    });

    if (newSetlist) {
      addToHistory(newSetlist);
    }
  }, [state.setlist, addToHistory]);

  // Move track within setlist
  const moveTrack = useCallback((from: number, to: number) => {
    const newSetlist = produce(state.setlist, draft => {
      if (!draft) return;

      const [movedTrack] = draft.tracks.splice(from, 1);
      draft.tracks.splice(to, 0, movedTrack);

      // Update all positions
      draft.tracks.forEach((t, idx) => {
        t.position = idx;
      });

      draft.updated_at = new Date();
    });

    if (newSetlist) {
      addToHistory(newSetlist);
    }
  }, [state.setlist, addToHistory]);

  // Update track metadata
  const updateTrack = useCallback((trackId: string, updates: Partial<SetlistTrack>) => {
    const newSetlist = produce(state.setlist, draft => {
      if (!draft) return;

      const track = draft.tracks.find(t => t.id === trackId);
      if (track) {
        Object.assign(track, updates);
        draft.updated_at = new Date();
      }
    });

    if (newSetlist) {
      addToHistory(newSetlist);
    }
  }, [state.setlist, addToHistory]);

  // Undo last action
  const undo = useCallback(() => {
    setState(prevState => {
      if (prevState.undoStack.length === 0) return prevState;

      const previousSetlist = prevState.undoStack[prevState.undoStack.length - 1];
      const newUndoStack = prevState.undoStack.slice(0, -1);

      return {
        setlist: previousSetlist,
        undoStack: newUndoStack,
        redoStack: prevState.setlist
          ? [...prevState.redoStack, prevState.setlist]
          : prevState.redoStack,
      };
    });
  }, []);

  // Redo last undone action
  const redo = useCallback(() => {
    setState(prevState => {
      if (prevState.redoStack.length === 0) return prevState;

      const nextSetlist = prevState.redoStack[prevState.redoStack.length - 1];
      const newRedoStack = prevState.redoStack.slice(0, -1);

      return {
        setlist: nextSetlist,
        undoStack: prevState.setlist
          ? [...prevState.undoStack, prevState.setlist]
          : prevState.undoStack,
        redoStack: newRedoStack,
      };
    });
  }, []);

  // Clear setlist
  const clearSetlist = useCallback(() => {
    const emptySetlist: Setlist = {
      name: 'New Setlist',
      tracks: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    setSetlist(emptySetlist);
  }, [setSetlist]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (state.undoStack.length > 0) {
          undo();
        }
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        if (state.redoStack.length > 0) {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.undoStack.length, state.redoStack.length, undo, redo]);

  return {
    setlist: state.setlist,
    setSetlist,
    addTrack,
    removeTrack,
    moveTrack,
    updateTrack,
    undo,
    redo,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    clearSetlist,
  };
};
