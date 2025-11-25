using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AggregoAi.ApiService.Models;

/// <summary>
/// Configuration for an RSS feed to be ingested.
/// </summary>
public record RssFeedConfig
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; init; } = null!;

    [BsonElement("name")]
    public string Name { get; init; } = null!;

    [BsonElement("url")]
    public string Url { get; init; } = null!;

    [BsonElement("cronExpression")]
    public string CronExpression { get; init; } = "0 */15 * * * ?"; // Default: every 15 minutes

    [BsonElement("isEnabled")]
    public bool IsEnabled { get; init; } = true;

    [BsonElement("maxRetries")]
    public int MaxRetries { get; init; } = 5;

    [BsonElement("misfireInstruction")]
    public MisfireInstruction MisfireInstruction { get; init; } = MisfireInstruction.FireNow;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; init; }

    [BsonElement("lastFetchedAt")]
    public DateTime? LastFetchedAt { get; init; }
}

public enum MisfireInstruction
{
    FireNow,
    DoNothing,
    RescheduleNextWithRemainingCount
}
