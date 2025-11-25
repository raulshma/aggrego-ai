using AggregoAi.ApiService.Repositories;
using Quartz;
using Quartz.Impl.Matchers;
using MisfireInstruction = AggregoAi.ApiService.Models.MisfireInstruction;
using JobInfo = AggregoAi.ApiService.Models.JobInfo;
using JobExecutionLog = AggregoAi.ApiService.Models.JobExecutionLog;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Implementation of job management service for Admin UI.
/// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
/// </summary>
public class JobManagementService : IJobManagementService
{
    private readonly ISchedulerFactory _schedulerFactory;
    private readonly IJobPersistenceService _persistenceService;
    private readonly IJobExecutionLogRepository _logRepository;
    private readonly ILogger<JobManagementService> _logger;

    public JobManagementService(
        ISchedulerFactory schedulerFactory,
        IJobPersistenceService persistenceService,
        IJobExecutionLogRepository logRepository,
        ILogger<JobManagementService> logger)
    {
        _schedulerFactory = schedulerFactory;
        _persistenceService = persistenceService;
        _logRepository = logRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<JobInfo>> GetAllJobsAsync()
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var jobInfos = new List<JobInfo>();

        // Get all job groups
        var jobGroups = await scheduler.GetJobGroupNames();

        foreach (var group in jobGroups)
        {
            var jobKeys = await scheduler.GetJobKeys(GroupMatcher<JobKey>.GroupEquals(group));

            foreach (var jobKey in jobKeys)
            {
                var jobInfo = await GetJobInfoAsync(scheduler, jobKey);
                if (jobInfo != null)
                {
                    jobInfos.Add(jobInfo);
                }
            }
        }

        return jobInfos;
    }


    public async Task<JobInfo?> GetJobAsync(string jobKey, string jobGroup)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var key = new JobKey(jobKey, jobGroup);

        if (!await scheduler.CheckExists(key))
        {
            return null;
        }

        return await GetJobInfoAsync(scheduler, key);
    }

    public async Task<bool> PauseJobAsync(string jobKey, string jobGroup)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var key = new JobKey(jobKey, jobGroup);

        if (!await scheduler.CheckExists(key))
        {
            _logger.LogWarning("Job {JobKey} not found for pause", key);
            return false;
        }

        // Pause all triggers for this job
        var triggers = await scheduler.GetTriggersOfJob(key);
        foreach (var trigger in triggers)
        {
            await scheduler.PauseTrigger(trigger.Key);
        }

        // Update persistence
        await _persistenceService.UpdatePauseStateAsync(jobKey, jobGroup, true);

        _logger.LogInformation("Paused job {JobKey}", key);
        return true;
    }

    public async Task<bool> ResumeJobAsync(string jobKey, string jobGroup)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var key = new JobKey(jobKey, jobGroup);

        if (!await scheduler.CheckExists(key))
        {
            _logger.LogWarning("Job {JobKey} not found for resume", key);
            return false;
        }

        // Resume all triggers for this job
        var triggers = await scheduler.GetTriggersOfJob(key);
        foreach (var trigger in triggers)
        {
            await scheduler.ResumeTrigger(trigger.Key);
        }

        // Update persistence
        await _persistenceService.UpdatePauseStateAsync(jobKey, jobGroup, false);

        _logger.LogInformation("Resumed job {JobKey}", key);
        return true;
    }


    public async Task<bool> TriggerJobAsync(string jobKey, string jobGroup)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var key = new JobKey(jobKey, jobGroup);

        if (!await scheduler.CheckExists(key))
        {
            _logger.LogWarning("Job {JobKey} not found for trigger", key);
            return false;
        }

        await scheduler.TriggerJob(key);

        _logger.LogInformation("Triggered immediate execution of job {JobKey}", key);
        return true;
    }

    public async Task<bool> RescheduleJobAsync(string jobKey, string jobGroup, string cronExpression)
    {
        var scheduler = await _schedulerFactory.GetScheduler();
        var key = new JobKey(jobKey, jobGroup);

        if (!await scheduler.CheckExists(key))
        {
            _logger.LogWarning("Job {JobKey} not found for reschedule", key);
            return false;
        }

        // Get existing triggers
        var triggers = await scheduler.GetTriggersOfJob(key);
        if (!triggers.Any())
        {
            _logger.LogWarning("No triggers found for job {JobKey}", key);
            return false;
        }

        // Get the persisted definition to preserve misfire instruction
        var definition = await _persistenceService.GetJobDefinitionAsync(jobKey, jobGroup);
        var misfireInstruction = definition?.MisfireInstruction ?? MisfireInstruction.FireNow;

        // Create new trigger with updated CRON
        var oldTrigger = triggers.First();
        var newTrigger = TriggerBuilder.Create()
            .WithIdentity(oldTrigger.Key)
            .ForJob(key)
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
            })
            .Build();

        await scheduler.RescheduleJob(oldTrigger.Key, newTrigger);

        // Update persistence
        if (definition != null)
        {
            await _persistenceService.UpdateJobDefinitionAsync(definition with { CronExpression = cronExpression });
        }

        _logger.LogInformation("Rescheduled job {JobKey} with new CRON: {Cron}", key, cronExpression);
        return true;
    }


    public async Task<IEnumerable<JobExecutionLog>> GetExecutionHistoryAsync(string jobKey, int limit = 50)
    {
        return await _logRepository.GetByJobKeyAsync(jobKey, limit);
    }

    private async Task<JobInfo?> GetJobInfoAsync(IScheduler scheduler, JobKey jobKey)
    {
        var jobDetail = await scheduler.GetJobDetail(jobKey);
        if (jobDetail == null)
        {
            return null;
        }

        var triggers = await scheduler.GetTriggersOfJob(jobKey);
        var trigger = triggers.FirstOrDefault();

        // Get persisted info for last execution details
        var persistedDef = await _persistenceService.GetJobDefinitionAsync(jobKey.Name, jobKey.Group);

        // Determine if paused
        var isPaused = false;
        if (trigger != null)
        {
            var triggerState = await scheduler.GetTriggerState(trigger.Key);
            isPaused = triggerState == TriggerState.Paused;
        }

        // Get CRON expression
        var cronExpression = "";
        if (trigger is ICronTrigger cronTrigger)
        {
            cronExpression = cronTrigger.CronExpressionString ?? "";
        }

        // Get job type name
        var jobType = jobDetail.JobType.Name;

        return new JobInfo(
            JobKey: jobKey.Name,
            JobGroup: jobKey.Group,
            JobType: jobType,
            CronExpression: cronExpression,
            LastExecutionTime: persistedDef?.LastExecutionTime,
            NextExecutionTime: trigger?.GetNextFireTimeUtc()?.DateTime,
            LastStatus: persistedDef?.LastStatus,
            IsPaused: isPaused
        );
    }
}
