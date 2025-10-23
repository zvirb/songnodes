/**
 * useAutoSave Hook
 * Implements debounced auto-save with visual feedback
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Setlist, AutoSaveStatus } from './types';

const AUTOSAVE_DELAY = 2000; // 2 seconds

export const useAutoSave = (
  setlist: Setlist | null,
  saveFunction: (setlist: Setlist) => Promise<void>
) => {
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>({
    status: 'idle',
    lastSaved: null,
    error: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedDataRef = useRef<string>('');

  const save = useCallback(async (data: Setlist) => {
    // Don't save if data hasn't changed
    const currentData = JSON.stringify(data);
    if (currentData === lastSavedDataRef.current) {
      return;
    }

    setSaveStatus(prev => ({ ...prev, status: 'saving', error: null }));

    try {
      await saveFunction(data);
      lastSavedDataRef.current = currentData;
      setSaveStatus({
        status: 'saved',
        lastSaved: new Date(),
        error: null,
      });

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, status: 'idle' }));
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save';
      setSaveStatus({
        status: 'error',
        lastSaved: null,
        error: errorMessage,
      });
    }
  }, [saveFunction]);

  // Debounced auto-save
  useEffect(() => {
    if (!setlist || setlist.tracks.length === 0) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      save(setlist);
    }, AUTOSAVE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [setlist, save]);

  const forceSave = useCallback(() => {
    if (setlist) {
      save(setlist);
    }
  }, [setlist, save]);

  return {
    saveStatus,
    forceSave,
  };
};
