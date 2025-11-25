using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Quartz;

namespace AggregoAi.ApiService.Scheduling.Jobs;

/// <summary>
/// Quartz job that aggregates daily AI token usage and performance metrics.
/// Requirements: 8.2
/// </summary>
[DisallowConcurrentExecution]
public class AnalyticsJob : IJob
{
    private readonly IAnalyticsRepository _analyticsRepository;
    private readonly IJobExecutionLogRepository _jobLogRepository;
    private readonly IArticleRepository _articleRepository;
    private readonly ILogger<AnalyticsJob> _logger;

    public AnalyticsJob(
        IAnalyticsRepository analyticsRepository,
        IJobExecutionLogRepository jobLogRepository,
        IArticleRepository articleRepository,
        ILogger<AnalyticsJob> logger)
    {
        _analyticsRepository = analyticsRepository;
        _jobLogRepository = jobLogRepository;
        _articleRepository = articleRepository;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("Starting analytics aggregation job");

        try
        {
            var today = DateTime.UtcNow.Date;

            // Aggregate ingestion metrics from job execution logs
            var ingestionMetrics = await AggregateIngestionMetricsAsync(today);

            // Aggregate verification metrics from articles
            var verificationMetrics = await AggregateVerificationMetricsAsync(today);

            // Token usage will be populated when AI services are integrated
            // For now, we create placeholder metrics
            var tokenUsage = new TokenUsageMetrics
            {
                TotalPromptTokens = 0,
                TotalCompletionTokens = 0,
                TotalTokens = 0,
                EstimatedCost = 0
            };

            var dailyAnalytics = new DailyAnalytics
            {
                Date = today,
                TokenUsage = tokenUsage,
                VerificationMetrics = verificationMetrics,
                IngestionMetrics = ingestionMetrics
            };

            await _analyticsRepository.UpsertAsync(dailyAnalytics);

            context.Put("ItemsProcessed", 1);
            _logger.LogInformation(
                "Analytics aggregation complete. Ingested: {Ingested}, Verified: {Verified}",
                ingestionMetrics.TotalArticlesIngested,
                verificationMetrics.TotalVerifications);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during analytics job");
            throw new JobExecutionException($"Analytics aggregation failed: {ex.Message}", ex);
        }
    }

    private async Task<IngestionMetrics> AggregateIngestionMetricsAsync(DateTime date)
    {
        // Get all ingestion job logs for today
        var logs = await _jobLogRepository.GetByDateRangeAsync(
            date,
            date.AddDays(1),
            "IngestionJobs");

        var totalIngested = logs
            .Where(l => l.Status == JobExecutionStatus.Success)
            .Sum(l => l.ItemsProcessed);

        var totalFeeds = logs
            .Where(l => l.Status == JobExecutionStatus.Success)
            .Select(l => l.JobKey)
            .Distinct()
            .Count();

        var parseErrors = logs
            .Where(l => l.Status == JobExecutionStatus.Failed)
            .Count();

        return new IngestionMetrics
        {
            TotalArticlesIngested = totalIngested,
            TotalFeedsProcessed = totalFeeds,
            DuplicatesSkipped = 0, // Would need to track this separately
            ParseErrors = parseErrors
        };
    }

    private async Task<VerificationMetrics> AggregateVerificationMetricsAsync(DateTime date)
    {
        // Get articles verified today
        var recentArticles = await _articleRepository.GetRecentAsync(1000);
        var verifiedToday = recentArticles
            .Where(a => a.VerificationStatus == VerificationStatus.Verified &&
                       a.Verdict?.VerifiedAt.Date == date)
            .ToList();

        return new VerificationMetrics
        {
            TotalVerifications = verifiedToday.Count,
            SuccessfulVerifications = verifiedToday.Count,
            FailedVerifications = 0,
            AverageVerificationTimeMs = 0 // Would need to track this separately
        };
    }
}
