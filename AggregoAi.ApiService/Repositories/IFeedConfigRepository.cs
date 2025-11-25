using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// Repository interface for RSS feed configuration persistence.
/// </summary>
public interface IFeedConfigRepository
{
    Task<RssFeedConfig?> GetByIdAsync(string id);
    Task<IEnumerable<RssFeedConfig>> GetAllAsync();
    Task<RssFeedConfig> CreateAsync(RssFeedConfig config);
    Task<RssFeedConfig?> UpdateAsync(RssFeedConfig config);
    Task<bool> DeleteAsync(string id);
    Task UpdateLastFetchedAsync(string id, DateTime lastFetchedAt);
}
