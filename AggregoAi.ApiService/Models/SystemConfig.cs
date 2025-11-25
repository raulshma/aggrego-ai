using MongoDB.Bson.Serialization.Attributes;

namespace AggregoAi.ApiService.Models;

/// <summary>
/// System-wide configuration stored in MongoDB.
/// </summary>
public record SystemConfig
{
    [BsonId]
    public string Id { get; init; } = null!;

    [BsonElement("aiSettings")]
    public AiConfig AiSettings { get; init; } = new AiConfig("gpt-4", 0.7, 4096);

    [BsonElement("searchSettings")]
    public SearchConfig SearchSettings { get; init; } = new SearchConfig(10, 30);

    [BsonElement("cleanupSettings")]
    public CleanupConfig CleanupSettings { get; init; } = new CleanupConfig(30);

    [BsonElement("featureFlags")]
    public Dictionary<string, bool> FeatureFlags { get; init; } = new();
}

public record AiConfig(
    [property: BsonElement("modelString")] string ModelString,
    [property: BsonElement("temperature")] double Temperature,
    [property: BsonElement("maxContextTokens")] int MaxContextTokens
);

public record SearchConfig(
    [property: BsonElement("maxResults")] int MaxResults,
    [property: BsonElement("timeoutSeconds")] int TimeoutSeconds
);

public record CleanupConfig(
    [property: BsonElement("retentionDays")] int RetentionDays
);
