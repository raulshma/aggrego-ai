using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Quartz;

namespace AggregoAi.ApiService.Scheduling.Jobs;

/// <summary>
/// Quartz job that processes untagged articles using AI for categorization.
/// Uses a cost-efficient approach by processing articles in batches.
/// Requirements: 8.3
/// </summary>
[DisallowConcurrentExecution]
public class SmartTaggingJob : IJob
{
    public const string BatchSizeKey = "BatchSize";
    public const string UseAiTaggingKey = "UseAiTagging";

    private const int DefaultBatchSize = 10;

    private readonly IArticleRepository _articleRepository;
    private readonly ISystemConfigRepository _systemConfigRepository;
    private readonly ILogger<SmartTaggingJob> _logger;

    public SmartTaggingJob(
        IArticleRepository articleRepository,
        ISystemConfigRepository systemConfigRepository,
        ILogger<SmartTaggingJob> logger)
    {
        _articleRepository = articleRepository;
        _systemConfigRepository = systemConfigRepository;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var batchSize = context.MergedJobDataMap.GetInt(BatchSizeKey);
        if (batchSize <= 0)
        {
            batchSize = DefaultBatchSize;
        }

        _logger.LogInformation("Starting smart tagging job with batch size {BatchSize}", batchSize);

        try
        {
            // Check if AI tagging is enabled via feature flag
            var useAiTagging = await IsAiTaggingEnabledAsync();

            var untaggedArticles = await _articleRepository.GetUntaggedAsync(batchSize);
            var articleList = untaggedArticles.ToList();

            if (articleList.Count == 0)
            {
                _logger.LogInformation("No untagged articles found");
                context.Put("ItemsProcessed", 0);
                return;
            }

            var processedCount = 0;
            var failedCount = 0;

            foreach (var article in articleList)
            {
                try
                {
                    IEnumerable<string> tags;

                    if (useAiTagging)
                    {
                        // AI-based tagging will be implemented when Semantic Kernel is integrated
                        // For now, fall back to keyword-based tagging
                        tags = await GenerateAiTagsAsync(article);
                    }
                    else
                    {
                        tags = GenerateKeywordBasedTags(article.Title, article.Description);
                    }

                    await _articleRepository.UpdateTagsAsync(article.Id, tags);
                    processedCount++;

                    _logger.LogDebug("Tagged article {ArticleId} with tags: {Tags}",
                        article.Id, string.Join(", ", tags));
                }
                catch (Exception ex)
                {
                    failedCount++;
                    _logger.LogWarning(ex, "Failed to tag article {ArticleId}", article.Id);
                }
            }

            context.Put("ItemsProcessed", processedCount);
            _logger.LogInformation(
                "Smart tagging complete. Processed: {Processed}, Failed: {Failed}",
                processedCount, failedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during smart tagging job");
            throw new JobExecutionException($"Smart tagging failed: {ex.Message}", ex);
        }
    }

    private async Task<bool> IsAiTaggingEnabledAsync()
    {
        try
        {
            var config = await _systemConfigRepository.GetAllAsync();
            return config?.FeatureFlags?.TryGetValue("ai-tagging", out var enabled) == true && enabled;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Generates tags using AI (Semantic Kernel).
    /// Currently falls back to keyword-based tagging until AI services are integrated.
    /// </summary>
    private Task<IEnumerable<string>> GenerateAiTagsAsync(Article article)
    {
        // TODO: Implement AI-based tagging when Semantic Kernel is integrated
        // This will use a cost-efficient model (e.g., GPT-3.5-turbo) to categorize articles
        // The prompt will analyze title and description to generate relevant tags

        // For now, fall back to keyword-based tagging
        return Task.FromResult(GenerateKeywordBasedTags(article.Title, article.Description));
    }

    /// <summary>
    /// Generates tags based on keyword matching.
    /// Used as fallback when AI tagging is disabled or unavailable.
    /// </summary>
    private static IEnumerable<string> GenerateKeywordBasedTags(string title, string? description)
    {
        var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var content = $"{title} {description}".ToLowerInvariant();

        // AI/ML related
        if (content.Contains("ai") || content.Contains("artificial intelligence") ||
            content.Contains("machine learning") || content.Contains("deep learning") ||
            content.Contains("neural network") || content.Contains("llm") ||
            content.Contains("chatgpt") || content.Contains("openai"))
        {
            tags.Add("AI");
        }

        // Technology
        if (content.Contains("tech") || content.Contains("technology") ||
            content.Contains("software") || content.Contains("hardware") ||
            content.Contains("startup") || content.Contains("silicon valley"))
        {
            tags.Add("Technology");
        }

        // Business/Finance
        if (content.Contains("business") || content.Contains("market") ||
            content.Contains("economy") || content.Contains("stock") ||
            content.Contains("investment") || content.Contains("finance"))
        {
            tags.Add("Business");
        }

        // Science
        if (content.Contains("science") || content.Contains("research") ||
            content.Contains("study") || content.Contains("discovery") ||
            content.Contains("experiment") || content.Contains("scientist"))
        {
            tags.Add("Science");
        }

        // Health
        if (content.Contains("health") || content.Contains("medical") ||
            content.Contains("healthcare") || content.Contains("disease") ||
            content.Contains("treatment") || content.Contains("vaccine"))
        {
            tags.Add("Health");
        }

        // Security/Cybersecurity
        if (content.Contains("security") || content.Contains("cyber") ||
            content.Contains("hack") || content.Contains("breach") ||
            content.Contains("privacy") || content.Contains("encryption"))
        {
            tags.Add("Security");
        }

        // Climate/Environment
        if (content.Contains("climate") || content.Contains("environment") ||
            content.Contains("sustainability") || content.Contains("renewable") ||
            content.Contains("carbon") || content.Contains("green energy"))
        {
            tags.Add("Environment");
        }

        // Default tag if no matches
        if (tags.Count == 0)
        {
            tags.Add("General");
        }

        return tags;
    }
}
