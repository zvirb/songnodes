/**
 * Performance Dashboard Component
 * Real-time monitoring and control of all performance optimizations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '@store/index';
import { 
  globalPerformanceMonitor, 
  generatePerformanceReport,
  PerformanceReport,
  PerformanceAlert 
} from '@utils/performanceMonitor';
import { globalMemoryManager } from '@utils/memoryManagement';
import { 
  globalRegressionTester,
  defaultRegressionConfigs,
  RegressionResult 
} from '@utils/performanceRegression';
import { 
  PerformanceBenchmarkFramework,
  BenchmarkConfig 
} from '@utils/performanceBenchmark';

interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  compact?: boolean;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isOpen,
  onClose,
  compact = false
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'benchmark' | 'regression' | 'memory'>('overview');
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<PerformanceAlert[]>([]);
  const [regressionResults, setRegressionResults] = useState<RegressionResult[]>([]);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [autoOptimize, setAutoOptimize] = useState(true);

  // Redux state
  const performanceMetrics = useAppSelector(state => state.performance);
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Update performance data
  useEffect(() => {
    if (!isOpen) return;

    const updateInterval = setInterval(() => {
      // Use requestIdleCallback to prevent blocking main thread
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          try {
            const report = generatePerformanceReport();
            setPerformanceReport(report);
            setActiveAlerts(report.alerts.filter(alert => !alert.resolved));
          } catch (error) {
            console.warn('Failed to generate performance report:', error);
          }
        }, { timeout: 500 }); // Allow up to 500ms delay for performance updates
      } else {
        // Fallback: use setTimeout to yield control
        setTimeout(() => {
          try {
            const report = generatePerformanceReport();
            setPerformanceReport(report);
            setActiveAlerts(report.alerts.filter(alert => !alert.resolved));
          } catch (error) {
            console.warn('Failed to generate performance report:', error);
          }
        }, 0);
      }
    }, 3000); // Reduced frequency to 3 seconds

    return () => clearInterval(updateInterval);
  }, [isOpen]);

  // Auto-optimization
  useEffect(() => {
    if (!autoOptimize || !performanceReport) return;

    const criticalAlerts = activeAlerts.filter(alert => alert.type === 'critical');
    if (criticalAlerts.length > 0) {
      // Trigger automatic optimizations
      globalMemoryManager.optimize();
      globalMemoryManager.forceGC();
      
      console.log('Auto-optimization triggered due to critical alerts');
    }
  }, [autoOptimize, activeAlerts, performanceReport]);

  // Event handlers
  const handleRunBenchmark = useCallback(async () => {
    setBenchmarkRunning(true);
    
    try {
      const framework = new PerformanceBenchmarkFramework();
      const config: BenchmarkConfig = {
        name: 'Real-time Benchmark',
        nodeCount: nodes.length,
        edgeCount: edges.length,
        duration: 15000,
        graphType: 'musical',
        renderingEnabled: true
      };
      
      const result = await framework.runBenchmark(config);
      console.log('Benchmark completed:', result);
      
      // Update performance report
      const report = generatePerformanceReport();
      setPerformanceReport(report);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setBenchmarkRunning(false);
    }
  }, [nodes.length, edges.length]);

  const handleRunRegressionTest = useCallback(async () => {
    try {
      const config = defaultRegressionConfigs[0]; // Use first config
      const result = await globalRegressionTester.runRegressionTests(config);
      setRegressionResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      
      console.log('Regression test completed:', result);
    } catch (error) {
      console.error('Regression test failed:', error);
    }
  }, []);

  const handleOptimizeMemory = useCallback(() => {
    globalMemoryManager.optimize();
    globalMemoryManager.forceGC();
  }, []);

  const handleClearAlerts = useCallback(() => {
    setActiveAlerts([]);
  }, []);

  if (!isOpen) return null;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return '#22c55e';
      case 'B': return '#84cc16';
      case 'C': return '#eab308';
      case 'D': return '#f97316';
      case 'F': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getAlertColor = (type: PerformanceAlert['type']) => {
    switch (type) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (compact) {
    return (
      <div className="performance-dashboard-compact" style={{
        position: 'fixed',
        top: 10,
        left: 10,
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 2000,
        minWidth: '200px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Performance</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <div>FPS: {performanceMetrics.fps?.toFixed(1) || 'N/A'}</div>
          <div>Frame: {performanceMetrics.frameTime?.toFixed(1) || 'N/A'}ms</div>
          <div>Memory: {performanceMetrics.memoryUsage ? (performanceMetrics.memoryUsage.heap / 1024 / 1024).toFixed(1) + 'MB' : 'N/A'}</div>
          <div>Nodes: {performanceMetrics.nodeCount?.rendered || 0}/{performanceMetrics.nodeCount?.total || 0}</div>
        </div>
        
        {activeAlerts.length > 0 && (
          <div style={{ 
            background: getAlertColor(activeAlerts[0].type), 
            padding: '4px 8px', 
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            {activeAlerts.length} alert{activeAlerts.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="performance-dashboard" style={{
      position: 'fixed',
      top: '10%',
      left: '10%',
      width: '80%',
      height: '80%',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
      zIndex: 3000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Performance Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input 
              type="checkbox" 
              checked={autoOptimize}
              onChange={(e) => setAutoOptimize(e.target.checked)}
            />
            Auto-optimize
          </label>
          <button onClick={onClose} style={{
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer'
          }}>
            Close
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb'
      }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'alerts', label: `Alerts (${activeAlerts.length})` },
          { key: 'benchmark', label: 'Benchmark' },
          { key: 'regression', label: 'Regression' },
          { key: 'memory', label: 'Memory' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab.key ? 'white' : 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? '600' : '400'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {/* Performance Score */}
              <div style={{ 
                background: '#f9fafb', 
                padding: '16px', 
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: getGradeColor(performanceReport?.summary.overallGrade || 'F') }}>
                  {performanceReport?.summary.overallGrade || 'N/A'}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Performance Grade</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Score: {performanceReport?.summary.performanceScore || 0}/100
                </div>
              </div>

              {/* FPS */}
              <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {performanceReport?.metrics.current.fps.toFixed(1) || 'N/A'}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>FPS</div>
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                  Avg: {performanceReport?.metrics.average.fps.toFixed(1) || 'N/A'}
                </div>
              </div>

              {/* Memory */}
              <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {performanceReport ? (performanceReport.metrics.current.memoryUsage.used / 1024 / 1024).toFixed(1) : 'N/A'}MB
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Memory Usage</div>
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                  Peak: {performanceReport ? (performanceReport.metrics.peak.memoryUsage.used / 1024 / 1024).toFixed(1) : 'N/A'}MB
                </div>
              </div>

              {/* Nodes */}
              <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {performanceReport?.metrics.current.nodeCount || 0}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Active Nodes</div>
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                  Edges: {performanceReport?.metrics.current.edgeCount || 0}
                </div>
              </div>
            </div>

            {/* Trends */}
            {performanceReport && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Performance Trends</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ fontWeight: '500' }}>FPS Trend</div>
                    <div style={{ 
                      color: performanceReport.metrics.trends.fps === 'improving' ? '#22c55e' : 
                            performanceReport.metrics.trends.fps === 'degrading' ? '#ef4444' : '#6b7280'
                    }}>
                      {performanceReport.metrics.trends.fps}
                    </div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ fontWeight: '500' }}>Memory Trend</div>
                    <div style={{ 
                      color: performanceReport.metrics.trends.memory === 'improving' ? '#22c55e' : 
                            performanceReport.metrics.trends.memory === 'degrading' ? '#ef4444' : '#6b7280'
                    }}>
                      {performanceReport.metrics.trends.memory}
                    </div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ fontWeight: '500' }}>Overall Trend</div>
                    <div style={{ 
                      color: performanceReport.metrics.trends.performance === 'improving' ? '#22c55e' : 
                            performanceReport.metrics.trends.performance === 'degrading' ? '#ef4444' : '#6b7280'
                    }}>
                      {performanceReport.metrics.trends.performance}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                Active Alerts ({activeAlerts.length})
              </h3>
              <button 
                onClick={handleClearAlerts}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear All
              </button>
            </div>

            {activeAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px' }}>
                No active alerts. Performance is optimal!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeAlerts.map(alert => (
                  <div key={alert.id} style={{
                    border: `1px solid ${getAlertColor(alert.type)}`,
                    borderRadius: '6px',
                    padding: '12px',
                    background: `${getAlertColor(alert.type)}10`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '500', color: getAlertColor(alert.type) }}>
                          {alert.type.toUpperCase()} - {alert.category}
                        </div>
                        <div style={{ marginTop: '4px' }}>{alert.message}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          Value: {alert.value.toFixed(2)} | Threshold: {alert.threshold}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    {alert.suggestions.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>Suggestions:</div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px' }}>
                          {alert.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'benchmark' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Performance Benchmark</h3>
              <button 
                onClick={handleRunBenchmark}
                disabled={benchmarkRunning}
                style={{
                  background: benchmarkRunning ? '#6b7280' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: benchmarkRunning ? 'not-allowed' : 'pointer'
                }}
              >
                {benchmarkRunning ? 'Running...' : 'Run Benchmark'}
              </button>
            </div>

            <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>Test Configuration</h4>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                <div>Nodes: {nodes.length}</div>
                <div>Edges: {edges.length}</div>
                <div>Duration: 15 seconds</div>
                <div>Graph Type: Musical</div>
                <div>Rendering: Enabled</div>
              </div>
            </div>

            {benchmarkRunning && (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>Running benchmark...</div>
                <div style={{ color: '#6b7280' }}>This may take up to 15 seconds</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'regression' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Regression Testing</h3>
              <button 
                onClick={handleRunRegressionTest}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer'
                }}
              >
                Run Test
              </button>
            </div>

            {regressionResults.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px' }}>
                No regression test results yet. Run a test to see results.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {regressionResults.map((result, index) => (
                  <div key={result.testId} style={{
                    border: `1px solid ${result.passed ? '#22c55e' : '#ef4444'}`,
                    borderRadius: '6px',
                    padding: '12px',
                    background: `${result.passed ? '#22c55e' : '#ef4444'}10`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>
                          {result.passed ? '✅ PASSED' : '❌ FAILED'} - {result.summary.overallGrade}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {result.summary.regressionCount} regressions, {result.summary.improvementCount} improvements
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(result.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'memory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Memory Management</h3>
              <button 
                onClick={handleOptimizeMemory}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer'
                }}
              >
                Optimize Now
              </button>
            </div>

            {(() => {
              const memoryMetrics = globalMemoryManager.getMetrics();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{memoryMetrics.nodes.inUse}</div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Nodes in Use</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Pool: {memoryMetrics.nodes.poolSize}
                    </div>
                  </div>
                  
                  <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{memoryMetrics.edges.inUse}</div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Edges in Use</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Pool: {memoryMetrics.edges.poolSize}
                    </div>
                  </div>
                  
                  <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {memoryMetrics.nodes.hitRate.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Hit Rate</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Efficiency: {memoryMetrics.nodes.hitRate > 80 ? 'Good' : 'Poor'}
                    </div>
                  </div>
                  
                  <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {memoryMetrics.overall.leakDetected ? '⚠️' : '✅'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Memory Status</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {memoryMetrics.overall.leakDetected ? 'Leak Detected' : 'Healthy'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};