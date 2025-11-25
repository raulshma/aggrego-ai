using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Service for managing Quartz jobs through the Admin UI.
/// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
/// </summary>
public interface IJobManagementService
{
    /// <summary>
    /// Gets information about all registered jobs.
    /// </summary>
    Task<IEnumerable<JobInfo>> GetAllJobsAsync();

    /// <summary>
    /// Gets information about a specific job.
    /// </summary>
    Task<JobInfo?> GetJobAsync(string jobKey, string jobGroup);

    /// <summary>
    /// Pauses a job's trigger.
    /// </summary>
    Task<bool> PauseJobAsync(string jobKey, string jobGroup);

    /// <summary>
    /// Resumes a paused job's trigger.
    /// </summary>
    Task<bool> ResumeJobAsync(string jobKey, string jobGroup);

    /// <summary>
    /// Triggers a job to execute immediately.
    /// </summary>
    Task<bool> TriggerJobAsync(string jobKey, string jobGroup);

    /// <summary>
    /// Reschedules a job with a new CRON expression.
    /// </summary>
    Task<bool> RescheduleJobAsync(string jobKey, string jobGroup, string cronExpression);

    /// <summary>
    /// Gets execution history for a job.
    /// </summary>
    Task<IEnumerable<JobExecutionLog>> GetExecutionHistoryAsync(string jobKey, int limit = 50);
}
