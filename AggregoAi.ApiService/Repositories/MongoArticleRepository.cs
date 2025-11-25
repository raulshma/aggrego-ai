using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// MongoDB implementation of IArticleRepository.
/// </summary>
public class MongoArticleRepository : IArticleRepository
{
    private readonly IMongoCollection<Article> _collection;

    public MongoArticleRepository(IMongoClient mongoClient)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<Article>("articles");
        
        // Create index on Link for deduplication
        var linkIndex = new CreateIndexModel<Article>(
            Builders<Article>.IndexKeys.Ascending(a => a.Link),
            new CreateIndexOptions { Unique = true });
        
        // Create index on PublicationDate for sorting
        var dateIndex = new CreateIndexModel<Article>(
            Builders<Article>.IndexKeys.Descending(a => a.PublicationDate));
        
        _collection.Indexes.CreateMany([linkIndex, dateIndex]);
    }

    public async Task<Article?> GetByIdAsync(string id)
    {
        if (!ObjectId.TryParse(id, out _))
            return null;
            
        return await _collection.Find(a => a.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Article>> GetByFeedAsync(string feedId, int limit, int offset)
    {
        return await _collection
            .Find(a => a.SourceFeedId == feedId)
            .SortByDescending(a => a.PublicationDate)
            .Skip(offset)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<IEnumerable<Article>> GetRecentAsync(int limit, bool includeHidden = false)
    {
        var filter = includeHidden
            ? Builders<Article>.Filter.Empty
            : Builders<Article>.Filter.Eq(a => a.IsHidden, false);

        return await _collection
            .Find(filter)
            .SortByDescending(a => a.PublicationDate)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<bool> ExistsByUrlAsync(string url)
    {
        return await _collection.Find(a => a.Link == url).AnyAsync();
    }

    public async Task<Article> CreateAsync(Article article)
    {
        var newArticle = article with
        {
            Id = ObjectId.GenerateNewId().ToString(),
            CreatedAt = DateTime.UtcNow
        };
        
        await _collection.InsertOneAsync(newArticle);
        return newArticle;
    }

    public async Task<Article?> UpdateAsync(Article article)
    {
        var result = await _collection.ReplaceOneAsync(
            a => a.Id == article.Id,
            article);
            
        return result.ModifiedCount > 0 ? article : null;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        if (!ObjectId.TryParse(id, out _))
            return false;
            
        var result = await _collection.DeleteOneAsync(a => a.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<int> DeleteManyAsync(IEnumerable<string> ids)
    {
        var validIds = ids.Where(id => ObjectId.TryParse(id, out _)).ToList();
        if (validIds.Count == 0)
            return 0;

        var filter = Builders<Article>.Filter.In(a => a.Id, validIds);
        var result = await _collection.DeleteManyAsync(filter);
        return (int)result.DeletedCount;
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoffDate)
    {
        var result = await _collection.DeleteManyAsync(a => a.PublicationDate < cutoffDate);
        return (int)result.DeletedCount;
    }

    public async Task<bool> SetHiddenAsync(string id, bool isHidden)
    {
        if (!ObjectId.TryParse(id, out _))
            return false;

        var update = Builders<Article>.Update.Set(a => a.IsHidden, isHidden);
        var result = await _collection.UpdateOneAsync(a => a.Id == id, update);
        return result.ModifiedCount > 0;
    }

    public async Task<int> SetHiddenManyAsync(IEnumerable<string> ids, bool isHidden)
    {
        var validIds = ids.Where(id => ObjectId.TryParse(id, out _)).ToList();
        if (validIds.Count == 0)
            return 0;

        var filter = Builders<Article>.Filter.In(a => a.Id, validIds);
        var update = Builders<Article>.Update.Set(a => a.IsHidden, isHidden);
        var result = await _collection.UpdateManyAsync(filter, update);
        return (int)result.ModifiedCount;
    }

    public async Task<IEnumerable<Article>> GetUntaggedAsync(int batchSize)
    {
        return await _collection
            .Find(a => a.Tags == null || !a.Tags.Any())
            .Limit(batchSize)
            .ToListAsync();
    }

    public async Task UpdateTagsAsync(string id, IEnumerable<string> tags)
    {
        var update = Builders<Article>.Update.Set(a => a.Tags, tags);
        await _collection.UpdateOneAsync(a => a.Id == id, update);
    }

    public async Task UpdateVerificationAsync(string id, VerificationStatus status, VerificationVerdict? verdict)
    {
        var update = Builders<Article>.Update
            .Set(a => a.VerificationStatus, status)
            .Set(a => a.Verdict, verdict);
        await _collection.UpdateOneAsync(a => a.Id == id, update);
    }

    public async Task UpdateAnalysisResultAsync(string id, ArticleAnalysisResult result)
    {
        var update = Builders<Article>.Update.Set(a => a.AnalysisResult, result);
        await _collection.UpdateOneAsync(a => a.Id == id, update);
    }
}
