import { useState, useEffect, useCallback } from 'react';
import { feedApi } from '../services/api';
import type { RssFeedConfig, CreateFeedRequest, UpdateFeedRequest } from '../types/api';
import { MisfireInstruction } from '../types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, Rss, Clock, RefreshCw, Loader2, Globe, AlertCircle } from 'lucide-react';

interface FeedFormData {
  name: string;
  url: string;
  cronExpression: string;
  isEnabled: boolean;
  maxRetries: number;
  misfireInstruction: MisfireInstruction;
}

const defaultFormData: FeedFormData = {
  name: '',
  url: '',
  cronExpression: '0 */15 * * * ?',
  isEnabled: true,
  maxRetries: 5,
  misfireInstruction: MisfireInstruction.FireNow,
};

const cronPresets = [
  { label: 'Every 5 minutes', value: '0 */5 * * * ?' },
  { label: 'Every 15 minutes', value: '0 */15 * * * ?' },
  { label: 'Every hour', value: '0 0 * * * ?' },
  { label: 'Every 6 hours', value: '0 0 */6 * * ?' },
  { label: 'Daily at midnight', value: '0 0 0 * * ?' },
];

export function FeedManager() {
  const [feeds, setFeeds] = useState<RssFeedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFeed, setEditingFeed] = useState<RssFeedConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FeedFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  const loadFeeds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await feedApi.getFeeds();
      setFeeds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feeds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleAdd = () => {
    setEditingFeed(null);
    setFormData(defaultFormData);
    setShowForm(true);
  };

  const handleEdit = (feed: RssFeedConfig) => {
    setEditingFeed(feed);
    setFormData({
      name: feed.name,
      url: feed.url,
      cronExpression: feed.cronExpression,
      isEnabled: feed.isEnabled,
      maxRetries: feed.maxRetries,
      misfireInstruction: feed.misfireInstruction,
    });
    setShowForm(true);
  };

  const handleDelete = async (feed: RssFeedConfig) => {
    if (!confirm(`Are you sure you want to delete "${feed.name}"?`)) return;
    
    try {
      await feedApi.deleteFeed(feed.id);
      await loadFeeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete feed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.url.trim()) {
      alert('Name and URL are required');
      return;
    }

    setSaving(true);
    try {
      if (editingFeed) {
        const request: UpdateFeedRequest = {
          name: formData.name,
          url: formData.url,
          cronExpression: formData.cronExpression,
          isEnabled: formData.isEnabled,
          maxRetries: formData.maxRetries,
          misfireInstruction: formData.misfireInstruction,
        };
        await feedApi.updateFeed(editingFeed.id, request);
      } else {
        const request: CreateFeedRequest = {
          name: formData.name,
          url: formData.url,
          cronExpression: formData.cronExpression,
          isEnabled: formData.isEnabled,
          maxRetries: formData.maxRetries,
          misfireInstruction: formData.misfireInstruction,
        };
        await feedApi.createFeed(request);
      }
      setShowForm(false);
      await loadFeeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save feed');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && feeds.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RSS Sources</h2>
          <p className="text-muted-foreground text-sm">Manage your news feed sources</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleAdd} variant="glow">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add a new RSS feed source</TooltipContent>
        </Tooltip>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Feeds Grid */}
      {feeds.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Rss className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No sources configured</h3>
            <p className="text-muted-foreground text-sm mb-4">Add your first RSS feed to start aggregating news.</p>
            <Button onClick={handleAdd} variant="glow">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {feeds.map((feed) => (
            <Card key={feed.id} className={!feed.isEnabled ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h3 className="font-semibold truncate cursor-default">{feed.name}</h3>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">{feed.name}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground truncate cursor-default">{feed.url}</p>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-md break-all">{feed.url}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <Badge variant={feed.isEnabled ? 'success' : 'secondary'} className="shrink-0">
                    {feed.isEnabled ? 'Active' : 'Paused'}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <code className="text-xs bg-muted px-2 py-0.5 rounded truncate">{feed.cronExpression}</code>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span className="text-xs truncate">Last: {formatDate(feed.lastFetchedAt)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => handleEdit(feed)} variant="outline" size="sm" className="flex-1">
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit feed settings</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => handleDelete(feed)} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete this feed</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFeed ? 'Edit Source' : 'Add New Source'}</DialogTitle>
            <DialogDescription>
              {editingFeed ? 'Update the RSS feed configuration' : 'Add a new RSS feed to aggregate'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Feed Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Tech News"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">RSS URL</label>
              <Input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/feed.xml"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule</label>
              <div className="flex gap-2">
                <Input
                  value={formData.cronExpression}
                  onChange={(e) => setFormData(prev => ({ ...prev, cronExpression: e.target.value }))}
                  placeholder="0 */15 * * * ?"
                  className="flex-1"
                />
                <Select
                  value=""
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cronExpression: value }))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Presets" />
                  </SelectTrigger>
                  <SelectContent>
                    {cronPresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Retries</label>
                <Input
                  type="number"
                  value={formData.maxRetries}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={10}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Misfire Handling</label>
                <Select
                  value={String(formData.misfireInstruction)}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, misfireInstruction: parseInt(value) as MisfireInstruction }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={String(MisfireInstruction.FireNow)}>Fire Now</SelectItem>
                    <SelectItem value={String(MisfireInstruction.DoNothing)}>Do Nothing</SelectItem>
                    <SelectItem value={String(MisfireInstruction.RescheduleNextWithRemainingCount)}>Reschedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <label className="text-sm font-medium">Enable this feed</label>
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editingFeed ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
