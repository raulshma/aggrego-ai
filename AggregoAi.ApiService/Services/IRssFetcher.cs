namespace AggregoAi.ApiService.Services;

/// <summary>
/// Result of fetching RSS content from a URL.
/// </summary>
public record FetchResult(
    bool IsSuccess,
    string? Content,
    string? ErrorMessage,
    int? StatusCode
);

/// <summary>
/// Interface for fetching RSS XML content from URLs.
/// </summary>
public interface IRssFetcher
{
    /// <summary>
    /// Fetches RSS XML content from the specified URL.
    /// </summary>
    /// <param name="url">The URL of the RSS feed.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A FetchResult containing the content or error information.</returns>
    Task<FetchResult> FetchAsync(string url, CancellationToken cancellationToken = default);
}
