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
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Add at least 2 tracks to see analytics
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <Music size={16} />
            <span className="text-sm font-medium">Tracks</span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {analytics.trackCount}
          </div>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
            <Clock size={16} />
            <span className="text-sm font-medium">Duration</span>
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {formatDuration(analytics.totalDuration)}
          </div>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <TrendingUp size={16} />
            <span className="text-sm font-medium">Avg BPM</span>
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {analytics.avgBpm}
          </div>
        </div>

        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
            <Zap size={16} />
            <span className="text-sm font-medium">Key Changes</span>
          </div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            {analytics.keyChanges}
          </div>
        </div>
      </div>

      {/* Flow Chart */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          BPM & Energy Flow
        </h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              yAxisId="bpm"
              orientation="left"
              tick={{ fontSize: 12 }}
              stroke="#3b82f6"
              label={{ value: 'BPM', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="energy"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="#f59e0b"
              label={{ value: 'Energy %', angle: 90, position: 'insideRight' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend />
            <Line
              yAxisId="bpm"
              type="monotone"
              dataKey="bpm"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="BPM"
            />
            <Line
              yAxisId="energy"
              type="monotone"
              dataKey="energy"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 4 }}
              activeDot={{ r: 6 }}
              name="Energy %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
