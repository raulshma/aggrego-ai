using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Implementation of IArticleSearchTool that queries MongoDB for similar articles.
/// Uses text search on title and description fields.
/// </summary>
public class ArticleSearchTool : IArticleSearchTool
{
    private readonly IMongoCollection<Article> _collection;
    private readonly ILogger<ArticleSearchTool> _logger;

    public ArticleSearchTool(IMongoClient mongoClient, ILogger<ArticleSearchTool> logger)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<Article>("articles");
        _logger = logger;
        
        // Ensure text index exists for searching
        EnsureTextIndexAsync().GetAwaiter().GetResult();
    }

    private async Task EnsureTextIndexAsync()
    {
        try
        {
            var textIndex = new CreateIndexModel<Article>(
                Builders<Article>.IndexKeys
                    .Text(a => a.Title)
                    .Text(a => a.Description),
                new CreateIndexOptions { Name = "article_text_search" });
            
            await _collection.Indexes.CreateOneAsync(textIndex);
        }
        catch (MongoCommandException ex) when (ex.CodeName == "IndexOptionsConflict")
        {
            // Index already exists with different options, ignore
            _logger.LogDebug("Text index already exists");
        }
    }


    public async Task<IEnumerable<Article>> FindSimilarAsync(string claim, int maxResults = 10, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(claim))
        {
            return [];
        }

        try
        {
            _logger.LogDebug("Searching for articles similar to: {Claim}", claim);

            // Extract key terms from the claim for searching
            var searchTerms = ExtractSearchTerms(claim);
            
            if (string.IsNullOrWhiteSpace(searchTerms))
            {
                // Fall back to recent articles if no good search terms
                return await _collection
                    .Find(_ => true)
                    .SortByDescending(a => a.PublicationDate)
                    .Limit(maxResults)
                    .ToListAsync(cancellationToken);
            }

            // Use MongoDB text search
            var filter = Builders<Article>.Filter.Text(searchTerms);
            
            var results = await _collection
                .Find(filter)
                .SortByDescending(a => a.PublicationDate)
                .Limit(maxResults)
                .ToListAsync(cancellationToken);

            _logger.LogInformation(
                "Found {Count} similar articles for claim: {Claim}",
                results.Count,
                claim.Length > 50 ? claim[..50] + "..." : claim);

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching for similar articles: {Claim}", claim);
            return [];
        }
    }

    /// <summary>
    /// Extracts meaningful search terms from a claim.
    /// Removes common stop words and keeps significant terms.
    /// </summary>
    private static string ExtractSearchTerms(string claim)
    {
        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "must", "shall", "can", "need", "dare",
            "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
            "from", "as", "into", "through", "during", "before", "after", "above",
            "below", "between", "under", "again", "further", "then", "once",
            "here", "there", "when", "where", "why", "how", "all", "each", "few",
            "more", "most", "other", "some", "such", "no", "nor", "not", "only",
            "own", "same", "so", "than", "too", "very", "just", "and", "but",
            "if", "or", "because", "until", "while", "this", "that", "these",
            "those", "what", "which", "who", "whom", "it", "its", "i", "you",
            "he", "she", "they", "we", "me", "him", "her", "them", "us"
        };

        var words = claim
            .Split([' ', ',', '.', '!', '?', ';', ':', '"', '\'', '(', ')', '[', ']'], 
                   StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 2 && !stopWords.Contains(w))
            .Take(10); // Limit to 10 key terms

        return string.Join(" ", words);
    }

}
