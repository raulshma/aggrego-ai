import { useState, useEffect, useCallback } from 'react';
import { feedApi } from '../services/api';
import type { RssFeedConfig, CreateFeedRequest, UpdateFeedRequest } from '../types/api';
import { MisfireInstruction } from '../types/api';
import './FeedManager.css';

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
    return new Date(dateString).toLocaleString();
  };

  const cronPresets = [
    { label: 'Every 5 minutes', value: '0 */5 * * * ?' },
    { label: 'Every 15 minutes', value: '0 */15 * * * ?' },
    { label: 'Every hour', value: '0 0 * * * ?' },
    { label: 'Every 6 hours', value: '0 0 */6 * * ?' },
    { label: 'Daily at midnight', value: '0 0 0 * * ?' },
  ];

  if (loading && feeds.length === 0) {
    return <div className="feed-manager"><div className="loading">Loading feeds...</div></div>;
  }

  return (
    <div className="feed-manager">
      <div className="manager-header">
        <h2>RSS Feed Management</h2>
        <button onClick={handleAdd} className="add-btn">+ Add Feed</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="feeds-list">
        {feeds.length === 0 ? (
          <p className="no-feeds">No feeds configured. Click "Add Feed" to get started.</p>
        ) : (
          feeds.map((feed) => (
            <div key={feed.id} className={`feed-card ${!feed.isEnabled ? 'disabled' : ''}`}>
              <div className="feed-info">
                <div className="feed-header">
                  <h3>{feed.name}</h3>
                  <span className={`status-badge ${feed.isEnabled ? 'enabled' : 'disabled'}`}>
                    {feed.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="feed-url">{feed.url}</p>
                <div className="feed-meta">
                  <span><strong>Schedule:</strong> <code>{feed.cronExpression}</code></span>
                  <span><strong>Last Fetched:</strong> {formatDate(feed.lastFetchedAt)}</span>
                  <span><strong>Max Retries:</strong> {feed.maxRetries}</span>
                </div>
              </div>
              <div className="feed-actions">
                <button onClick={() => handleEdit(feed)} className="edit-btn">Edit</button>
                <button onClick={() => handleDelete(feed)} className="delete-btn">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingFeed ? 'Edit Feed' : 'Add New Feed'}</h3>
              <button onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="feed-form">
              <div className="form-group">
                <label htmlFor="name">Feed Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Tech News"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="url">RSS URL *</label>
                <input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/feed.xml"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cronExpression">Schedule (CRON)</label>
                <div className="cron-input">
                  <input
                    id="cronExpression"
                    type="text"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData(prev => ({ ...prev, cronExpression: e.target.value }))}
                    placeholder="0 */15 * * * ?"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setFormData(prev => ({ ...prev, cronExpression: e.target.value }));
                      }
                    }}
                    value=""
                  >
                    <option value="">Presets...</option>
                    {cronPresets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="maxRetries">Max Retries</label>
                  <input
                    id="maxRetries"
                    type="number"
                    value={formData.maxRetries}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 0 }))}
                    min="0"
                    max="10"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="misfireInstruction">Misfire Handling</label>
                  <select
                    id="misfireInstruction"
                    value={formData.misfireInstruction}
                    onChange={(e) => setFormData(prev => ({ ...prev, misfireInstruction: parseInt(e.target.value) as MisfireInstruction }))}
                  >
                    <option value={MisfireInstruction.FireNow}>Fire Now</option>
                    <option value={MisfireInstruction.DoNothing}>Do Nothing</option>
                    <option value={MisfireInstruction.RescheduleNextWithRemainingCount}>Reschedule</option>
                  </select>
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
                  />
                  Enable this feed
                </label>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="submit-btn">
                  {saving ? 'Saving...' : (editingFeed ? 'Update Feed' : 'Create Feed')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
