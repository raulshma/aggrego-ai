using AggregoAi.ApiService.Models;
using Quartz;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Factory for creating Quartz job definitions.
/// Requirements: 1.1, 1.5
/// </summary>
public interface IJobFactory
{
    /// <summary>
    /// Creates an ingestion job for an RSS feed.
    /// </summary>
    Task<(IJobDetail Job, ITrigger Trigger)> CreateIngestionJobAsync(RssFeedConfig feed);

    /// <summary>
    /// Creates a cleanup job for removing old articles.
    /// </summary>
    Task<(IJobDetail Job, ITrigger Trigger)> CreateCleanupJobAsync(CleanupConfig config, string cronExpression);

    /// <summary>
    /// Creates an analytics job for aggregating metrics.
    /// </summary>
    Task<(IJobDetail Job, ITrigger Trigger)> CreateAnalyticsJobAsync(string cronExpression);

    /// <summary>
    /// Creates a smart tagging job for AI-based article categorization.
    /// </summary>
    Task<(IJobDetail Job, ITrigger Trigger)> CreateSmartTaggingJobAsync(int batchSize, string cronExpression);

    /// <summary>
    /// Schedules a job with the Quartz scheduler and persists it to MongoDB.
    /// </summary>
    Task ScheduleJobAsync(IJobDetail job, ITrigger trigger, PersistedJobDefinition definition);

    /// <summary>
    /// Restores all persisted jobs on application startup.
    /// </summary>
    Task RestorePersistedJobsAsync();
}
