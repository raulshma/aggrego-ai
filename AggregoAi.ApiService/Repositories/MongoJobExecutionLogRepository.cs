using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// MongoDB implementation of IJobExecutionLogRepository.
/// </summary>
public class MongoJobExecutionLogRepository : IJobExecutionLogRepository
{
    private readonly IMongoCollection<JobExecutionLog> _collection;

    public MongoJobExecutionLogRepository(IMongoClient mongoClient)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<JobExecutionLog>("jobExecutionLogs");
        
        // Create index on JobKey and StartTime for efficient queries
        var jobKeyIndex = new CreateIndexModel<JobExecutionLog>(
            Builders<JobExecutionLog>.IndexKeys
                .Ascending(l => l.JobKey)
                .Descending(l => l.StartTime));
        
        _collection.Indexes.CreateOne(jobKeyIndex);
    }

    public async Task LogExecutionAsync(JobExecutionLog log)
    {
        var newLog = log with
        {
            Id = ObjectId.GenerateNewId().ToString()
        };
        
        await _collection.InsertOneAsync(newLog);
    }

    public async Task<IEnumerable<JobExecutionLog>> GetByJobKeyAsync(string jobKey, int limit = 50)
    {
        return await _collection
            .Find(l => l.JobKey == jobKey)
            .SortByDescending(l => l.StartTime)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<JobExecutionLog?> GetLatestByJobKeyAsync(string jobKey)
    {
        return await _collection
            .Find(l => l.JobKey == jobKey)
            .SortByDescending(l => l.StartTime)
            .FirstOrDefaultAsync();
    }
}
