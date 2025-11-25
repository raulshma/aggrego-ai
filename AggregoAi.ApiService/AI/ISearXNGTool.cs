namespace AggregoAi.ApiService.AI;

/// <summary>
/// Tool interface for querying SearXNG meta-search engine.
/// </summary>
public interface ISearXNGTool
{
    /// <summary>
    /// Searches SearXNG for the given query.
    /// </summary>
    /// <param name="query">The search query.</param>
    /// <param name="maxResults">Maximum number of results to return (respects config limits).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Search results from SearXNG.</returns>
    Task<SearchResult> SearchAsync(string query, int? maxResults = null, CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents search results from SearXNG.
/// </summary>
public record SearchResult(
    IReadOnlyList<SearchResultItem> Items,
    string Query,
    int TotalResults
);

/// <summary>
/// Represents a single search result item.
/// </summary>
public record SearchResultItem(
    string Title,
    string Url,
    string Content,
    string? Engine
);
