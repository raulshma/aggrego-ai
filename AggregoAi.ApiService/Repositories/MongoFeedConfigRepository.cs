using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// MongoDB implementation of IFeedConfigRepository.
/// </summary>
public class MongoFeedConfigRepository : IFeedConfigRepository
{
    private readonly IMongoCollection<RssFeedConfig> _collection;

    public MongoFeedConfigRepository(IMongoClient mongoClient)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<RssFeedConfig>("feedConfigs");
        
        // Create unique index on URL to prevent duplicate feeds
        var urlIndex = new CreateIndexModel<RssFeedConfig>(
            Builders<RssFeedConfig>.IndexKeys.Ascending(f => f.Url),
            new CreateIndexOptions { Unique = true });
        
        _collection.Indexes.CreateOne(urlIndex);
    }

    public async Task<RssFeedConfig?> GetByIdAsync(string id)
    {
        if (!ObjectId.TryParse(id, out _))
            return null;
            
        return await _collection.Find(f => f.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<RssFeedConfig>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<RssFeedConfig> CreateAsync(RssFeedConfig config)
    {
        var newConfig = config with
        {
            Id = ObjectId.GenerateNewId().ToString(),
            CreatedAt = DateTime.UtcNow
        };
        
        await _collection.InsertOneAsync(newConfig);
        return newConfig;
    }

    public async Task<RssFeedConfig?> UpdateAsync(RssFeedConfig config)
    {
        var result = await _collection.ReplaceOneAsync(
            f => f.Id == config.Id,
            config);
            
        return result.ModifiedCount > 0 ? config : null;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        if (!ObjectId.TryParse(id, out _))
            return false;
            
        var result = await _collection.DeleteOneAsync(f => f.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task UpdateLastFetchedAsync(string id, DateTime lastFetchedAt)
    {
        var update = Builders<RssFeedConfig>.Update.Set(f => f.LastFetchedAt, lastFetchedAt);
        await _collection.UpdateOneAsync(f => f.Id == id, update);
    }
}
