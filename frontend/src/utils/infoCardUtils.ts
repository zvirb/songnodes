/**
 * @file InfoCard Utilities
 * @description Contains helper functions for the InfoCard component, primarily for transforming data into displayable fields.
 */

import React from 'react';
import { GraphNode, Track, PerformanceMetrics, Setlist } from '../types';
import { Music, User, Clock, Zap, Hash, Calendar, TrendingUp, Volume2, Activity } from 'lucide-react';

export interface InfoField {
  key: string;
  label: string;
  value: any;
  icon?: React.ReactNode;
  formatter?: (value: any) => string;
  copyable?: boolean;
}

type InfoCardType = 'track' | 'node' | 'performance' | 'stats' | 'setlist';
type InfoCardData = Track | GraphNode | PerformanceMetrics | Setlist | Record<string, any>;

/**
 * Transforms raw data into a structured array of fields for display in the InfoCard.
 * @param {InfoCardType} type - The type of data being displayed.
 * @param {InfoCardData} data - The data object.
 * @returns {InfoField[]} An array of structured fields for rendering.
 */
export const getInfoFields = (type: InfoCardType, data: InfoCardData | null | undefined): InfoField[] => {
  if (!data) return [];

  switch (type) {
    case 'track':
    case 'node':
      const track = data as Track | GraphNode;
      return [
        { key: 'name', label: 'Track', value: 'name' in track ? track.name : track.label, icon: <Music size={16} />, copyable: true },
        { key: 'artist', label: 'Artist', value: track.artist, icon: <User size={16} />, copyable: true },
        { key: 'album', label: 'Album', value: 'album' in track ? track.album : undefined, icon: <Volume2 size={16} />, copyable: true },
        { key: 'bpm', label: 'BPM', value: track.bpm, icon: <Activity size={16} />, formatter: (v) => v ? `${Math.round(v)}` : 'N/A' },
        { key: 'key', label: 'Key', value: track.key, icon: <Hash size={16} /> },
        { key: 'energy', label: 'Energy', value: track.energy, icon: <Zap size={16} />, formatter: (v) => v ? `${Math.round(v * 10)}/10` : 'N/A' },
        { key: 'year', label: 'Year', value: track.year, icon: <Calendar size={16} /> },
        { key: 'duration', label: 'Duration', value: 'duration' in track ? track.duration : undefined, icon: <Clock size={16} />, formatter: (v) => v ? `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}` : 'N/A' },
      ].filter(field => field.value !== undefined && field.value !== null);

    case 'performance':
      const perf = data as PerformanceMetrics;
      return [
        { key: 'fps', label: 'FPS', value: perf.frameRate || perf.fps, formatter: (v) => `${Math.round(v)}` },
        { key: 'renderTime', label: 'Render Time', value: perf.renderTime, formatter: (v) => `${v.toFixed(2)}ms` },
        { key: 'visibleNodes', label: 'Visible Nodes', value: perf.visibleNodes },
        { key: 'memoryUsage', label: 'Memory', value: perf.memoryUsage, formatter: (v) => `${(v / 1024 / 1024).toFixed(1)}MB` },
      ];

    case 'stats':
      return [
        { key: 'totalNodes', label: 'Total Tracks', value: data.totalNodes },
        { key: 'totalEdges', label: 'Connections', value: data.totalEdges },
        { key: 'selectedNodes', label: 'Selected', value: data.selectedNodes },
        { key: 'setlistTracks', label: 'Setlist', value: data.setlistTracks },
      ];

    case 'setlist':
      const setlist = data as Setlist;
      return [
        { key: 'name', label: 'Setlist', value: setlist?.name, copyable: true },
        { key: 'tracks', label: 'Tracks', value: setlist?.tracks?.length || 0 },
        { key: 'duration', label: 'Duration', value: setlist?.duration, formatter: (v) => v ? `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}` : 'N/A' },
        { key: 'created', label: 'Created', value: setlist?.created_at, formatter: (v) => v ? new Date(v).toLocaleDateString() : 'N/A' },
      ].filter(field => field.value !== undefined);

    default:
      return [];
  }
};