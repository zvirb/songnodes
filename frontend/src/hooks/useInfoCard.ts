import { useState, useCallback } from 'react';
import { GraphNode, Track, PerformanceMetrics, Setlist } from '../types';

type InfoCardType = 'track' | 'node' | 'performance' | 'stats' | 'setlist';
type InfoCardData = Track | GraphNode | PerformanceMetrics | Setlist | Record<string, any> | undefined;

interface InfoCardState {
  type: InfoCardType;
  data?: InfoCardData;
  position?: { x: number; y: number };
  anchorElement?: HTMLElement;
}

interface InfoCardOptions {
  position?: { x: number; y: number };
  anchorElement?: HTMLElement;
}

/**
 * A custom hook to manage the state of the global InfoCard component.
 * It provides functions to show and hide the card with specific data and positioning.
 *
 * @returns An object containing the current infoCard state and functions to control it.
 */
export const useInfoCard = () => {
  const [infoCard, setInfoCard] = useState<InfoCardState | null>(null);

  const showInfoCard = useCallback((
    type: InfoCardType,
    data?: InfoCardData,
    options?: InfoCardOptions
  ) => {
    setInfoCard({
      type,
      data,
      position: options?.position,
      anchorElement: options?.anchorElement,
    });
  }, []);

  const hideInfoCard = useCallback(() => {
    setInfoCard(null);
  }, []);

  return {
    infoCard,
    showInfoCard,
    hideInfoCard,
  };
};