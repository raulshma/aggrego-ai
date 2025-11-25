import type {
  Article,
  ArticleListResponse,
  JobInfo,
  JobExecutionLog,
  RssFeedConfig,
  CreateFeedRequest,
  UpdateFeedRequest,
  SystemConfig,
  AiConfig,
  SearchConfig,
  UpdateConfigRequest,
  FeatureFlagResponse,
} from '../types/api';
import { getAuthHeaders } from './auth';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Authenticated fetch for admin endpoints
async function fetchJsonAuth<T>(url: string, options?: RequestInit): Promise<T> {
  return fetchJson<T>(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });
}

// Article API
export const articleApi = {
  getArticles: (limit = 20, offset = 0, feedId?: string): Promise<ArticleListResponse> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (feedId) params.append('feedId', feedId);
    return fetchJson(`${API_BASE}/article?${params}`);
  },

  getArticle: (id: string): Promise<Article> =>
    fetchJson(`${API_BASE}/article/${id}`),

  // Admin operations
  deleteArticle: (id: string): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/article/${id}`, { method: 'DELETE' }),

  bulkDeleteArticles: (ids: string[]): Promise<{ message: string; deletedCount: number }> =>
    fetchJsonAuth(`${API_BASE}/article/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  setArticleHidden: (id: string, isHidden: boolean): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/article/${id}/hidden`, {
      method: 'PATCH',
      body: JSON.stringify({ isHidden }),
    }),

  bulkSetArticlesHidden: (ids: string[], isHidden: boolean): Promise<{ message: string; updatedCount: number }> =>
    fetchJsonAuth(`${API_BASE}/article/bulk-hidden`, {
      method: 'POST',
      body: JSON.stringify({ ids, isHidden }),
    }),
};

// Job API (Admin only)
export const jobApi = {
  getJobs: (): Promise<JobInfo[]> =>
    fetchJsonAuth(`${API_BASE}/job`),

  getJob: (jobKey: string, jobGroup: string): Promise<JobInfo> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/${jobGroup}`),

  pauseJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/${jobGroup}/pause`, { method: 'POST' }),

  resumeJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/${jobGroup}/resume`, { method: 'POST' }),

  triggerJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/${jobGroup}/trigger`, { method: 'POST' }),

  rescheduleJob: (jobKey: string, jobGroup: string, cronExpression: string): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/${jobGroup}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ cronExpression }),
    }),

  getJobHistory: (jobKey: string, limit = 50): Promise<JobExecutionLog[]> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/history?limit=${limit}`),

  deleteJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJsonAuth(`${API_BASE}/job/${jobKey}/${jobGroup}`, { method: 'DELETE' }),
};

// Feed API (Admin only)
export const feedApi = {
  getFeeds: (): Promise<RssFeedConfig[]> =>
    fetchJsonAuth(`${API_BASE}/feed`),

  getFeed: (id: string): Promise<RssFeedConfig> =>
    fetchJsonAuth(`${API_BASE}/feed/${id}`),

  createFeed: (request: CreateFeedRequest): Promise<RssFeedConfig> =>
    fetchJsonAuth(`${API_BASE}/feed`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateFeed: (id: string, request: UpdateFeedRequest): Promise<RssFeedConfig> =>
    fetchJsonAuth(`${API_BASE}/feed/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteFeed: (id: string): Promise<void> =>
    fetch(`${API_BASE}/feed/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed to delete feed');
    }),
};

// Config API (Admin only)
export const configApi = {
  getConfig: (): Promise<SystemConfig> =>
    fetchJsonAuth(`${API_BASE}/config`),

  updateConfig: (request: UpdateConfigRequest): Promise<SystemConfig> =>
    fetchJsonAuth(`${API_BASE}/config`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  getAiConfig: (): Promise<AiConfig> =>
    fetchJsonAuth(`${API_BASE}/config/ai`),

  updateAiConfig: (config: AiConfig): Promise<AiConfig> =>
    fetchJsonAuth(`${API_BASE}/config/ai`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  getSearchConfig: (): Promise<SearchConfig> =>
    fetchJsonAuth(`${API_BASE}/config/search`),

  updateSearchConfig: (config: SearchConfig): Promise<SearchConfig> =>
    fetchJsonAuth(`${API_BASE}/config/search`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  getFeatureFlag: (key: string): Promise<FeatureFlagResponse> =>
    fetchJsonAuth(`${API_BASE}/config/features/${key}`),

  toggleFeatureFlag: (key: string, enabled: boolean): Promise<FeatureFlagResponse> =>
    fetchJsonAuth(`${API_BASE}/config/features/${key}`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
};
