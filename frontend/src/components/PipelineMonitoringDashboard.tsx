/**
 * Comprehensive Pipeline Monitoring Dashboard
 * Implements 2025 data pipeline observability best practices
 * Features: Run history, quality metrics, anomaly detection, source performance
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Types based on our API models
interface ScrapingRun {
  run_id: string;
  scraper_name: string;
  start_time: string;
  end_time?: string;
  status: string;
  tracks_searched?: number;
  playlists_found?: number;
  songs_added?: number;
  artists_added?: number;
  errors_count?: number;
  avg_quality_score?: number;
  quality_issues?: number;
  playlists_validated?: number;
  validation_failures?: number;
  sources_attempted?: number;
  sources_successful?: number;
  avg_response_time_ms?: number;
  critical_anomalies?: number;
  warning_anomalies?: number;
}

interface SourceExtraction {
  extraction_id: string;
  source_url: string;
  website_domain: string;
  scraper_used: string;
  http_status_code?: number;
  response_time_ms?: number;
  success: boolean;
  error_message?: string;
  extracted_elements?: Record<string, any>;
  retry_count: number;
  extraction_timestamp: string;
}

interface GraphValidation {
  validation_id: string;
  playlist_id: string;
  expected_nodes: number;
  actual_nodes: number;
  expected_edges: number;
  actual_edges: number;
  same_artist_exceptions: number;
  validation_passed: boolean;
  validation_message?: string;
  validation_timestamp: string;
}

interface QualityMetric {
  quality_id: string;
  pillar: string;
  metric_name: string;
  expected_value?: number;
  actual_value: number;
  quality_score: number;
  threshold_min?: number;
  threshold_max?: number;
  status: string;
  measured_at: string;
}

interface Anomaly {
  anomaly_id: string;
  anomaly_type: string;
  severity: string;
  metric_name: string;
  expected_range_min?: number;
  expected_range_max?: number;
  actual_value: number;
  confidence_score: number;
  description: string;
  suggested_actions: string[];
  detection_timestamp: string;
  acknowledged: boolean;
}

interface PipelineHealthData {
  time_bucket: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  avg_duration_seconds?: number;
  total_songs_added?: number;
  total_artists_added?: number;
  avg_quality_score?: number;
  total_critical_anomalies?: number;
}

interface MetricsSummary {
  summary: {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    runs_last_24h: number;
    avg_songs_per_run?: number;
    total_songs_scraped?: number;
    total_artists_scraped?: number;
  };
  quality_by_pillar: Array<{
    pillar: string;
    avg_score: number;
    failures: number;
  }>;
  recent_anomalies: Array<{
    severity: string;
    count: number;
  }>;
}

// API service
class ObservabilityAPI {
  private static readonly BASE_URL = process.env.VITE_API_URL || 'http://localhost:8082';

  static async getRuns(limit = 20, offset = 0, status?: string): Promise<ScrapingRun[]> {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (status) params.append('status', status);

    const response = await fetch(`${this.BASE_URL}/api/v1/observability/runs?${params}`);
    if (!response.ok) throw new Error('Failed to fetch runs');
    return response.json();
  }

  static async getRunDetail(runId: string): Promise<ScrapingRun> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/runs/${runId}`);
    if (!response.ok) throw new Error('Failed to fetch run detail');
    return response.json();
  }

  static async getRunSources(runId: string): Promise<SourceExtraction[]> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/runs/${runId}/sources`);
    if (!response.ok) throw new Error('Failed to fetch run sources');
    return response.json();
  }

  static async getRunValidations(runId: string): Promise<GraphValidation[]> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/runs/${runId}/validations`);
    if (!response.ok) throw new Error('Failed to fetch run validations');
    return response.json();
  }

  static async getRunQuality(runId: string): Promise<QualityMetric[]> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/runs/${runId}/quality`);
    if (!response.ok) throw new Error('Failed to fetch run quality');
    return response.json();
  }

  static async getRunAnomalies(runId: string): Promise<Anomaly[]> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/runs/${runId}/anomalies`);
    if (!response.ok) throw new Error('Failed to fetch run anomalies');
    return response.json();
  }

  static async getPipelineHealth(hours = 24): Promise<PipelineHealthData[]> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/health?hours=${hours}`);
    if (!response.ok) throw new Error('Failed to fetch pipeline health');
    return response.json();
  }

  static async getMetricsSummary(): Promise<MetricsSummary> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/metrics/summary`);
    if (!response.ok) throw new Error('Failed to fetch metrics summary');
    return response.json();
  }

  static async acknowledgeAnomaly(anomalyId: string, acknowledgedBy = 'user'): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/api/v1/observability/anomalies/${anomalyId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged_by: acknowledgedBy })
    });
    if (!response.ok) throw new Error('Failed to acknowledge anomaly');
  }
}

// Utility functions
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#10B981'; // green
    case 'failed': return '#EF4444'; // red
    case 'running': return '#F59E0B'; // amber
    default: return '#6B7280'; // gray
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return '#DC2626'; // red
    case 'warning': return '#D97706'; // orange
    case 'info': return '#2563EB'; // blue
    default: return '#6B7280'; // gray
  }
};

const formatDuration = (startTime: string, endTime?: string) => {
  if (!endTime) return 'Running...';
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  if (diffSeconds < 3600) return `${Math.round(diffSeconds / 60)}m`;
  return `${Math.round(diffSeconds / 3600)}h`;
};

// Main Dashboard Component
export const PipelineMonitoringDashboard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'runs' | 'quality' | 'anomalies' | 'sources'>('overview');
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // 30 seconds
  const [isLoading, setIsLoading] = useState(false);

  // Data state
  const [runs, setRuns] = useState<ScrapingRun[]>([]);
  const [healthData, setHealthData] = useState<PipelineHealthData[]>([]);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<{
    run: ScrapingRun;
    sources: SourceExtraction[];
    validations: GraphValidation[];
    quality: QualityMetric[];
    anomalies: Anomaly[];
  } | null>(null);

  // Load data functions
  const loadOverviewData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [runsData, healthDataResponse, summaryData] = await Promise.all([
        ObservabilityAPI.getRuns(20),
        ObservabilityAPI.getPipelineHealth(24),
        ObservabilityAPI.getMetricsSummary()
      ]);

      setRuns(runsData);
      setHealthData(healthDataResponse);
      setMetricsSummary(summaryData);
    } catch (error) {
      console.error('Failed to load overview data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRunDetail = useCallback(async (runId: string) => {
    setIsLoading(true);
    try {
      const [run, sources, validations, quality, anomalies] = await Promise.all([
        ObservabilityAPI.getRunDetail(runId),
        ObservabilityAPI.getRunSources(runId),
        ObservabilityAPI.getRunValidations(runId),
        ObservabilityAPI.getRunQuality(runId),
        ObservabilityAPI.getRunAnomalies(runId)
      ]);

      setSelectedRunDetail({ run, sources, validations, quality, anomalies });
    } catch (error) {
      console.error('Failed to load run detail:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    loadOverviewData();
    const interval = setInterval(loadOverviewData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadOverviewData, refreshInterval]);

  // Load run detail when selected
  useEffect(() => {
    if (selectedRun) {
      loadRunDetail(selectedRun);
    }
  }, [selectedRun, loadRunDetail]);

  // Chart data preparation
  const healthChartData = useMemo(() => {
    return healthData.map(d => ({
      time: format(new Date(d.time_bucket), 'HH:mm'),
      success_rate: d.total_runs > 0 ? (d.successful_runs / d.total_runs) * 100 : 0,
      total_runs: d.total_runs,
      songs_added: d.total_songs_added || 0,
      quality_score: d.avg_quality_score ? d.avg_quality_score * 100 : 0
    }));
  }, [healthData]);

  const qualityPieData = useMemo(() => {
    if (!metricsSummary) return [];
    return metricsSummary.quality_by_pillar.map(p => ({
      name: p.pillar,
      value: p.avg_score * 100,
      fill: p.avg_score > 0.8 ? '#10B981' : p.avg_score > 0.6 ? '#F59E0B' : '#EF4444'
    }));
  }, [metricsSummary]);

  // Render functions
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Runs</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metricsSummary?.summary.total_runs || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Success Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metricsSummary?.summary.total_runs
                  ? Math.round((metricsSummary.summary.successful_runs / metricsSummary.summary.total_runs) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Songs Scraped</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metricsSummary?.summary.total_songs_scraped?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Anomalies</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metricsSummary?.recent_anomalies.reduce((sum, a) => sum + a.count, 0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Health Chart */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pipeline Health (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={healthChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="success_rate" stroke="#10B981" name="Success Rate %" />
              <Line type="monotone" dataKey="quality_score" stroke="#3B82F6" name="Quality Score %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Quality Pillars */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Data Quality by Pillar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={qualityPieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={(({ name, value }: any) => `${name}: ${value.toFixed(1)}%`) as any}
              >
                {qualityPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Scraping Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Run ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scraper
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Songs Added
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anomalies
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runs.slice(0, 10).map((run) => (
                <tr
                  key={run.run_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedRun(run.run_id);
                    setSelectedTab('runs');
                  }}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {run.run_id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {run.scraper_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                      style={{
                        backgroundColor: getStatusColor(run.status) + '20',
                        color: getStatusColor(run.status)
                      }}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(run.start_time, run.end_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {run.songs_added || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {run.avg_quality_score ? (run.avg_quality_score * 100).toFixed(1) + '%' : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex space-x-1">
                      {(run.critical_anomalies || 0) > 0 && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          {run.critical_anomalies} critical
                        </span>
                      )}
                      {(run.warning_anomalies || 0) > 0 && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          {run.warning_anomalies} warnings
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(new Date(run.start_time), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRunsTab = () => (
    <div className="space-y-6">
      {selectedRunDetail && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Run Detail: {selectedRunDetail.run.run_id}
            </h3>
            <button
              onClick={() => setSelectedRun(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Run Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Run Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Scraper:</span> {selectedRunDetail.run.scraper_name}</div>
                <div><span className="font-medium">Status:</span> {selectedRunDetail.run.status}</div>
                <div><span className="font-medium">Duration:</span> {formatDuration(selectedRunDetail.run.start_time, selectedRunDetail.run.end_time)}</div>
                <div><span className="font-medium">Songs Added:</span> {selectedRunDetail.run.songs_added || 0}</div>
                <div><span className="font-medium">Artists Added:</span> {selectedRunDetail.run.artists_added || 0}</div>
                <div><span className="font-medium">Playlists Found:</span> {selectedRunDetail.run.playlists_found || 0}</div>
              </div>
            </div>

            {/* Source Extractions */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Source Extractions ({selectedRunDetail.sources.length})</h4>
              <div className="space-y-2">
                {selectedRunDetail.sources.slice(0, 5).map(source => (
                  <div key={source.extraction_id} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-40">{source.website_domain}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${source.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-gray-500">{source.response_time_ms}ms</span>
                    </div>
                  </div>
                ))}
                {selectedRunDetail.sources.length > 5 && (
                  <div className="text-xs text-gray-500">
                    +{selectedRunDetail.sources.length - 5} more sources
                  </div>
                )}
              </div>
            </div>

            {/* Quality Metrics */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Quality Metrics ({selectedRunDetail.quality.length})</h4>
              <div className="space-y-2">
                {selectedRunDetail.quality.map(metric => (
                  <div key={metric.quality_id} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-32">{metric.metric_name}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        metric.status === 'pass' ? 'bg-green-100 text-green-800' :
                        metric.status === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {metric.status}
                      </span>
                      <span className="text-gray-500">{(metric.quality_score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anomalies */}
          {selectedRunDetail.anomalies.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-medium text-gray-900">Anomalies Detected ({selectedRunDetail.anomalies.length})</h4>
              <div className="space-y-3">
                {selectedRunDetail.anomalies.map(anomaly => (
                  <div key={anomaly.anomaly_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span
                            className="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                            style={{
                              backgroundColor: getSeverityColor(anomaly.severity) + '20',
                              color: getSeverityColor(anomaly.severity)
                            }}
                          >
                            {anomaly.severity}
                          </span>
                          <span className="font-medium text-gray-900">{anomaly.anomaly_type}</span>
                          <span className="text-sm text-gray-500">
                            Confidence: {(anomaly.confidence_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{anomaly.description}</p>
                        {anomaly.suggested_actions.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">Suggested Actions:</span>
                            <ul className="mt-1 list-disc list-inside text-gray-600">
                              {anomaly.suggested_actions.map((action, idx) => (
                                <li key={idx}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {!anomaly.acknowledged && (
                        <button
                          onClick={() => ObservabilityAPI.acknowledgeAnomaly(anomaly.anomaly_id)}
                          className="ml-4 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graph Validations */}
          {selectedRunDetail.validations.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-medium text-gray-900">Graph Validations ({selectedRunDetail.validations.length})</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Playlist</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nodes</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Edges</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Same Artist</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedRunDetail.validations.map(validation => (
                      <tr key={validation.validation_id}>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {validation.playlist_id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {validation.actual_nodes}/{validation.expected_nodes}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {validation.actual_edges}/{validation.expected_edges}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {validation.same_artist_exceptions}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            validation.validation_passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {validation.validation_passed ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {validation.validation_message || 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Runs List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">All Scraping Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Run ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scraper
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Added
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runs.map((run) => (
                <tr
                  key={run.run_id}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedRun === run.run_id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedRun(run.run_id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {run.run_id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {run.scraper_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                      style={{
                        backgroundColor: getStatusColor(run.status) + '20',
                        color: getStatusColor(run.status)
                      }}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(run.start_time, run.end_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {run.sources_successful || 0}/{run.sources_attempted || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-xs">
                      <div>{run.songs_added || 0} songs</div>
                      <div className="text-gray-500">{run.artists_added || 0} artists</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {run.avg_quality_score ? (
                      <span className={`px-2 py-1 text-xs rounded ${
                        run.avg_quality_score > 0.8 ? 'bg-green-100 text-green-800' :
                        run.avg_quality_score > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(run.avg_quality_score * 100).toFixed(1)}%
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col space-y-1">
                      {(run.errors_count || 0) > 0 && (
                        <span className="text-xs text-red-600">{run.errors_count} errors</span>
                      )}
                      {(run.validation_failures || 0) > 0 && (
                        <span className="text-xs text-orange-600">{run.validation_failures} validations</span>
                      )}
                      {(run.critical_anomalies || 0) > 0 && (
                        <span className="text-xs text-red-600">{run.critical_anomalies} critical</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(run.start_time), 'MMM dd, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pipeline Monitoring Dashboard</h1>
              <p className="mt-1 text-gray-600">
                Comprehensive observability for the SongNodes data pipeline
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value={10000}>Refresh every 10s</option>
                <option value={30000}>Refresh every 30s</option>
                <option value={60000}>Refresh every 1m</option>
                <option value={300000}>Refresh every 5m</option>
              </select>
              <button
                onClick={loadOverviewData}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'runs', label: 'Runs', icon: '🔄' },
              { key: 'quality', label: 'Quality', icon: '✅' },
              { key: 'anomalies', label: 'Anomalies', icon: '⚠️' },
              { key: 'sources', label: 'Sources', icon: '🌐' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-96">
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'runs' && renderRunsTab()}
          {selectedTab === 'quality' && (
            <div className="text-center py-12 text-gray-500">
              Quality metrics view coming soon...
            </div>
          )}
          {selectedTab === 'anomalies' && (
            <div className="text-center py-12 text-gray-500">
              Anomaly analysis view coming soon...
            </div>
          )}
          {selectedTab === 'sources' && (
            <div className="text-center py-12 text-gray-500">
              Source performance view coming soon...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};