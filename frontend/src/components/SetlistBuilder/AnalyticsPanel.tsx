/**
 * AnalyticsPanel Component
 * Visualizes setlist flow metrics using Recharts
 */

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Music, Clock, Zap } from 'lucide-react';
import type { Setlist, SetlistAnalytics } from './types';
import { formatDuration } from './utils';

interface AnalyticsPanelProps {
  setlist: Setlist;
}

const calculateAnalytics = (setlist: Setlist): SetlistAnalytics => {
  const { tracks } = setlist;

  const totalDuration = tracks.reduce((sum, t) => sum + (t.track.duration || 0), 0);
  const bpms = tracks.map(t => t.track.bpm).filter(Boolean) as number[];
  const energies = tracks.map(t => t.track.energy).filter(e => e !== undefined) as number[];

  return {
    totalDuration,
    trackCount: tracks.length,
    avgBpm: bpms.length ? Math.round(bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length) : 0,
    minBpm: bpms.length ? Math.min(...bpms) : 0,
    maxBpm: bpms.length ? Math.max(...bpms) : 0,
    bpmProgression: bpms,
    energyFlow: energies,
    keyChanges: tracks.slice(1).filter((t, i) => t.track.key !== tracks[i].track.key).length,
    harmonicCompatibility: 0, // Calculated separately
  };
};

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ setlist }) => {
  const analytics = useMemo(() => calculateAnalytics(setlist), [setlist]);

  const chartData = useMemo(() => {
    return setlist.tracks.map((t, index) => ({
      index: index + 1,
      name: t.track.name.slice(0, 15) + '...',
      bpm: t.track.bpm || 0,
      energy: (t.track.energy || 0) * 100,
    }));
  }, [setlist.tracks]);

  if (setlist.tracks.length < 2) {
    return (
      <div className="p-4 text-center text-text-tertiary">
        Add at least 2 tracks to see analytics
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-info-bg border border-info-border rounded-card shadow-card">
          <div className="flex items-center gap-2 text-info mb-1">
            <Music size={16} />
            <span className="text-sm font-medium">Tracks</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {analytics.trackCount}
          </div>
        </div>

        <div className="p-4 bg-brand-secondary-muted border border-border-subtle rounded-card shadow-card">
          <div className="flex items-center gap-2 text-brand-secondary mb-1">
            <Clock size={16} />
            <span className="text-sm font-medium">Duration</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {formatDuration(analytics.totalDuration)}
          </div>
        </div>

        <div className="p-4 bg-success-bg border border-success-border rounded-card shadow-card">
          <div className="flex items-center gap-2 text-success mb-1">
            <TrendingUp size={16} />
            <span className="text-sm font-medium">Avg BPM</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {analytics.avgBpm}
          </div>
        </div>

        <div className="p-4 bg-warning-bg border border-warning-border rounded-card shadow-card">
          <div className="flex items-center gap-2 text-warning mb-1">
            <Zap size={16} />
            <span className="text-sm font-medium">Key Changes</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {analytics.keyChanges}
          </div>
        </div>
      </div>

      {/* Flow Chart */}
      <div className="p-4 bg-card-bg border border-card-border rounded-card shadow-card">
        <h4 className="text-sm font-semibold text-text-primary mb-4">
          BPM & Energy Flow
        </h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
              stroke="var(--color-text-tertiary)"
            />
            <YAxis
              yAxisId="bpm"
              orientation="left"
              tick={{ fontSize: 12, fill: 'var(--color-info)' }}
              stroke="var(--color-info)"
              label={{ value: 'BPM', angle: -90, position: 'insideLeft', fill: 'var(--color-info)' }}
            />
            <YAxis
              yAxisId="energy"
              orientation="right"
              tick={{ fontSize: 12, fill: 'var(--color-warning)' }}
              stroke="var(--color-warning)"
              label={{ value: 'Energy %', angle: 90, position: 'insideRight', fill: 'var(--color-warning)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-elevated-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
              }}
            />
            <Legend />
            <Line
              yAxisId="bpm"
              type="monotone"
              dataKey="bpm"
              stroke="var(--color-info)"
              strokeWidth={2}
              dot={{ fill: 'var(--color-info)', r: 4 }}
              activeDot={{ r: 6 }}
              name="BPM"
            />
            <Line
              yAxisId="energy"
              type="monotone"
              dataKey="energy"
              stroke="var(--color-warning)"
              strokeWidth={2}
              dot={{ fill: 'var(--color-warning)', r: 4 }}
              activeDot={{ r: 6 }}
              name="Energy %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
