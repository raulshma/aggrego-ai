namespace AggregoAi.ApiService.Models;

/// <summary>
/// Information about a scheduled job for the Admin UI.
/// </summary>
public record JobInfo(
    string JobKey,
    string JobGroup,
    string JobType,
    string CronExpression,
    DateTime? LastExecutionTime,
    DateTime? NextExecutionTime,
    JobExecutionStatus? LastStatus,
    bool IsPaused
);
