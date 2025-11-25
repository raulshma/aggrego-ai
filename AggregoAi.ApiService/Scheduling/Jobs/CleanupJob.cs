using AggregoAi.ApiService.Repositories;
using Quartz;

namespace AggregoAi.ApiService.Scheduling.Jobs;

/// <summary>
/// Quartz job that removes articles older than the retention period.
/// Requirements: 8.1
/// </summary>
[DisallowConcurrentExecution]
public class CleanupJob : IJob
{
    public const string RetentionDaysKey = "RetentionDays";

    private readonly IArticleRepository _articleRepository;
    private readonly ILogger<CleanupJob> _logger;

    public CleanupJob(
        IArticleRepository articleRepository,
        ILogger<CleanupJob> logger)
    {
        _articleRepository = articleRepository;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var retentionDays = context.MergedJobDataMap.GetInt(RetentionDaysKey);
        if (retentionDays <= 0)
        {
            retentionDays = 30; // Default to 30 days
        }

        var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);

        _logger.LogInformation("Starting cleanup job. Removing articles older than {CutoffDate}", cutoffDate);

        try
        {
            var deletedCount = await _articleRepository.DeleteOlderThanAsync(cutoffDate);
            context.Put("ItemsProcessed", deletedCount);

            _logger.LogInformation("Cleanup complete. Deleted {Count} articles older than {Days} days",
                deletedCount, retentionDays);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during cleanup job");
            throw new JobExecutionException($"Cleanup failed: {ex.Message}", ex);
        }
    }
}
