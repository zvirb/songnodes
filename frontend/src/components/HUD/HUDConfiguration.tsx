import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../store/index';
import { SettingsIcon, LayersIcon } from '../Icons/SettingsIcons';

interface HUDLayoutConfig {
  widgets: {
    performance: { visible: boolean; position: string; size: string };
    compass: { visible: boolean; position: string; size: string };
    minimap: { visible: boolean; position: string; size: string };
    filters: { visible: boolean; position: string; size: string };
    routeProgress: { visible: boolean; position: string; size: string };
  };
  mobileLayout: {
    autoHide: boolean;
    collapsedMode: boolean;
    maxVisibleWidgets: number;
  };
  settings: {
    transparency: number;
    autoPosition: boolean;
    snapToEdges: boolean;
    respectSafeArea: boolean;
  };
}

interface HUDConfigurationProps {
  isOpen: boolean;
  onClose: () => void;
  config: HUDLayoutConfig;
  onConfigChange: (config: HUDLayoutConfig) => void;
  className?: string;
}

const DEFAULT_CONFIG: HUDLayoutConfig = {
  widgets: {
    performance: { visible: true, position: 'top-left', size: 'small' },
    compass: { visible: true, position: 'bottom-right', size: 'medium' },
    minimap: { visible: true, position: 'top-right', size: 'medium' },
    filters: { visible: true, position: 'bottom-left', size: 'medium' },
    routeProgress: { visible: false, position: 'bottom-center', size: 'large' }
  },
  mobileLayout: {
    autoHide: true,
    collapsedMode: true,
    maxVisibleWidgets: 2
  },
  settings: {
    transparency: 90,
    autoPosition: true,
    snapToEdges: true,
    respectSafeArea: true
  }
};

const WIDGET_OPTIONS = [
  { id: 'performance', label: 'Performance Metrics', icon: '📊' },
  { id: 'compass', label: 'Navigation Controls', icon: '🧭' },
  { id: 'minimap', label: 'Graph Overview', icon: '🗺️' },
  { id: 'filters', label: 'Active Filters', icon: '🔍' },
  { id: 'routeProgress', label: 'Route Progress', icon: '🎵' }
];

const POSITION_OPTIONS = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'custom', label: 'Custom Position' }
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

export const HUDConfiguration: React.FC<HUDConfigurationProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  className = ''
}) => {
  const { deviceInfo } = useAppSelector(state => state.ui);
  const [localConfig, setLocalConfig] = useState<HUDLayoutConfig>(config);

  // Update local config when prop changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Save configuration to localStorage
  const saveConfig = (newConfig: HUDLayoutConfig) => {
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
    localStorage.setItem('songnodes-hud-config', JSON.stringify(newConfig));
  };

  const updateWidgetConfig = (
    widgetId: keyof HUDLayoutConfig['widgets'],
    field: string,
    value: any
  ) => {
    const newConfig = {
      ...localConfig,
      widgets: {
        ...localConfig.widgets,
        [widgetId]: {
          ...localConfig.widgets[widgetId],
          [field]: value
        }
      }
    };
    saveConfig(newConfig);
  };

  const updateMobileConfig = (field: keyof HUDLayoutConfig['mobileLayout'], value: any) => {
    const newConfig = {
      ...localConfig,
      mobileLayout: {
        ...localConfig.mobileLayout,
        [field]: value
      }
    };
    saveConfig(newConfig);
  };

  const updateSettings = (field: keyof HUDLayoutConfig['settings'], value: any) => {
    const newConfig = {
      ...localConfig,
      settings: {
        ...localConfig.settings,
        [field]: value
      }
    };
    saveConfig(newConfig);
  };

  const resetToDefaults = () => {
    saveConfig(DEFAULT_CONFIG);
  };

  const applyMobileOptimized = () => {
    const mobileConfig: HUDLayoutConfig = {
      ...localConfig,
      widgets: {
        performance: { visible: false, position: 'top-left', size: 'small' },
        compass: { visible: true, position: 'bottom-right', size: 'small' },
        minimap: { visible: false, position: 'top-right', size: 'small' },
        filters: { visible: true, position: 'bottom-left', size: 'small' },
        routeProgress: { visible: true, position: 'bottom-center', size: 'medium' }
      },
      mobileLayout: {
        autoHide: true,
        collapsedMode: true,
        maxVisibleWidgets: 2
      }
    };
    saveConfig(mobileConfig);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`
          fixed inset-0 bg-black bg-opacity-50 z-[9997] transition-opacity duration-300
          lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Configuration Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full bg-gray-900/95 backdrop-blur-md border-l border-gray-600/80
          shadow-2xl transform transition-transform duration-300 ease-out z-[9998] overflow-y-auto
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${className}

          /* Mobile: Full screen */
          w-full

          /* Desktop: 30% of screen width, max 400px, min 320px */
          lg:w-[30vw] lg:max-w-[400px] lg:min-w-[320px]
        `}
        style={{ paddingTop: '64px' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md border-b border-gray-700/80 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayersIcon className="w-5 h-5 text-purple-400" />
              <h2 className="text-white font-semibold text-lg">HUD Layout</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-white font-medium">Quick Actions</h3>
            <div className="flex gap-2">
              <button
                onClick={resetToDefaults}
                className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
              >
                Reset to Default
              </button>
              {deviceInfo?.isMobile && (
                <button
                  onClick={applyMobileOptimized}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
                >
                  Mobile Optimized
                </button>
              )}
            </div>
          </div>

          {/* Widget Configuration */}
          <div className="space-y-4">
            <h3 className="text-white font-medium">Widgets</h3>
            <div className="space-y-4">
              {WIDGET_OPTIONS.map(widget => {
                const widgetConfig = localConfig.widgets[widget.id as keyof typeof localConfig.widgets];
                return (
                  <div key={widget.id} className="p-4 bg-gray-800/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{widget.icon}</span>
                        <span className="text-white font-medium text-sm">{widget.label}</span>
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={widgetConfig.visible}
                          onChange={(e) => updateWidgetConfig(
                            widget.id as keyof HUDLayoutConfig['widgets'],
                            'visible',
                            e.target.checked
                          )}
                          className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                      </label>
                    </div>

                    {widgetConfig.visible && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Position</label>
                          <select
                            value={widgetConfig.position}
                            onChange={(e) => updateWidgetConfig(
                              widget.id as keyof HUDLayoutConfig['widgets'],
                              'position',
                              e.target.value
                            )}
                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                          >
                            {POSITION_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Size</label>
                          <select
                            value={widgetConfig.size}
                            onChange={(e) => updateWidgetConfig(
                              widget.id as keyof HUDLayoutConfig['widgets'],
                              'size',
                              e.target.value
                            )}
                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                          >
                            {SIZE_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Layout Settings */}
          {(deviceInfo?.isMobile || deviceInfo?.isTablet) && (
            <div className="space-y-4">
              <h3 className="text-white font-medium">Mobile Layout</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Auto-hide on interaction</span>
                  <input
                    type="checkbox"
                    checked={localConfig.mobileLayout.autoHide}
                    onChange={(e) => updateMobileConfig('autoHide', e.target.checked)}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Collapsed mode</span>
                  <input
                    type="checkbox"
                    checked={localConfig.mobileLayout.collapsedMode}
                    onChange={(e) => updateMobileConfig('collapsedMode', e.target.checked)}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                </label>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">Max visible widgets</span>
                    <span className="text-white font-medium">{localConfig.mobileLayout.maxVisibleWidgets}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={localConfig.mobileLayout.maxVisibleWidgets}
                    onChange={(e) => updateMobileConfig('maxVisibleWidgets', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>
          )}

          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="text-white font-medium">General Settings</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300">Transparency</span>
                  <span className="text-white font-medium">{localConfig.settings.transparency}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={localConfig.settings.transparency}
                  onChange={(e) => updateSettings('transparency', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <label className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Auto positioning</span>
                <input
                  type="checkbox"
                  checked={localConfig.settings.autoPosition}
                  onChange={(e) => updateSettings('autoPosition', e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Snap to edges</span>
                <input
                  type="checkbox"
                  checked={localConfig.settings.snapToEdges}
                  onChange={(e) => updateSettings('snapToEdges', e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Respect safe area</span>
                <input
                  type="checkbox"
                  checked={localConfig.settings.respectSafeArea}
                  onChange={(e) => updateSettings('respectSafeArea', e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Device Information */}
          <div className="space-y-3">
            <h3 className="text-white font-medium">Device Information</h3>
            <div className="bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Screen Size:</span>
                <span className="text-gray-300">{deviceInfo?.screenSize || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Orientation:</span>
                <span className="text-gray-300 capitalize">{deviceInfo?.orientation || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Touch Support:</span>
                <span className="text-gray-300">{deviceInfo?.hasTouch ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pixel Ratio:</span>
                <span className="text-gray-300">{deviceInfo?.pixelRatio || 1}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-700/80 p-4">
          <div className="text-xs text-gray-500 text-center">
            HUD layout automatically saves to local storage
          </div>
        </div>
      </div>
    </>
  );
};