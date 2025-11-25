using System.Text.Json;
using System.Text.Json.Serialization;
using AggregoAi.ApiService.Repositories;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Implementation of ISearXNGTool that queries the SearXNG container.
/// Respects configured max results from ISystemConfigRepository.
/// </summary>
public class SearXNGTool : ISearXNGTool
{
    private readonly HttpClient _httpClient;
    private readonly ISystemConfigRepository _configRepository;
    private readonly ILogger<SearXNGTool> _logger;
    private readonly string _searxngEndpoint;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public SearXNGTool(
        HttpClient httpClient,
        ISystemConfigRepository configRepository,
        IConfiguration configuration,
        ILogger<SearXNGTool> logger)
    {
        _httpClient = httpClient;
        _configRepository = configRepository;
        _logger = logger;
        
        // Get SearXNG endpoint from Aspire service discovery or configuration
        _searxngEndpoint = configuration["services:searxng:searxng-http:0"] 
            ?? configuration["SearXNG:Endpoint"] 
            ?? "http://localhost:8080";
    }

    public async Task<SearchResult> SearchAsync(string query, int? maxResults = null, CancellationToken cancellationToken = default)
    {
        // Get configured max results if not specified
        var searchConfig = await _configRepository.GetSearchConfigAsync();
        var effectiveMaxResults = Math.Min(
            maxResults ?? searchConfig.MaxResults,
            searchConfig.MaxResults);

        try
        {
            // SearXNG JSON API endpoint
            var requestUrl = $"{_searxngEndpoint}/search?q={Uri.EscapeDataString(query)}&format=json&pageno=1";
            
            _logger.LogDebug("Querying SearXNG: {Url}", requestUrl);
            
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(searchConfig.TimeoutSeconds));
            
            var response = await _httpClient.GetAsync(requestUrl, cts.Token);
            response.EnsureSuccessStatusCode();
            
            var searxResponse = await response.Content.ReadFromJsonAsync<SearXNGResponse>(JsonOptions, cts.Token);
            
            if (searxResponse?.Results is null)
            {
                _logger.LogWarning("SearXNG returned null or empty results for query: {Query}", query);
                return new SearchResult([], query, 0);
            }

            // Limit results to configured max
            var items = searxResponse.Results
                .Take(effectiveMaxResults)
                .Select(r => new SearchResultItem(
                    Title: r.Title ?? "",
                    Url: r.Url ?? "",
                    Content: r.Content ?? "",
                    Engine: r.Engine))
                .ToList();

            _logger.LogInformation(
                "SearXNG returned {Count} results for query: {Query} (limited to {Max})",
                searxResponse.Results.Count,
                query,
                effectiveMaxResults);

            return new SearchResult(items, query, searxResponse.Results.Count);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error querying SearXNG for: {Query}", query);
            return new SearchResult([], query, 0);
        }
    }
}

/// <summary>
/// Internal model for SearXNG JSON response.
/// </summary>
internal class SearXNGResponse
{
    [JsonPropertyName("results")]
    public List<SearXNGResultItem>? Results { get; set; }
    
    [JsonPropertyName("number_of_results")]
    public int NumberOfResults { get; set; }
}

internal class SearXNGResultItem
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
    
    [JsonPropertyName("url")]
    public string? Url { get; set; }
    
    [JsonPropertyName("content")]
    public string? Content { get; set; }
    
    [JsonPropertyName("engine")]
    public string? Engine { get; set; }
}
