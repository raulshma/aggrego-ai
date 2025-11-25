using System.Net;

namespace AggregoAi.ApiService.Services;

/// <summary>
/// Implementation of IRssFetcher using HttpClient.
/// Handles HTTP errors and timeouts gracefully.
/// </summary>
public class RssFetcher : IRssFetcher
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<RssFetcher> _logger;
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    public RssFetcher(HttpClient httpClient, ILogger<RssFetcher> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        
        // Set default timeout if not already configured
        if (_httpClient.Timeout == TimeSpan.Zero || _httpClient.Timeout == Timeout.InfiniteTimeSpan)
        {
            _httpClient.Timeout = DefaultTimeout;
        }
    }

    public async Task<FetchResult> FetchAsync(string url, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return new FetchResult(false, null, "URL cannot be null or empty", null);
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || 
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return new FetchResult(false, null, $"Invalid URL format: {url}", null);
        }

        try
        {
            _logger.LogInformation("Fetching RSS feed from {Url}", url);

            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Add("Accept", "application/rss+xml, application/xml, text/xml, application/atom+xml");
            request.Headers.Add("User-Agent", "AggregoAi RSS Fetcher/1.0");

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            
            var statusCode = (int)response.StatusCode;

            if (!response.IsSuccessStatusCode)
            {
                var errorMessage = response.StatusCode switch
                {
                    HttpStatusCode.NotFound => $"RSS feed not found at {url}",
                    HttpStatusCode.Unauthorized => $"Unauthorized access to RSS feed at {url}",
                    HttpStatusCode.Forbidden => $"Access forbidden to RSS feed at {url}",
                    HttpStatusCode.ServiceUnavailable => $"RSS feed service unavailable at {url}",
                    HttpStatusCode.InternalServerError => $"Server error fetching RSS feed from {url}",
                    _ => $"HTTP error {statusCode} fetching RSS feed from {url}"
                };

                _logger.LogWarning("Failed to fetch RSS feed from {Url}: {StatusCode} - {Error}", 
                    url, statusCode, errorMessage);
                
                return new FetchResult(false, null, errorMessage, statusCode);
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            
            if (string.IsNullOrWhiteSpace(content))
            {
                _logger.LogWarning("Empty content received from RSS feed at {Url}", url);
                return new FetchResult(false, null, "Empty content received from RSS feed", statusCode);
            }

            _logger.LogInformation("Successfully fetched RSS feed from {Url}, content length: {Length}", 
                url, content.Length);
            
            return new FetchResult(true, content, null, statusCode);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException || !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Timeout fetching RSS feed from {Url}", url);
            return new FetchResult(false, null, $"Timeout fetching RSS feed from {url}", null);
        }
        catch (TaskCanceledException)
        {
            _logger.LogInformation("RSS fetch cancelled for {Url}", url);
            throw; // Re-throw cancellation
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP request error fetching RSS feed from {Url}", url);
            return new FetchResult(false, null, $"HTTP request error: {ex.Message}", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error fetching RSS feed from {Url}", url);
            return new FetchResult(false, null, $"Unexpected error: {ex.Message}", null);
        }
    }
}
