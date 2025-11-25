namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Hosted service that restores persisted jobs on application startup.
/// Requirements: 2.1, 2.2, 2.3
/// </summary>
public class JobRestoreHostedService : IHostedService
{
    private readonly IJobFactory _jobFactory;
    private readonly ILogger<JobRestoreHostedService> _logger;

    public JobRestoreHostedService(
        IJobFactory jobFactory,
        ILogger<JobRestoreHostedService> logger)
    {
        _jobFactory = jobFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Restoring persisted jobs from MongoDB...");

        try
        {
            await _jobFactory.RestorePersistedJobsAsync();
            _logger.LogInformation("Job restoration complete");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to restore persisted jobs");
            // Don't throw - allow the application to start even if job restoration fails
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
