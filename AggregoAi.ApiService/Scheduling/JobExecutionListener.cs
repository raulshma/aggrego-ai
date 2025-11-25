using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Quartz;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Quartz job listener that logs job executions to MongoDB.
/// Requirements: 2.4, 3.6, 8.4
/// </summary>
public class JobExecutionListener : IJobListener
{
    private readonly IJobExecutionLogRepository _logRepository;
    private readonly IJobPersistenceService _persistenceService;
    private readonly ILogger<JobExecutionListener> _logger;

    public string Name => "JobExecutionListener";

    public JobExecutionListener(
        IJobExecutionLogRepository logRepository,
        IJobPersistenceService persistenceService,
        ILogger<JobExecutionListener> logger)
    {
        _logRepository = logRepository;
        _persistenceService = persistenceService;
        _logger = logger;
    }

    public Task JobToBeExecuted(IJobExecutionContext context, CancellationToken cancellationToken = default)
    {
        context.Put("StartTime", DateTime.UtcNow);
        _logger.LogInformation("Job {JobKey} starting execution", context.JobDetail.Key);
        return Task.CompletedTask;
    }

    public Task JobExecutionVetoed(IJobExecutionContext context, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("Job {JobKey} execution was vetoed", context.JobDetail.Key);
        return Task.CompletedTask;
    }

    public async Task JobWasExecuted(
        IJobExecutionContext context,
        JobExecutionException? jobException,
        CancellationToken cancellationToken = default)
    {
        var startTime = context.Get("StartTime") as DateTime? ?? context.FireTimeUtc.DateTime;
        var endTime = DateTime.UtcNow;
        var duration = endTime - startTime;

        var status = jobException == null ? JobExecutionStatus.Success : JobExecutionStatus.Failed;
        var itemsProcessed = context.Get("ItemsProcessed") as int? ?? 0;

        var log = new JobExecutionLog
        {
            JobKey = context.JobDetail.Key.Name,
            JobGroup = context.JobDetail.Key.Group,
            StartTime = startTime,
            EndTime = endTime,
            Duration = duration,
            Status = status,
            ErrorMessage = jobException?.Message,
            StackTrace = jobException?.StackTrace,
            ItemsProcessed = itemsProcessed
        };

        try
        {
            await _logRepository.LogExecutionAsync(log);

            // Update persisted job definition with last execution info
            await _persistenceService.UpdateLastExecutionAsync(
                context.JobDetail.Key.Name,
                context.JobDetail.Key.Group,
                endTime,
                status);

            _logger.LogInformation(
                "Job {JobKey} completed with status {Status} in {Duration}ms",
                context.JobDetail.Key,
                status,
                duration.TotalMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to log job execution for {JobKey}", context.JobDetail.Key);
        }
    }
}
