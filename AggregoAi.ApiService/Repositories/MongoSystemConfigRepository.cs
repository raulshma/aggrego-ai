using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// MongoDB implementation of ISystemConfigRepository.
/// Uses a singleton document pattern for system configuration.
/// </summary>
public class MongoSystemConfigRepository : ISystemConfigRepository
{
    private const string ConfigDocumentId = "system-config";
    private readonly IMongoCollection<SystemConfig> _collection;

    public MongoSystemConfigRepository(IMongoClient mongoClient)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<SystemConfig>("systemConfig");
        
        // Ensure default config exists
        EnsureDefaultConfigAsync().GetAwaiter().GetResult();
    }

    private async Task EnsureDefaultConfigAsync()
    {
        var exists = await _collection.Find(c => c.Id == ConfigDocumentId).AnyAsync();
        if (!exists)
        {
            var defaultConfig = new SystemConfig { Id = ConfigDocumentId };
            await _collection.InsertOneAsync(defaultConfig);
        }
    }

    public async Task<T?> GetValueAsync<T>(string key)
    {
        var config = await GetAllAsync();
        return key switch
        {
            "aiSettings" => (T)(object)config.AiSettings,
            "searchSettings" => (T)(object)config.SearchSettings,
            "cleanupSettings" => (T)(object)config.CleanupSettings,
            _ => default
        };
    }

    public async Task SetValueAsync<T>(string key, T value)
    {
        UpdateDefinition<SystemConfig> update = key switch
        {
            "aiSettings" => Builders<SystemConfig>.Update.Set(c => c.AiSettings, (AiConfig)(object)value!),
            "searchSettings" => Builders<SystemConfig>.Update.Set(c => c.SearchSettings, (SearchConfig)(object)value!),
            "cleanupSettings" => Builders<SystemConfig>.Update.Set(c => c.CleanupSettings, (CleanupConfig)(object)value!),
            _ => throw new ArgumentException($"Unknown config key: {key}")
        };

        await _collection.UpdateOneAsync(c => c.Id == ConfigDocumentId, update);
    }

    public async Task<SystemConfig> GetAllAsync()
    {
        var config = await _collection.Find(c => c.Id == ConfigDocumentId).FirstOrDefaultAsync();
        return config ?? new SystemConfig { Id = ConfigDocumentId };
    }

    public async Task<bool> IsFeatureEnabledAsync(string featureKey)
    {
        var config = await GetAllAsync();
        return config.FeatureFlags.TryGetValue(featureKey, out var enabled) && enabled;
    }

    public async Task SetFeatureEnabledAsync(string featureKey, bool enabled)
    {
        var config = await GetAllAsync();
        var flags = new Dictionary<string, bool>(config.FeatureFlags)
        {
            [featureKey] = enabled
        };
        
        var update = Builders<SystemConfig>.Update.Set(c => c.FeatureFlags, flags);
        await _collection.UpdateOneAsync(c => c.Id == ConfigDocumentId, update);
    }

    public async Task<AiConfig> GetAiConfigAsync()
    {
        var config = await GetAllAsync();
        return config.AiSettings;
    }

    public async Task SetAiConfigAsync(AiConfig aiConfig)
    {
        var update = Builders<SystemConfig>.Update.Set(c => c.AiSettings, aiConfig);
        await _collection.UpdateOneAsync(c => c.Id == ConfigDocumentId, update);
    }

    public async Task<SearchConfig> GetSearchConfigAsync()
    {
        var config = await GetAllAsync();
        return config.SearchSettings;
    }

    public async Task SetSearchConfigAsync(SearchConfig searchConfig)
    {
        var update = Builders<SystemConfig>.Update.Set(c => c.SearchSettings, searchConfig);
        await _collection.UpdateOneAsync(c => c.Id == ConfigDocumentId, update);
    }
}
