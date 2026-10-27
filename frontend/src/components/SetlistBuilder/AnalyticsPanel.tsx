/**
 * AnalyticsPanel Component
 * Visualizes setlist flow metrics using Recharts and Design System tokens
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Music, Clock, Zap, KeyRound } from 'lucide-react';
import type { Setlist, SetlistAnalytics } from './types';
import { formatDuration, getKeyToken, normalizeCamelotKey } from './utils';

interface AnalyticsPanelProps {
  setlist: Setlist;
}

const calculateAnalytics = (setlist: Setlist): SetlistAnalytics => {
  const { tracks } = setlist;

  const totalDuration = tracks.reduce((sum, t) => sum + (t.track.duration || 0), 0);
  const bpms = tracks.map((t) => t.track.bpm).filter(Boolean) as number[];
  const energies = tracks
    .map((t) => t.track.energy)
    .filter((e) => e !== undefined && e !== null) as number[];

  return {
    totalDuration,
    trackCount: tracks.length,
    avgBpm: bpms.length ? Math.round(bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length) : 0,
    minBpm: bpms.length ? Math.min(...bpms) : 0,
    maxBpm: bpms.length ? Math.max(...bpms) : 0,
    bpmProgression: bpms,
    energyFlow: energies,
    keyChanges: tracks.slice(1).filter((t, i) => t.track.key !== tracks[i].track.key).length,
    harmonicCompatibility: 0,
  };
};

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ setlist }) => {
  const analytics = useMemo(() => calculateAnalytics(setlist), [setlist]);

  const chartData = useMemo(() => {
    return setlist.tracks.map((t, index) => {
      const e = t.track.energy;
      const energy10 = e != null ? (e > 1 ? e : Math.round(e * 10)) : 0;
      return {
        index: index + 1,
        name: t.track.name.length > 15 ? t.track.name.slice(0, 15) + '…' : t.track.name,
        bpm: t.track.bpm || 0,
        energy: energy10,
        key: normalizeCamelotKey(t.track.key) || t.track.key || '–',
      };
    });
  }, [setlist.tracks]);

  // Key Distribution
  const keyDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    setlist.tracks.forEach((st) => {
      const k = normalizeCamelotKey(st.track.key);
      if (k) {
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [setlist.tracks]);

  if (setlist.tracks.length < 2) {
    return (
      <div
        className="p-[var(--space-6)] text-center text-[var(--fg-3)] font-[family-name:var(--font-body)] text-[0.9375rem] rounded-[var(--radius-card)]"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--line)',
        }}
      >
        Add at least 2 tracks to view setlist analytics and flow charts.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {/* Figure Tiles / Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--space-4)]">
        {/* Track Count */}
        <div
          className="p-[var(--space-4)] rounded-[var(--radius-card)] flex flex-col justify-between gap-[var(--space-2)]"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
          }}
        >
          <div className="flex items-center justify-between text-[var(--fg-3)]">
            <span className="font-[family-name:var(--font-body)] text-[0.75rem] font-semibold tracking-wider uppercase">
              Tracks
            </span>
            <Music size={16} className="text-[var(--mod-sets)]" />
          </div>
          <div className="font-[family-name:var(--font-display)] text-[2rem] font-bold text-[var(--fg)] leading-none">
            {analytics.trackCount}
          </div>
        </div>

        {/* Total Duration */}
        <div
          className="p-[var(--space-4)] rounded-[var(--radius-card)] flex flex-col justify-between gap-[var(--space-2)]"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
          }}
        >
          <div className="flex items-center justify-between text-[var(--fg-3)]">
            <span className="font-[family-name:var(--font-body)] text-[0.75rem] font-semibold tracking-wider uppercase">
              Duration
            </span>
            <Clock size={16} className="text-[var(--brand)]" />
          </div>
          <div className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-[var(--fg)] leading-none truncate">
            {formatDuration(analytics.totalDuration)}
          </div>
        </div>

        {/* Average BPM */}
        <div
          className="p-[var(--space-4)] rounded-[var(--radius-card)] flex flex-col justify-between gap-[var(--space-2)]"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
          }}
        >
          <div className="flex items-center justify-between text-[var(--fg-3)]">
            <span className="font-[family-name:var(--font-body)] text-[0.75rem] font-semibold tracking-wider uppercase">
              Avg BPM
            </span>
            <TrendingUp size={16} className="text-[var(--chart-1)]" />
          </div>
          <div className="font-[family-name:var(--font-display)] text-[2rem] font-bold text-[var(--fg)] leading-none">
            {analytics.avgBpm || '--'}
          </div>
        </div>

        {/* Key Changes */}
        <div
          className="p-[var(--space-4)] rounded-[var(--radius-card)] flex flex-col justify-between gap-[var(--space-2)]"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
          }}
        >
          <div className="flex items-center justify-between text-[var(--fg-3)]">
            <span className="font-[family-name:var(--font-body)] text-[0.75rem] font-semibold tracking-wider uppercase">
              Key Changes
            </span>
            <Zap size={16} className="text-[var(--status-warn)]" />
          </div>
          <div className="font-[family-name:var(--font-display)] text-[2rem] font-bold text-[var(--fg)] leading-none">
            {analytics.keyChanges}
          </div>
        </div>
      </div>

      {/* BPM & Energy Flow Chart Frame */}
      <div
        className="p-[var(--space-5)] rounded-[var(--radius-card)] flex flex-col gap-[var(--space-4)]"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--line)',
        }}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-[family-name:var(--font-display)] text-[1.125rem] font-bold text-[var(--fg)]">
            Setlist BPM & Energy Flow
          </h4>
          <span className="font-[family-name:var(--font-body)] text-[0.75rem] text-[var(--fg-3)]">
            {setlist.tracks.length} tracks plotted
          </span>
        </div>

        <div className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
                stroke="var(--line)"
              />
              <YAxis
                yAxisId="bpm"
                orientation="left"
                tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
                stroke="var(--chart-1)"
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="energy"
                orientation="right"
                tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
                stroke="var(--chart-2)"
                domain={[0, 10]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--fg)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  boxShadow: 'var(--shadow-2)',
                }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: 'var(--space-3)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: 'var(--fg-2)',
                }}
              />
              <Line
                yAxisId="bpm"
                type="monotone"
                dataKey="bpm"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ fill: 'var(--chart-1)', r: 4 }}
                activeDot={{ r: 6 }}
                name="BPM"
              />
              <Line
                yAxisId="energy"
                type="monotone"
                dataKey="energy"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ fill: 'var(--chart-2)', r: 4 }}
                activeDot={{ r: 6 }}
                name="Energy (1–10)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Distribution Frame */}
      {keyDistribution.length > 0 && (
        <div
          className="p-[var(--space-5)] rounded-[var(--radius-card)] flex flex-col gap-[var(--space-3)]"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
          }}
        >
          <div className="flex items-center gap-[var(--space-2)]">
            <KeyRound size={18} className="text-[var(--mod-harmony)]" />
            <h4 className="font-[family-name:var(--font-display)] text-[1.125rem] font-bold text-[var(--fg)]">
              Camelot Key Distribution
            </h4>
          </div>

          <div className="flex flex-wrap gap-[var(--space-2)] pt-[var(--space-1)]">
            {keyDistribution.map(([key, count]) => (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-control)] font-[family-name:var(--font-data)] text-[0.8125rem]"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--fg)',
                }}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getKeyToken(key) }}
                  aria-hidden="true"
                />
                <span className="font-semibold">{key}</span>
                <span className="text-[var(--fg-3)]">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// design-system exception: #000000
