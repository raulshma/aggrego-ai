using AggregoAi.ApiService.Scheduling.Jobs;
using Quartz;
using MisfireInstruction = AggregoAi.ApiService.Models.MisfireInstruction;
using RssFeedConfig = AggregoAi.ApiService.Models.RssFeedConfig;
using CleanupConfig = AggregoAi.ApiService.Models.CleanupConfig;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Factory for creating and scheduling Quartz jobs.
/// Requirements: 1.1, 1.5
/// </summary>
public class QuartzJobFactory : IJobFactory
{
    private readonly ISchedulerFactory _schedulerFactory;
    private readonly IJobPersistenceService _persistenceService;
    private readonly ILogger<QuartzJobFactory> _logger;

    public const string IngestionJobGroup = "IngestionJobs";
    public const string MaintenanceJobGroup = "MaintenanceJobs";

    public QuartzJobFactory(
        ISchedulerFactory schedulerFactory,
        IJobPersistenceService persistenceService,
        ILogger<QuartzJobFactory> logger)
    {
        _schedulerFactory = schedulerFactory;
        _persistenceService = persistenceService;
        _logger = logger;
    }

    public Task<(IJobDetail Job, ITrigger Trigger)> CreateIngestionJobAsync(RssFeedConfig feed)
    {
        var jobKey = new JobKey($"ingestion-{feed.Id}", IngestionJobGroup);

        var job = JobBuilder.Create<IngestionJob>()
            .WithIdentity(jobKey)
            .WithDescription($"Ingestion job for feed: {feed.Name}")
            .UsingJobData(IngestionJob.FeedIdKey, feed.Id)
            .UsingJobData(IngestionJob.FeedUrlKey, feed.Url)
            .UsingJobData(IngestionJob.FeedNameKey, feed.Name)
            .UsingJobData(RetryJobListener.MaxRetriesKey, feed.MaxRetries)
            .UsingJobData(RetryJobListener.RetryCountKey, 0)
            .UsingJobData(RetryJobListener.BaseDelaySecondsKey, 1) // 1s base delay for exponential backoff
            .StoreDurably()
            .Build();

        var trigger = CreateTrigger(jobKey, feed.CronExpression, feed.MisfireInstruction);

        return Task.FromResult((job, trigger));
    }


    public Task<(IJobDetail Job, ITrigger Trigger)> CreateCleanupJobAsync(CleanupConfig config, string cronExpression)
    {
        var jobKey = new JobKey("cleanup", MaintenanceJobGroup);

        var job = JobBuilder.Create<CleanupJob>()
            .WithIdentity(jobKey)
            .WithDescription("Cleanup job for removing old articles")
            .UsingJobData(CleanupJob.RetentionDaysKey, config.RetentionDays)
            .StoreDurably()
            .Build();

        var trigger = CreateTrigger(jobKey, cronExpression, MisfireInstruction.DoNothing);

        return Task.FromResult((job, trigger));
    }

    public Task<(IJobDetail Job, ITrigger Trigger)> CreateAnalyticsJobAsync(string cronExpression)
    {
        var jobKey = new JobKey("analytics", MaintenanceJobGroup);

        var job = JobBuilder.Create<AnalyticsJob>()
            .WithIdentity(jobKey)
            .WithDescription("Analytics aggregation job")
            .StoreDurably()
            .Build();

        var trigger = CreateTrigger(jobKey, cronExpression, MisfireInstruction.DoNothing);

        return Task.FromResult((job, trigger));
    }

    public Task<(IJobDetail Job, ITrigger Trigger)> CreateSmartTaggingJobAsync(int batchSize, string cronExpression)
    {
        var jobKey = new JobKey("smart-tagging", MaintenanceJobGroup);

        var job = JobBuilder.Create<SmartTaggingJob>()
            .WithIdentity(jobKey)
            .WithDescription("Smart tagging job for AI-based article categorization")
            .UsingJobData(SmartTaggingJob.BatchSizeKey, batchSize)
            .StoreDurably()
            .Build();

        var trigger = CreateTrigger(jobKey, cronExpression, MisfireInstruction.DoNothing);

        return Task.FromResult((job, trigger));
    }


    public async Task ScheduleJobAsync(IJobDetail job, ITrigger trigger, PersistedJobDefinition definition)
    {
        var scheduler = await _schedulerFactory.GetScheduler();

        // Check if job already exists
        if (await scheduler.CheckExists(job.Key))
        {
            _logger.LogInformation("Job {JobKey} already exists, rescheduling", job.Key);
            await scheduler.DeleteJob(job.Key);
        }

        // Schedule the job
        await scheduler.ScheduleJob(job, trigger);

        // Persist the job definition
        var existingDef = await _persistenceService.GetJobDefinitionAsync(definition.JobKey, definition.JobGroup);
        if (existingDef == null)
        {
            await _persistenceService.SaveJobDefinitionAsync(definition);
        }
        else
        {
            await _persistenceService.UpdateJobDefinitionAsync(definition with { Id = existingDef.Id });
        }

        _logger.LogInformation("Scheduled job {JobKey} with CRON {Cron}", job.Key, definition.CronExpression);
    }

    public async Task RestorePersistedJobsAsync()
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var persistedJobs = await _persistenceService.GetAllJobDefinitionsAsync();

        foreach (var definition in persistedJobs)
        {
            try
            {
                var jobType = GetJobType(definition.JobType);
                if (jobType == null)
                {
                    _logger.LogWarning("Unknown job type {JobType} for job {JobKey}", definition.JobType, definition.JobKey);
                    continue;
                }

                var jobKey = new JobKey(definition.JobKey, definition.JobGroup);

                // Skip if job already exists
                if (await scheduler.CheckExists(jobKey))
                {
                    _logger.LogDebug("Job {JobKey} already exists, skipping restore", jobKey);
                    continue;
                }

                var jobBuilder = JobBuilder.Create(jobType)
                    .WithIdentity(jobKey)
                    .StoreDurably();

                // Restore job data
                foreach (var kvp in definition.JobData)
                {
                    jobBuilder.UsingJobData(kvp.Key, kvp.Value);
                }

                var job = jobBuilder.Build();
                var trigger = CreateTrigger(jobKey, definition.CronExpression, definition.MisfireInstruction);

                await scheduler.ScheduleJob(job, trigger);

                // Restore pause state
                if (definition.IsPaused)
                {
                    await scheduler.PauseTrigger(trigger.Key);
                }

                _logger.LogInformation("Restored job {JobKey} from persistence", jobKey);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to restore job {JobKey}", definition.JobKey);
            }
        }
    }


    private static ITrigger CreateTrigger(JobKey jobKey, string cronExpression, MisfireInstruction misfireInstruction)
    {
        var triggerBuilder = TriggerBuilder.Create()
            .WithIdentity($"{jobKey.Name}-trigger", jobKey.Group)
            .ForJob(jobKey)
            .WithCronSchedule(cronExpression, x =>
            {
                switch (misfireInstruction)
                {
                    case MisfireInstruction.FireNow:
                        x.WithMisfireHandlingInstructionFireAndProceed();
                        break;
                    case MisfireInstruction.DoNothing:
                        x.WithMisfireHandlingInstructionDoNothing();
                        break;
                    case MisfireInstruction.RescheduleNextWithRemainingCount:
                        x.WithMisfireHandlingInstructionIgnoreMisfires();
                        break;
                }
            });

        return triggerBuilder.Build();
    }

    private static Type? GetJobType(string jobTypeName)
    {
        return jobTypeName switch
        {
            nameof(IngestionJob) => typeof(IngestionJob),
            nameof(CleanupJob) => typeof(CleanupJob),
            nameof(AnalyticsJob) => typeof(AnalyticsJob),
            nameof(SmartTaggingJob) => typeof(SmartTaggingJob),
            _ => null
        };
    }
}
