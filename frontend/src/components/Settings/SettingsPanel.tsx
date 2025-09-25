import React, { useState } from 'react';
import { ResponsivePanel } from '@components/Panels/ResponsivePanel';
import AccessibilitySettings from './AccessibilitySettings';
import { ServiceControl } from './ServiceControl';

// Placeholder for individual settings tabs
const GraphSettings = () => <div>Graph Settings Placeholder</div>;
const DisplaySettings = () => <div>Display Settings Placeholder</div>;
const PerformanceSettings = () => <div>Performance Settings Placeholder</div>;
const SystemSettings = () => <ServiceControl />;

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'graph' | 'display' | 'performance' | 'accessibility' | 'system';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('graph');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'graph': return <GraphSettings />;
      case 'display': return <DisplaySettings />;
      case 'performance': return <PerformanceSettings />;
      case 'accessibility': return <AccessibilitySettings />;
      case 'system': return <SystemSettings />;
      default: return null;
    }
  };

  return (
    <ResponsivePanel isOpen={isOpen} onClose={onClose} title="Settings">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid #374151', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('graph')} style={{ padding: '0.5rem 1rem', color: activeTab === 'graph' ? 'white' : 'gray', background: 'none', border: 'none' }}>Graph</button>
          <button onClick={() => setActiveTab('display')} style={{ padding: '0.5rem 1rem', color: activeTab === 'display' ? 'white' : 'gray', background: 'none', border: 'none' }}>Display</button>
          <button onClick={() => setActiveTab('performance')} style={{ padding: '0.5rem 1rem', color: activeTab === 'performance' ? 'white' : 'gray', background: 'none', border: 'none' }}>Performance</button>
          <button onClick={() => setActiveTab('accessibility')} style={{ padding: '0.5rem 1rem', color: activeTab === 'accessibility' ? 'white' : 'gray', background: 'none', border: 'none' }}>Accessibility</button>
          <button onClick={() => setActiveTab('system')} style={{ padding: '0.5rem 1rem', color: activeTab === 'system' ? '#ef4444' : 'gray', background: 'none', border: 'none', fontWeight: activeTab === 'system' ? 'bold' : 'normal' }}>System</button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderActiveTab()}
        </div>
      </div>
    </ResponsivePanel>
  );
};
