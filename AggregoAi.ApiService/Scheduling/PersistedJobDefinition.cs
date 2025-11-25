using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Represents a persisted job definition in MongoDB.
/// Used to restore jobs after application restart.
/// Requirements: 2.1, 2.4
/// </summary>
public record PersistedJobDefinition
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; init; } = null!;

    [BsonElement("jobKey")]
    public string JobKey { get; init; } = null!;

    [BsonElement("jobGroup")]
    public string JobGroup { get; init; } = null!;

    [BsonElement("jobType")]
    public string JobType { get; init; } = null!;

    [BsonElement("cronExpression")]
    public string CronExpression { get; init; } = null!;

    [BsonElement("misfireInstruction")]
    public MisfireInstruction MisfireInstruction { get; init; }

    [BsonElement("isPaused")]
    public bool IsPaused { get; init; }

    [BsonElement("jobData")]
    public Dictionary<string, string> JobData { get; init; } = new();

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; init; }

    [BsonElement("lastExecutionTime")]
    public DateTime? LastExecutionTime { get; init; }

    [BsonElement("lastStatus")]
    public JobExecutionStatus? LastStatus { get; init; }
}
