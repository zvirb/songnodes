import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { updateDeviceInfo } from '../../store/uiSlice';
import { SettingsIcon, CloseIcon, ChevronDownIcon, ResetIcon } from '../Icons/SettingsIcons';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface SettingsPreset {
  id: string;
  name: string;
  description: string;
  settings: Record<string, any>;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'visual',
    label: 'Visual',
    icon: '🎨',
    description: 'Graph appearance and rendering options'
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: '⚡',
    description: 'Optimization and rendering performance'
  },
  {
    id: 'data',
    label: 'Data',
    icon: '📊',
    description: 'Data filtering and display options'
  },
  {
    id: 'accessibility',
    label: 'A11y',
    icon: '♿',
    description: 'Accessibility and usability settings'
  }
];

const PERFORMANCE_PRESETS: SettingsPreset[] = [
  {
    id: 'quality',
    name: 'Quality',
    description: 'Best visual quality, may impact performance',
    settings: {
      nodeSize: 16,
      edgeLabelSize: 14,
      enableAntialiasing: true,
      enableShadows: true,
      maxVisibleNodes: 5000,
      animationDuration: 800
    }
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance of quality and performance',
    settings: {
      nodeSize: 12,
      edgeLabelSize: 12,
      enableAntialiasing: true,
      enableShadows: false,
      maxVisibleNodes: 2000,
      animationDuration: 400
    }
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Maximum performance, reduced visual quality',
    settings: {
      nodeSize: 8,
      edgeLabelSize: 10,
      enableAntialiasing: false,
      enableShadows: false,
      maxVisibleNodes: 1000,
      animationDuration: 200
    }
  }
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const dispatch = useAppDispatch();
  const { theme, deviceInfo } = useAppSelector(state => state.ui);
  const panelRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState('visual');
  const [localSettings, setLocalSettings] = useState({
    // Visual Settings
    nodeSize: 12,
    edgeLabelSize: 12,
    distancePower: 0,
    relationshipPower: 0,
    colorScheme: 'default',
    showEdgeLabels: true,
    showNodeLabels: true,

    // Performance Settings
    enableAntialiasing: true,
    enableShadows: false,
    maxVisibleNodes: 2000,
    animationDuration: 400,
    enableWebGL: true,
    enableCulling: true,

    // Data Settings
    showOnlyConnected: false,
    minConnectionStrength: 1,
    hideDisconnectedNodes: false,
    enableRealTimeUpdates: true,

    // Accessibility Settings
    highContrast: false,
    reduceMotion: false,
    keyboardNavigation: true,
    screenReaderAnnouncements: true,
    focusIndicators: true
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('songnodes-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setLocalSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn('Failed to load saved settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage when changed
  const saveSettings = (newSettings: typeof localSettings) => {
    setLocalSettings(newSettings);
    localStorage.setItem('songnodes-settings', JSON.stringify(newSettings));

    // Dispatch to global state if needed
    // This would connect to your existing settings system
  };

  const applyPreset = (preset: SettingsPreset) => {
    const newSettings = { ...localSettings, ...preset.settings };
    saveSettings(newSettings);
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      nodeSize: 12,
      edgeLabelSize: 12,
      distancePower: 0,
      relationshipPower: 0,
      colorScheme: 'default',
      showEdgeLabels: true,
      showNodeLabels: true,
      enableAntialiasing: true,
      enableShadows: false,
      maxVisibleNodes: 2000,
      animationDuration: 400,
      enableWebGL: true,
      enableCulling: true,
      showOnlyConnected: false,
      minConnectionStrength: 1,
      hideDisconnectedNodes: false,
      enableRealTimeUpdates: true,
      highContrast: false,
      reduceMotion: false,
      keyboardNavigation: true,
      screenReaderAnnouncements: true,
      focusIndicators: true
    };
    saveSettings(defaultSettings);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Close panel on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderVisualSettings = () => (
    <div className="space-y-6">
      {/* Basic Visual Settings */}
      <div className="space-y-4">
        <button
          onClick={() => toggleSection('basic')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="text-white font-medium">Basic Appearance</h4>
          <ChevronDownIcon
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expandedSections.has('basic') ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedSections.has('basic') && (
          <div className="space-y-4 pl-4 border-l border-gray-700">
            {/* Node Size */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Node Size</span>
                <span className="text-white font-medium">{localSettings.nodeSize}px</span>
              </div>
              <input
                type="range"
                min="4"
                max="32"
                step="1"
                value={localSettings.nodeSize}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  nodeSize: parseInt(e.target.value)
                })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Edge Label Size */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Edge Label Size</span>
                <span className="text-white font-medium">{localSettings.edgeLabelSize}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={localSettings.edgeLabelSize}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  edgeLabelSize: parseInt(e.target.value)
                })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <span className="text-gray-300 text-sm">Color Scheme</span>
              <select
                value={localSettings.colorScheme}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  colorScheme: e.target.value
                })}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
              >
                <option value="default">Default</option>
                <option value="vibrant">Vibrant</option>
                <option value="pastel">Pastel</option>
                <option value="monochrome">Monochrome</option>
                <option value="high-contrast">High Contrast</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Visual Settings */}
      <div className="space-y-4">
        <button
          onClick={() => toggleSection('advanced')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="text-white font-medium">Advanced</h4>
          <ChevronDownIcon
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expandedSections.has('advanced') ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedSections.has('advanced') && (
          <div className="space-y-4 pl-4 border-l border-gray-700">
            {/* Distance Power */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Distance Power</span>
                <span className="text-white font-medium">10^{localSettings.distancePower}</span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={localSettings.distancePower}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  distancePower: parseFloat(e.target.value)
                })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Relationship Power */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Relationship Power</span>
                <span className="text-white font-medium">10^{localSettings.relationshipPower}</span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={localSettings.relationshipPower}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  relationshipPower: parseFloat(e.target.value)
                })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.showEdgeLabels}
                  onChange={(e) => saveSettings({
                    ...localSettings,
                    showEdgeLabels: e.target.checked
                  })}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">Show Edge Labels</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.showNodeLabels}
                  onChange={(e) => saveSettings({
                    ...localSettings,
                    showNodeLabels: e.target.checked
                  })}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">Show Node Labels</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="space-y-6">
      {/* Performance Presets */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Performance Presets</h4>
        <div className="grid gap-3">
          {PERFORMANCE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors"
            >
              <div className="font-medium text-white text-sm">{preset.name}</div>
              <div className="text-gray-400 text-xs mt-1">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detailed Performance Settings */}
      <div className="space-y-4">
        <button
          onClick={() => toggleSection('performance-detail')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="text-white font-medium">Detailed Settings</h4>
          <ChevronDownIcon
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expandedSections.has('performance-detail') ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedSections.has('performance-detail') && (
          <div className="space-y-4 pl-4 border-l border-gray-700">
            {/* Max Visible Nodes */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Max Visible Nodes</span>
                <span className="text-white font-medium">{localSettings.maxVisibleNodes.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={localSettings.maxVisibleNodes}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  maxVisibleNodes: parseInt(e.target.value)
                })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Animation Duration */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Animation Duration</span>
                <span className="text-white font-medium">{localSettings.animationDuration}ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="50"
                value={localSettings.animationDuration}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  animationDuration: parseInt(e.target.value)
                })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Performance Toggles */}
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.enableAntialiasing}
                  onChange={(e) => saveSettings({
                    ...localSettings,
                    enableAntialiasing: e.target.checked
                  })}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">Enable Antialiasing</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.enableShadows}
                  onChange={(e) => saveSettings({
                    ...localSettings,
                    enableShadows: e.target.checked
                  })}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">Enable Shadows</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.enableWebGL}
                  onChange={(e) => saveSettings({
                    ...localSettings,
                    enableWebGL: e.target.checked
                  })}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">Enable WebGL Acceleration</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.enableCulling}
                  onChange={(e) => saveSettings({
                    ...localSettings,
                    enableCulling: e.target.checked
                  })}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">Enable View Culling</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDataSettings = () => (
    <div className="space-y-6">
      {/* Data Filtering */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Data Filtering</h4>

        <div className="space-y-4">
          {/* Min Connection Strength */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Min Connection Strength</span>
              <span className="text-white font-medium">{localSettings.minConnectionStrength}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={localSettings.minConnectionStrength}
              onChange={(e) => saveSettings({
                ...localSettings,
                minConnectionStrength: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Data Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localSettings.showOnlyConnected}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  showOnlyConnected: e.target.checked
                })}
                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Show Only Connected Nodes</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localSettings.hideDisconnectedNodes}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  hideDisconnectedNodes: e.target.checked
                })}
                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Hide Disconnected Nodes</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localSettings.enableRealTimeUpdates}
                onChange={(e) => saveSettings({
                  ...localSettings,
                  enableRealTimeUpdates: e.target.checked
                })}
                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Enable Real-time Updates</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccessibilitySettings = () => (
    <div className="space-y-6">
      {/* Accessibility Options */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Accessibility</h4>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={localSettings.highContrast}
              onChange={(e) => saveSettings({
                ...localSettings,
                highContrast: e.target.checked
              })}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">High Contrast Mode</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={localSettings.reduceMotion}
              onChange={(e) => saveSettings({
                ...localSettings,
                reduceMotion: e.target.checked
              })}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">Reduce Motion</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={localSettings.keyboardNavigation}
              onChange={(e) => saveSettings({
                ...localSettings,
                keyboardNavigation: e.target.checked
              })}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">Enhanced Keyboard Navigation</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={localSettings.screenReaderAnnouncements}
              onChange={(e) => saveSettings({
                ...localSettings,
                screenReaderAnnouncements: e.target.checked
              })}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">Screen Reader Announcements</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={localSettings.focusIndicators}
              onChange={(e) => saveSettings({
                ...localSettings,
                focusIndicators: e.target.checked
              })}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">Enhanced Focus Indicators</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'visual':
        return renderVisualSettings();
      case 'performance':
        return renderPerformanceSettings();
      case 'data':
        return renderDataSettings();
      case 'accessibility':
        return renderAccessibilitySettings();
      default:
        return renderVisualSettings();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`
          fixed inset-0 bg-black bg-opacity-50 z-[9998] transition-opacity duration-300
          lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Settings Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full bg-gray-900/95 backdrop-blur-md border-l border-gray-600/80
          shadow-2xl transform transition-transform duration-300 ease-out z-[9999] overflow-hidden
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${className}

          /* Mobile: Full screen */
          w-full

          /* Desktop: 25% of screen width, max 400px, min 320px */
          lg:w-[25vw] lg:max-w-[400px] lg:min-w-[320px]
        `}
        style={{ paddingTop: '64px' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md border-b border-gray-700/80 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-white font-semibold text-lg">Settings</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetToDefaults}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Reset to defaults"
              >
                <ResetIcon className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 bg-gray-800/50 rounded-lg p-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium
                  transition-all duration-200 group
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }
                `}
                title={tab.description}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-700/80 p-4">
          <div className="text-xs text-gray-500 text-center">
            Settings auto-save locally
          </div>
        </div>
      </div>
    </>
  );
};