import React, { useState, useEffect, useCallback } from 'react';
import * as apiKeyService from '../services/apiKeyService';
import { APIKey, APIKeyRequirement } from '../types';

interface ServiceKeys {
  [serviceName: string]: {
    [keyName: string]: string;
  };
}

interface APIKeyManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A modal component for managing API keys for various services.
 * It allows users to view, add, test, and delete API keys securely.
 *
 * @param {APIKeyManagerProps} props The component props.
 * @returns {React.ReactElement | null} The rendered component or null if not open.
 */
export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ isOpen, onClose }) => {
  const [requirements, setRequirements] = useState<APIKeyRequirement[]>([]);
  const [existingKeys, setExistingKeys] = useState<APIKey[]>([]);
  const [keyValues, setKeyValues] = useState<ServiceKeys>({});
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeService, setActiveService] = useState<string>('');

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, keys] = await Promise.all([
        apiKeyService.fetchRequirements(),
        apiKeyService.fetchExistingKeys(),
      ]);
      setRequirements(reqs);
      setExistingKeys(keys);
      if (reqs.length > 0 && !activeService) {
        setActiveService(reqs[0].service_name);
      }
    } catch (error) {
      console.error('Failed to fetch API key data:', error);
      setErrorMessage('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeService]);

  useEffect(() => {
    if (isOpen) {
      fetchAllData();
    }
  }, [isOpen, fetchAllData]);

  const handleSaveKey = async (serviceName: string, keyName: string) => {
    const keyValue = keyValues[serviceName]?.[keyName];
    if (!keyValue?.trim()) {
      setErrorMessage('Please enter a value.');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      await apiKeyService.saveKey(serviceName, keyName, keyValue);
      setSaveStatus('saved');
      setKeyValues(prev => ({ ...prev, [serviceName]: { ...prev[serviceName], [keyName]: '' } }));
      await fetchAllData();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error(`Save failed:`, error);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleTestKey = async (serviceName: string, keyName: string) => {
    const testKey = `${serviceName}:${keyName}`;
    setTesting(prev => ({ ...prev, [testKey]: true }));
    try {
      const result = await apiKeyService.testKey(serviceName, keyName);
      if (result.valid) {
        console.log(`✅ ${serviceName.toUpperCase()} - ${keyName}: ${result.message}`);
      } else {
        console.error(`❌ ${serviceName.toUpperCase()} - ${keyName}: ${result.message}`);
      }
      await fetchAllData();
    } catch (error) {
      console.error(`❌ Test error:`, error);
    } finally {
      setTesting(prev => ({ ...prev, [testKey]: false }));
    }
  };

  const handleDeleteKey = async (serviceName: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete ${serviceName}/${keyName}?`)) return;
    try {
      await apiKeyService.deleteKey(serviceName, keyName);
      await fetchAllData();
    } catch (error) {
      console.error(`Delete error:`, error);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getExistingKey = (serviceName: string, keyName: string) => {
    return existingKeys.find(k => k.service_name === serviceName && k.key_name === keyName);
  };

  const uniqueServices = [...new Set(requirements.map(req => req.service_name))];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1A1A1A] rounded-xl border border-white/10 w-[90%] max-w-4xl max-h-[85vh] overflow-hidden text-white flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/10">
          <div>
            <h2 className="m-0 text-xl font-semibold">API Key Management</h2>
            <p className="m-0 text-sm text-gray-400">Configure API keys for scraper and enrichment services</p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-gray-400 text-2xl cursor-pointer p-1">×</button>
        </div>

        {/* Service Tabs */}
        <div className="flex overflow-x-auto border-b border-white/10 bg-black/30">
          {uniqueServices.map(service => (
            <button
              key={service}
              onClick={() => setActiveService(service)}
              className={`flex-shrink-0 px-5 py-4 text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeService === service ? 'text-white bg-white/10 border-b-2 border-blue-500' : 'text-gray-400 border-b-2 border-transparent hover:bg-white/5'}`}
            >
              {service.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading API keys...</div>
          ) : (
            <div>
              {requirements.filter(r => r.service_name === activeService).map(req => {
                const existing = getExistingKey(activeService, req.key_name);
                const inputKey = `${activeService}:${req.key_name}`;
                return (
                  <div key={inputKey} className="mb-6 p-5 bg-white/5 rounded-lg border border-white/10">
                    <h3 className="m-0 text-base font-semibold">{req.display_name}</h3>
                    <p className="m-0 mb-2 text-xs text-gray-400">{req.description}</p>
                    {existing ? (
                      <div className="flex items-center gap-4 mt-4">
                        <span className="font-mono text-sm text-gray-400 flex-1">{existing.masked_value}</span>
                        <button onClick={() => handleTestKey(activeService, req.key_name)} disabled={testing[inputKey]} className="px-4 py-2 bg-blue-600 rounded-md text-xs hover:bg-blue-700 disabled:opacity-50">Test</button>
                        <button onClick={() => handleDeleteKey(activeService, req.key_name)} className="px-4 py-2 bg-red-600 rounded-md text-xs hover:bg-red-700">Delete</button>
                      </div>
                    ) : (
                      <div className="flex gap-3 mt-4">
                        <input
                          type={showKeys[inputKey] ? 'text' : 'password'}
                          value={keyValues[activeService]?.[req.key_name] || ''}
                          onChange={e => setKeyValues(prev => ({...prev, [activeService]: {...prev[activeService], [req.key_name]: e.target.value}}))}
                          placeholder={`Enter ${req.display_name}`}
                          className="flex-1 px-3 py-2 bg-black/20 border border-white/20 rounded-md text-sm"
                        />
                        <button onClick={() => handleSaveKey(activeService, req.key_name)} disabled={saveStatus === 'saving'} className="px-5 py-2 bg-green-600 rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50">Save</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/30 flex justify-between items-center">
          <div className="text-xs">
            {saveStatus === 'saved' && <span className="text-green-400">✓ Saved successfully</span>}
            {saveStatus === 'error' && <span className="text-red-400">✗ {errorMessage}</span>}
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-transparent border border-white/30 rounded-md text-sm hover:bg-white/10">Close</button>
        </div>
      </div>
    </div>
  );
};

export default APIKeyManager;