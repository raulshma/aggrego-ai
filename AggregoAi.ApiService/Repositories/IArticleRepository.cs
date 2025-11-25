using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// Repository interface for Article persistence operations.
/// </summary>
public interface IArticleRepository
{
    Task<Article?> GetByIdAsync(string id);
    Task<IEnumerable<Article>> GetByFeedAsync(string feedId, int limit, int offset);
    Task<IEnumerable<Article>> GetRecentAsync(int limit, bool includeHidden = false);
    Task<bool> ExistsByUrlAsync(string url);
    Task<Article> CreateAsync(Article article);
    Task<Article?> UpdateAsync(Article article);
    Task<bool> DeleteAsync(string id);
    Task<int> DeleteManyAsync(IEnumerable<string> ids);
    Task<int> DeleteOlderThanAsync(DateTime cutoffDate);
    Task<bool> SetHiddenAsync(string id, bool isHidden);
    Task<int> SetHiddenManyAsync(IEnumerable<string> ids, bool isHidden);
    Task<IEnumerable<Article>> GetUntaggedAsync(int batchSize);
    Task UpdateTagsAsync(string id, IEnumerable<string> tags);
    Task UpdateVerificationAsync(string id, VerificationStatus status, VerificationVerdict? verdict);
    Task UpdateAnalysisResultAsync(string id, ArticleAnalysisResult result);
}
