using Quartz;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Quartz job listener that implements exponential backoff retry logic.
/// Requirements: 1.3
/// </summary>
public class RetryJobListener : IJobListener
{
    public const string RetryCountKey = "RetryCount";
    public const string MaxRetriesKey = "MaxRetries";
    public const string BaseDelaySecondsKey = "BaseDelaySeconds";

    private const int DefaultMaxRetries = 5;
    private const int DefaultBaseDelaySeconds = 1;

    private readonly ISchedulerFactory _schedulerFactory;
    private readonly ILogger<RetryJobListener> _logger;

    public string Name => "RetryJobListener";

    public RetryJobListener(
        ISchedulerFactory schedulerFactory,
        ILogger<RetryJobListener> logger)
    {
        _schedulerFactory = schedulerFactory;
        _logger = logger;
    }

    public Task JobToBeExecuted(IJobExecutionContext context, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task JobExecutionVetoed(IJobExecutionContext context, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public async Task JobWasExecuted(
        IJobExecutionContext context,
        JobExecutionException? jobException,
        CancellationToken cancellationToken = default)
    {
        if (jobException == null)
        {
            // Job succeeded, reset retry count if present
            if (context.JobDetail.JobDataMap.ContainsKey(RetryCountKey))
            {
                context.JobDetail.JobDataMap.Put(RetryCountKey, 0);
            }
            return;
        }

        var currentRetryCount = context.JobDetail.JobDataMap.GetInt(RetryCountKey);
        var maxRetries = context.JobDetail.JobDataMap.ContainsKey(MaxRetriesKey)
            ? context.JobDetail.JobDataMap.GetInt(MaxRetriesKey)
            : DefaultMaxRetries;
        var baseDelaySeconds = context.JobDetail.JobDataMap.ContainsKey(BaseDelaySecondsKey)
            ? context.JobDetail.JobDataMap.GetInt(BaseDelaySecondsKey)
            : DefaultBaseDelaySeconds;

        if (currentRetryCount >= maxRetries)
        {
            _logger.LogError(
                "Job {JobKey} has exceeded maximum retry count ({MaxRetries}). No more retries.",
                context.JobDetail.Key,
                maxRetries);
            return;
        }

        // Calculate exponential backoff delay: baseDelay * 2^retryCount
        var delaySeconds = CalculateBackoffDelay(baseDelaySeconds, currentRetryCount);
        var nextRetryTime = DateTimeOffset.UtcNow.AddSeconds(delaySeconds);

        _logger.LogWarning(
            "Job {JobKey} failed (attempt {Attempt}/{MaxRetries}). Scheduling retry in {Delay} seconds.",
            context.JobDetail.Key,
            currentRetryCount + 1,
            maxRetries,
            delaySeconds);

        try
        {
            var scheduler = await _schedulerFactory.GetScheduler(cancellationToken);

            // Update retry count in job data
            var newJobData = new JobDataMap();
            foreach (var key in context.JobDetail.JobDataMap.Keys)
            {
                newJobData.Put(key, context.JobDetail.JobDataMap[key]);
            }
            newJobData.Put(RetryCountKey, currentRetryCount + 1);

            // Create a one-time trigger for the retry
            var retryTrigger = TriggerBuilder.Create()
                .WithIdentity($"{context.Trigger.Key.Name}_retry_{currentRetryCount + 1}", context.Trigger.Key.Group)
                .ForJob(context.JobDetail.Key)
                .UsingJobData(newJobData)
                .StartAt(nextRetryTime)
                .Build();

            // Update the job with new retry count
            var updatedJob = context.JobDetail.GetJobBuilder()
                .UsingJobData(newJobData)
                .Build();

            await scheduler.AddJob(updatedJob, true, cancellationToken);
            await scheduler.ScheduleJob(retryTrigger, cancellationToken);

            _logger.LogInformation(
                "Retry scheduled for job {JobKey} at {RetryTime}",
                context.JobDetail.Key,
                nextRetryTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule retry for job {JobKey}", context.JobDetail.Key);
        }
    }

    /// <summary>
    /// Calculates exponential backoff delay: baseDelay * 2^retryCount
    /// Results in delays of: 1s, 2s, 4s, 8s, 16s for default base delay
    /// </summary>
    public static int CalculateBackoffDelay(int baseDelaySeconds, int retryCount)
    {
        // Cap the exponent to prevent overflow
        var cappedRetryCount = Math.Min(retryCount, 10);
        return baseDelaySeconds * (int)Math.Pow(2, cappedRetryCount);
    }
}
