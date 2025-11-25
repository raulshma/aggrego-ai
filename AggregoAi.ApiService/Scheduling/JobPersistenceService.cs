using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// MongoDB implementation of job persistence service.
/// Stores job definitions to survive application restarts.
/// Requirements: 2.1, 2.2, 2.3, 2.4
/// </summary>
public class JobPersistenceService : IJobPersistenceService
{
    private readonly IMongoCollection<PersistedJobDefinition> _collection;

    public JobPersistenceService(IMongoClient mongoClient)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<PersistedJobDefinition>("jobDefinitions");

        // Create unique index on JobKey + JobGroup
        var keyIndex = new CreateIndexModel<PersistedJobDefinition>(
            Builders<PersistedJobDefinition>.IndexKeys
                .Ascending(j => j.JobKey)
                .Ascending(j => j.JobGroup),
            new CreateIndexOptions { Unique = true });

        _collection.Indexes.CreateOne(keyIndex);
    }

    public async Task SaveJobDefinitionAsync(PersistedJobDefinition definition)
    {
        var newDefinition = definition with
        {
            Id = ObjectId.GenerateNewId().ToString(),
            CreatedAt = DateTime.UtcNow
        };

        await _collection.InsertOneAsync(newDefinition);
    }

    public async Task<IEnumerable<PersistedJobDefinition>> GetAllJobDefinitionsAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<PersistedJobDefinition?> GetJobDefinitionAsync(string jobKey, string jobGroup)
    {
        return await _collection
            .Find(j => j.JobKey == jobKey && j.JobGroup == jobGroup)
            .FirstOrDefaultAsync();
    }


    public async Task UpdateJobDefinitionAsync(PersistedJobDefinition definition)
    {
        await _collection.ReplaceOneAsync(
            j => j.JobKey == definition.JobKey && j.JobGroup == definition.JobGroup,
            definition);
    }

    public async Task DeleteJobDefinitionAsync(string jobKey, string jobGroup)
    {
        await _collection.DeleteOneAsync(
            j => j.JobKey == jobKey && j.JobGroup == jobGroup);
    }

    public async Task UpdatePauseStateAsync(string jobKey, string jobGroup, bool isPaused)
    {
        var update = Builders<PersistedJobDefinition>.Update.Set(j => j.IsPaused, isPaused);
        await _collection.UpdateOneAsync(
            j => j.JobKey == jobKey && j.JobGroup == jobGroup,
            update);
    }

    public async Task UpdateLastExecutionAsync(string jobKey, string jobGroup, DateTime executionTime, JobExecutionStatus status)
    {
        var update = Builders<PersistedJobDefinition>.Update
            .Set(j => j.LastExecutionTime, executionTime)
            .Set(j => j.LastStatus, status);

        await _collection.UpdateOneAsync(
            j => j.JobKey == jobKey && j.JobGroup == jobGroup,
            update);
    }
}
