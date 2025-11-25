using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// Repository interface for Article persistence operations.
/// </summary>
public interface IArticleRepository
{
    Task<Article?> GetByIdAsync(string id);
    Task<IEnumerable<Article>> GetByFeedAsync(string feedId, int limit, int offset);
    Task<IEnumerable<Article>> GetRecentAsync(int limit);
    Task<bool> ExistsByUrlAsync(string url);
    Task<Article> CreateAsync(Article article);
    Task<Article?> UpdateAsync(Article article);
    Task<bool> DeleteAsync(string id);
    Task<int> DeleteOlderThanAsync(DateTime cutoffDate);
    Task<IEnumerable<Article>> GetUntaggedAsync(int batchSize);
    Task UpdateTagsAsync(string id, IEnumerable<string> tags);
    Task UpdateVerificationAsync(string id, VerificationStatus status, VerificationVerdict? verdict);
}
