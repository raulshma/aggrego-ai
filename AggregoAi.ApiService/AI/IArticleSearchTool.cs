using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Tool interface for searching articles in MongoDB.
/// Used by the ReAct agent to find similar articles for fact-checking.
/// </summary>
public interface IArticleSearchTool
{
    /// <summary>
    /// Finds articles similar to the given claim or topic.
    /// </summary>
    /// <param name="claim">The claim or topic to search for.</param>
    /// <param name="maxResults">Maximum number of results to return.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of similar articles.</returns>
    Task<IEnumerable<Article>> FindSimilarAsync(string claim, int maxResults = 10, CancellationToken cancellationToken = default);
}
