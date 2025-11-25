using AggregoAi.ApiService.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// MongoDB implementation of IAnalyticsRepository.
/// Requirements: 8.2
/// </summary>
public class MongoAnalyticsRepository : IAnalyticsRepository
{
    private readonly IMongoCollection<DailyAnalytics> _collection;

    public MongoAnalyticsRepository(IMongoClient mongoClient)
    {
        var database = mongoClient.GetDatabase("aggregoai");
        _collection = database.GetCollection<DailyAnalytics>("dailyAnalytics");

        // Create unique index on date
        var dateIndex = new CreateIndexModel<DailyAnalytics>(
            Builders<DailyAnalytics>.IndexKeys.Ascending(a => a.Date),
            new CreateIndexOptions { Unique = true });

        _collection.Indexes.CreateOne(dateIndex);
    }

    public async Task<DailyAnalytics?> GetByDateAsync(DateTime date)
    {
        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        return await _collection
            .Find(a => a.Date >= startOfDay && a.Date < endOfDay)
            .FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<DailyAnalytics>> GetByDateRangeAsync(DateTime startDate, DateTime endDate)
    {
        return await _collection
            .Find(a => a.Date >= startDate.Date && a.Date < endDate.Date.AddDays(1))
            .SortByDescending(a => a.Date)
            .ToListAsync();
    }

    public async Task<DailyAnalytics> UpsertAsync(DailyAnalytics analytics)
    {
        var startOfDay = analytics.Date.Date;
        var existing = await GetByDateAsync(startOfDay);

        if (existing != null)
        {
            var updated = analytics with { Id = existing.Id, Date = startOfDay };
            await _collection.ReplaceOneAsync(a => a.Id == existing.Id, updated);
            return updated;
        }

        var newAnalytics = analytics with
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Date = startOfDay,
            CreatedAt = DateTime.UtcNow
        };

        await _collection.InsertOneAsync(newAnalytics);
        return newAnalytics;
    }

    public async Task<IEnumerable<DailyAnalytics>> GetRecentAsync(int days)
    {
        var cutoffDate = DateTime.UtcNow.Date.AddDays(-days);

        return await _collection
            .Find(a => a.Date >= cutoffDate)
            .SortByDescending(a => a.Date)
            .ToListAsync();
    }
}
