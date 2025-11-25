import { useState, useEffect, useCallback } from 'react';
import { configApi } from '../services/api';
import type { SystemConfig, AiConfig, SearchConfig } from '../types/api';
import { ModelSelector } from './ModelSelector';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Brain, Search, Flag, Plus, Save, Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

export function ConfigPanel() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuration</h2>
        <p className="text-muted-foreground text-sm">Manage your AI and system settings</p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-success/10 border border-success/30 text-success">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>AI Settings</CardTitle>
                <CardDescription>Configure the AI model and parameters</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <ModelSelector
                value={aiConfig.modelString}
                onChange={(modelId) => setAiConfig(prev => ({ ...prev, modelString: modelId }))}
                onContextLengthChange={(contextLength) =>
                  setAiConfig(prev => ({ ...prev, maxContextTokens: contextLength }))
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Temperature</label>
                <Badge variant="secondary">{aiConfig.temperature.toFixed(1)}</Badge>
              </div>
              <Slider
                value={[aiConfig.temperature]}
                onValueChange={([value]) => setAiConfig(prev => ({ ...prev, temperature: value }))}
                min={0}
                max={2}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">
                Lower values make output more focused, higher values more creative
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Context Tokens</label>
              <Input
                type="number"
                value={aiConfig.maxContextTokens}
                onChange={(e) => setAiConfig(prev => ({ ...prev, maxContextTokens: parseInt(e.target.value) || 0 }))}
                min={1}
                max={128000}
              />
            </div>

            <Button onClick={handleSaveAiConfig} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save AI Settings
            </Button>
          </CardContent>
        </Card>

        {/* Search Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Search Settings</CardTitle>
                <CardDescription>Configure search behavior</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Results</label>
              <Input
                type="number"
                value={searchConfig.maxResults}
                onChange={(e) => setSearchConfig(prev => ({ ...prev, maxResults: parseInt(e.target.value) || 1 }))}
                min={1}
                max={100}
              />
              <p className="text-xs text-muted-foreground">Maximum number of search results to return</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Timeout (seconds)</label>
              <Input
                type="number"
                value={searchConfig.timeoutSeconds}
                onChange={(e) => setSearchConfig(prev => ({ ...prev, timeoutSeconds: parseInt(e.target.value) || 1 }))}
                min={1}
                max={300}
              />
              <p className="text-xs text-muted-foreground">Maximum time to wait for search results</p>
            </div>

            <Button onClick={handleSaveSearchConfig} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Search Settings
            </Button>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Flag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>Toggle experimental features</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(featureFlags).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No feature flags configured</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(featureFlags).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">{key}</span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleToggleFeature(key, checked)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Input
                value={newFlagKey}
                onChange={(e) => setNewFlagKey(e.target.value)}
                placeholder="New feature flag name"
                onKeyDown={(e) => e.key === 'Enter' && handleAddFeatureFlag()}
              />
              <Button onClick={handleAddFeatureFlag} disabled={!newFlagKey.trim()} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cleanup Settings */}
        {config?.cleanupSettings && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Data Retention</CardTitle>
                  <CardDescription>Automatic cleanup settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Retention Period</p>
                  <p className="text-xs text-muted-foreground">Articles older than this will be removed</p>
                </div>
                <Badge variant="glow" className="text-lg px-4 py-1">
                  {config.cleanupSettings.retentionDays} days
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
