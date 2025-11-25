using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// Repository interface for job execution log persistence.
/// </summary>
public interface IJobExecutionLogRepository
{
    Task LogExecutionAsync(JobExecutionLog log);
    Task<IEnumerable<JobExecutionLog>> GetByJobKeyAsync(string jobKey, int limit = 50);
    Task<JobExecutionLog?> GetLatestByJobKeyAsync(string jobKey);
    Task<IEnumerable<JobExecutionLog>> GetByDateRangeAsync(DateTime startDate, DateTime endDate, string? jobGroup = null);
}
