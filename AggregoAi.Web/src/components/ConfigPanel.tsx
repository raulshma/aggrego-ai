import { useState, useEffect, useCallback } from 'react';
import { configApi } from '../services/api';
import type { SystemConfig, AiConfig, SearchConfig } from '../types/api';
import { ModelSelector } from './ModelSelector';
import './ConfigPanel.css';

export function ConfigPanel() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    modelString: 'gpt-4',
    temperature: 0.7,
    maxContextTokens: 4096,
  });
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    maxResults: 10,
    timeoutSeconds: 30,
  });
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [newFlagKey, setNewFlagKey] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await configApi.getConfig();
      setConfig(data);
      setAiConfig(data.aiSettings);
      setSearchConfig(data.searchSettings);
      setFeatureFlags(data.featureFlags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveAiConfig = async () => {
    setSaving(true);
    try {
      await configApi.updateAiConfig(aiConfig);
      showSuccess('AI settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };


  const handleSaveSearchConfig = async () => {
    setSaving(true);
    try {
      await configApi.updateSearchConfig(searchConfig);
      showSuccess('Search settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save search settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (key: string, enabled: boolean) => {
    try {
      await configApi.toggleFeatureFlag(key, enabled);
      setFeatureFlags(prev => ({ ...prev, [key]: enabled }));
      showSuccess(`Feature "${key}" ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle feature');
    }
  };

  const handleAddFeatureFlag = async () => {
    if (!newFlagKey.trim()) return;
    try {
      await configApi.toggleFeatureFlag(newFlagKey, false);
      setFeatureFlags(prev => ({ ...prev, [newFlagKey]: false }));
      setNewFlagKey('');
      showSuccess(`Feature "${newFlagKey}" added`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feature flag');
    }
  };

  if (loading) {
    return <div className="config-panel"><div className="loading">Loading configuration...</div></div>;
  }

  return (
    <div className="config-panel">
      <h2>System Configuration</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* AI Settings */}
      <section className="config-section">
        <h3>AI Settings</h3>
        <div className="form-group">
          <label htmlFor="modelString">Model</label>
          <ModelSelector
            value={aiConfig.modelString}
            onChange={(modelId) => setAiConfig(prev => ({ ...prev, modelString: modelId }))}
            onContextLengthChange={(contextLength) =>
              setAiConfig(prev => ({ ...prev, maxContextTokens: contextLength }))
            }
          />
        </div>
        <div className="form-group">
          <label htmlFor="temperature">Temperature</label>
          <div className="range-input">
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={aiConfig.temperature}
              onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
            />
            <span>{aiConfig.temperature.toFixed(1)}</span>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="maxContextTokens">Max Context Tokens</label>
          <input
            id="maxContextTokens"
            type="number"
            value={aiConfig.maxContextTokens}
            onChange={(e) => setAiConfig(prev => ({ ...prev, maxContextTokens: parseInt(e.target.value) || 0 }))}
            min="1"
            max="128000"
          />
        </div>
        <button onClick={handleSaveAiConfig} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : 'Save AI Settings'}
        </button>
      </section>

      {/* Search Settings */}
      <section className="config-section">
        <h3>Search Settings</h3>
        <div className="form-group">
          <label htmlFor="maxResults">Max Results</label>
          <input
            id="maxResults"
            type="number"
            value={searchConfig.maxResults}
            onChange={(e) => setSearchConfig(prev => ({ ...prev, maxResults: parseInt(e.target.value) || 1 }))}
            min="1"
            max="100"
          />
        </div>
        <div className="form-group">
          <label htmlFor="timeoutSeconds">Timeout (seconds)</label>
          <input
            id="timeoutSeconds"
            type="number"
            value={searchConfig.timeoutSeconds}
            onChange={(e) => setSearchConfig(prev => ({ ...prev, timeoutSeconds: parseInt(e.target.value) || 1 }))}
            min="1"
            max="300"
          />
        </div>
        <button onClick={handleSaveSearchConfig} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : 'Save Search Settings'}
        </button>
      </section>

      {/* Feature Flags */}
      <section className="config-section">
        <h3>Feature Flags</h3>
        <div className="feature-flags">
          {Object.entries(featureFlags).map(([key, enabled]) => (
            <div key={key} className="feature-flag">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => handleToggleFeature(key, e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="flag-name">{key}</span>
            </div>
          ))}
          {Object.keys(featureFlags).length === 0 && (
            <p className="no-flags">No feature flags configured.</p>
          )}
        </div>
        <div className="add-flag">
          <input
            type="text"
            value={newFlagKey}
            onChange={(e) => setNewFlagKey(e.target.value)}
            placeholder="New feature flag name"
          />
          <button onClick={handleAddFeatureFlag} disabled={!newFlagKey.trim()}>
            Add Flag
          </button>
        </div>
      </section>

      {/* Cleanup Settings (read-only display) */}
      {config?.cleanupSettings && (
        <section className="config-section">
          <h3>Cleanup Settings</h3>
          <div className="info-display">
            <span className="info-label">Retention Period:</span>
            <span className="info-value">{config.cleanupSettings.retentionDays} days</span>
          </div>
        </section>
      )}
    </div>
  );
}
