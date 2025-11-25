using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using AggregoAi.ApiService.Services;
using Quartz;

namespace AggregoAi.ApiService.Scheduling.Jobs;

/// <summary>
/// Quartz job that fetches RSS feeds and ingests articles.
/// Requirements: 1.2, 1.4
/// </summary>
[DisallowConcurrentExecution]
public class IngestionJob : IJob
{
    public const string FeedIdKey = "FeedId";
    public const string FeedUrlKey = "FeedUrl";
    public const string FeedNameKey = "FeedName";

    private readonly IRssFetcher _rssFetcher;
    private readonly IRssParser _rssParser;
    private readonly IArticleRepository _articleRepository;
    private readonly IFeedConfigRepository _feedConfigRepository;
    private readonly ILogger<IngestionJob> _logger;

    public IngestionJob(
        IRssFetcher rssFetcher,
        IRssParser rssParser,
        IArticleRepository articleRepository,
        IFeedConfigRepository feedConfigRepository,
        ILogger<IngestionJob> logger)
    {
        _rssFetcher = rssFetcher;
        _rssParser = rssParser;
        _articleRepository = articleRepository;
        _feedConfigRepository = feedConfigRepository;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var feedId = context.MergedJobDataMap.GetString(FeedIdKey);
        var feedUrl = context.MergedJobDataMap.GetString(FeedUrlKey);
        var feedName = context.MergedJobDataMap.GetString(FeedNameKey);

        if (string.IsNullOrEmpty(feedUrl))
        {
            _logger.LogError("Feed URL is missing for job {JobKey}", context.JobDetail.Key);
            throw new JobExecutionException("Feed URL is required");
        }

        _logger.LogInformation("Starting ingestion for feed {FeedName} ({FeedUrl})", feedName, feedUrl);

        var itemsProcessed = 0;

        try
        {
            // Fetch RSS content
            var fetchResult = await _rssFetcher.FetchAsync(feedUrl);
            if (!fetchResult.IsSuccess)
            {
                _logger.LogWarning("Failed to fetch feed {FeedUrl}: {Error}", feedUrl, fetchResult.ErrorMessage);
                throw new JobExecutionException($"Failed to fetch feed: {fetchResult.ErrorMessage}");
            }

            // Parse RSS content
            var parseResult = _rssParser.Parse(fetchResult.Content!, feedId ?? "unknown");

            // Log any parse errors
            foreach (var error in parseResult.Errors)
            {
                _logger.LogWarning("Parse error in feed {FeedUrl}: {Error}", feedUrl, error.Message);
            }

            // Save new articles (skip duplicates)
            foreach (var parsedArticle in parseResult.Articles)
            {
                // Check for duplicate by URL
                if (await _articleRepository.ExistsByUrlAsync(parsedArticle.Link))
                {
                    _logger.LogDebug("Skipping duplicate article: {Link}", parsedArticle.Link);
                    continue;
                }

                var article = new Article
                {
                    Title = parsedArticle.Title,
                    Link = parsedArticle.Link,
                    Description = parsedArticle.Description,
                    PublicationDate = parsedArticle.PublicationDate ?? DateTime.UtcNow,
                    SourceFeedId = feedId ?? "unknown",
                    SourceFeedName = feedName ?? "Unknown Feed",
                    VerificationStatus = VerificationStatus.NotVerified,
                    Tags = new List<string>()
                };

                await _articleRepository.CreateAsync(article);
                itemsProcessed++;
            }

            // Update last fetched timestamp
            if (!string.IsNullOrEmpty(feedId))
            {
                await _feedConfigRepository.UpdateLastFetchedAsync(feedId, DateTime.UtcNow);
            }

            context.Put("ItemsProcessed", itemsProcessed);
            _logger.LogInformation("Ingestion complete for {FeedName}: {Count} new articles", feedName, itemsProcessed);
        }
        catch (Exception ex) when (ex is not JobExecutionException)
        {
            _logger.LogError(ex, "Error during ingestion for feed {FeedUrl}", feedUrl);
            throw new JobExecutionException($"Ingestion failed: {ex.Message}", ex);
        }
    }
}
