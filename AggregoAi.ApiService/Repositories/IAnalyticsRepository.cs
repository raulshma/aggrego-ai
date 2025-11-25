using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// Repository interface for analytics metrics persistence.
/// Requirements: 8.2
/// </summary>
public interface IAnalyticsRepository
{
    /// <summary>
    /// Gets analytics for a specific date.
    /// </summary>
    Task<DailyAnalytics?> GetByDateAsync(DateTime date);

    /// <summary>
    /// Gets analytics for a date range.
    /// </summary>
    Task<IEnumerable<DailyAnalytics>> GetByDateRangeAsync(DateTime startDate, DateTime endDate);

    /// <summary>
    /// Creates or updates analytics for a specific date.
    /// </summary>
    Task<DailyAnalytics> UpsertAsync(DailyAnalytics analytics);

    /// <summary>
    /// Gets the most recent analytics records.
    /// </summary>
    Task<IEnumerable<DailyAnalytics>> GetRecentAsync(int days);
}
