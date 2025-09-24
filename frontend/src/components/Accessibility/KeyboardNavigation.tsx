
import React, { useEffect } from 'react';
import { useAppDispatch } from '../../store/index';
import { openPanel, togglePerformanceOverlay } from '../../store/uiSlice';

const KeyboardNavigation: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            dispatch(openPanel('search'));
            break;
          case 'g':
            e.preventDefault();
            dispatch(openPanel('controls'));
            break;
          case 'i':
            e.preventDefault();
            dispatch(openPanel('trackInfo'));
            break;
          case 'h':
            e.preventDefault();
            dispatch(togglePerformanceOverlay());
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return null;
};

export default KeyboardNavigation;
