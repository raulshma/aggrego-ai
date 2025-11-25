// API Types for AggregoAi

// Article types
export interface Article {
  id: string;
  title: string;
  link: string;
  description: string | null;
  publicationDate: string;
  sourceFeedId: string;
  sourceFeedName: string | null;
  createdAt: string;
  verificationStatus: VerificationStatus;
  verdict: VerificationVerdict | null;
  tags: string[];
  imageUrl: string | null;
  isHidden: boolean;
  analysisResult: ArticleAnalysisResult | null;
}

export interface ArticleAnalysisResult {
  factCheckResult: string | null;
  biasResult: string | null;
  analyzedAt: string;
}

export const VerificationStatus = {
  NotVerified: 0,
  InProgress: 1,
  Verified: 2,
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export interface VerificationVerdict {
  assessment: string;
  confidence: ConfidenceLevel;
  citations: Citation[];
  verifiedAt: string;
}

export const ConfidenceLevel = {
  Low: 0,
  Medium: 1,
  High: 2,
} as const;
export type ConfidenceLevel = (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];

export interface Citation {
  source: string;
  url: string;
  excerpt: string;
}

export interface ArticleListResponse {
  articles: Article[];
  limit: number;
  offset: number;
}

// Job types
export interface JobInfo {
  jobKey: string;
  jobGroup: string;
  jobType: string;
  cronExpression: string;
  lastExecutionTime: string | null;
  nextExecutionTime: string | null;
  lastStatus: JobExecutionStatus | null;
  isPaused: boolean;
}

export const JobExecutionStatus = {
  Success: 0,
  Failed: 1,
  Cancelled: 2,
} as const;
export type JobExecutionStatus = (typeof JobExecutionStatus)[keyof typeof JobExecutionStatus];

export interface JobExecutionLog {
  id: string;
  jobKey: string;
  jobGroup: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: JobExecutionStatus;
  errorMessage: string | null;
  stackTrace: string | null;
  itemsProcessed: number;
}

// Feed types
export interface RssFeedConfig {
  id: string;
  name: string;
  url: string;
  cronExpression: string;
  isEnabled: boolean;
  maxRetries: number;
  misfireInstruction: MisfireInstruction;
  createdAt: string;
  lastFetchedAt: string | null;
}

export const MisfireInstruction = {
  FireNow: 0,
  DoNothing: 1,
  RescheduleNextWithRemainingCount: 2,
} as const;
export type MisfireInstruction = (typeof MisfireInstruction)[keyof typeof MisfireInstruction];

export interface CreateFeedRequest {
  name: string;
  url: string;
  cronExpression?: string;
  isEnabled?: boolean;
  maxRetries?: number;
  misfireInstruction?: MisfireInstruction;
}

export interface UpdateFeedRequest {
  name?: string;
  url?: string;
  cronExpression?: string;
  isEnabled?: boolean;
  maxRetries?: number;
  misfireInstruction?: MisfireInstruction;
}

// Config types
export interface SystemConfig {
  id: string;
  aiSettings: AiConfig;
  searchSettings: SearchConfig;
  cleanupSettings: CleanupConfig;
  featureFlags: Record<string, boolean>;
}

export interface AiConfig {
  modelString: string;
  temperature: number;
  maxContextTokens: number;
}

export interface SearchConfig {
  maxResults: number;
  timeoutSeconds: number;
}

export interface CleanupConfig {
  retentionDays: number;
}

export interface UpdateConfigRequest {
  aiSettings?: AiConfig;
  searchSettings?: SearchConfig;
}

export interface FeatureFlagResponse {
  key: string;
  enabled: boolean;
}

// Agent step types for streaming verification
export interface AgentStepEvent {
  type: 'Thought' | 'Action' | 'Observation' | 'FinalAnswer' | 'error';
  content: string;
  timestamp: string;
}

// Analysis types for fact-checking and bias detection
export interface AnalysisStepEvent {
  type: 'Thought' | 'Action' | 'Observation' | 'result' | 'error';
  content: string;
  timestamp: string;
  panel: 'factcheck' | 'bias';
}

export interface FactCheckResult {
  status: 'verified' | 'partially_verified' | 'unverified' | 'misleading';
  summary: string;
  claims: ClaimCheck[];
  sources: SourceReference[];
}

export interface ClaimCheck {
  claim: string;
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable';
  explanation: string;
  sources: string[];
}

export interface SourceReference {
  title: string;
  url: string;
  relevance: string;
  publishedDate?: string;
}

export type BiasLevel = 'far_left' | 'left' | 'center_left' | 'center' | 'center_right' | 'right' | 'far_right';

export interface BiasAnalysisResult {
  overallBias: BiasLevel;
  confidence: number;
  indicators: BiasIndicator[];
  context: string;
  regionalContext?: string; // Specific context for Indian news
}

export interface BiasIndicator {
  type: 'language' | 'framing' | 'source_selection' | 'omission' | 'emotional_appeal';
  description: string;
  severity: 'low' | 'medium' | 'high';
  leaning: 'left' | 'right' | 'neutral';
}
