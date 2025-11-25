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

// Article API
export const articleApi = {
  getArticles: (limit = 20, offset = 0, feedId?: string): Promise<ArticleListResponse> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (feedId) params.append('feedId', feedId);
    return fetchJson(`${API_BASE}/article?${params}`);
  },

  getArticle: (id: string): Promise<Article> =>
    fetchJson(`${API_BASE}/article/${id}`),
};

// Job API
export const jobApi = {
  getJobs: (): Promise<JobInfo[]> =>
    fetchJson(`${API_BASE}/job`),

  getJob: (jobKey: string, jobGroup: string): Promise<JobInfo> =>
    fetchJson(`${API_BASE}/job/${jobKey}/${jobGroup}`),

  pauseJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJson(`${API_BASE}/job/${jobKey}/${jobGroup}/pause`, { method: 'POST' }),


  resumeJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJson(`${API_BASE}/job/${jobKey}/${jobGroup}/resume`, { method: 'POST' }),

  triggerJob: (jobKey: string, jobGroup: string): Promise<{ message: string }> =>
    fetchJson(`${API_BASE}/job/${jobKey}/${jobGroup}/trigger`, { method: 'POST' }),

  rescheduleJob: (jobKey: string, jobGroup: string, cronExpression: string): Promise<{ message: string }> =>
    fetchJson(`${API_BASE}/job/${jobKey}/${jobGroup}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ cronExpression }),
    }),

  getJobHistory: (jobKey: string, limit = 50): Promise<JobExecutionLog[]> =>
    fetchJson(`${API_BASE}/job/${jobKey}/history?limit=${limit}`),
};

// Feed API
export const feedApi = {
  getFeeds: (): Promise<RssFeedConfig[]> =>
    fetchJson(`${API_BASE}/feed`),

  getFeed: (id: string): Promise<RssFeedConfig> =>
    fetchJson(`${API_BASE}/feed/${id}`),

  createFeed: (request: CreateFeedRequest): Promise<RssFeedConfig> =>
    fetchJson(`${API_BASE}/feed`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateFeed: (id: string, request: UpdateFeedRequest): Promise<RssFeedConfig> =>
    fetchJson(`${API_BASE}/feed/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  deleteFeed: (id: string): Promise<void> =>
    fetch(`${API_BASE}/feed/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error('Failed to delete feed');
    }),
};

// Config API
export const configApi = {
  getConfig: (): Promise<SystemConfig> =>
    fetchJson(`${API_BASE}/config`),

  updateConfig: (request: UpdateConfigRequest): Promise<SystemConfig> =>
    fetchJson(`${API_BASE}/config`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  getAiConfig: (): Promise<AiConfig> =>
    fetchJson(`${API_BASE}/config/ai`),

  updateAiConfig: (config: AiConfig): Promise<AiConfig> =>
    fetchJson(`${API_BASE}/config/ai`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  getSearchConfig: (): Promise<SearchConfig> =>
    fetchJson(`${API_BASE}/config/search`),

  updateSearchConfig: (config: SearchConfig): Promise<SearchConfig> =>
    fetchJson(`${API_BASE}/config/search`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  getFeatureFlag: (key: string): Promise<FeatureFlagResponse> =>
    fetchJson(`${API_BASE}/config/features/${key}`),

  toggleFeatureFlag: (key: string, enabled: boolean): Promise<FeatureFlagResponse> =>
    fetchJson(`${API_BASE}/config/features/${key}`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
};
