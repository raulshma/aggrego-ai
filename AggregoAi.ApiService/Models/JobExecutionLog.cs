using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AggregoAi.ApiService.Models;

/// <summary>
/// Log entry for a job execution.
/// </summary>
public record JobExecutionLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; init; } = null!;

    [BsonElement("jobKey")]
    public string JobKey { get; init; } = null!;

    [BsonElement("jobGroup")]
    public string JobGroup { get; init; } = null!;

    [BsonElement("startTime")]
    public DateTime StartTime { get; init; }

    [BsonElement("endTime")]
    public DateTime EndTime { get; init; }

    [BsonElement("duration")]
    public TimeSpan Duration { get; init; }

    [BsonElement("status")]
    public JobExecutionStatus Status { get; init; }

    [BsonElement("errorMessage")]
    public string? ErrorMessage { get; init; }

    [BsonElement("stackTrace")]
    public string? StackTrace { get; init; }

    [BsonElement("itemsProcessed")]
    public int ItemsProcessed { get; init; }
}

public enum JobExecutionStatus
{
    Success,
    Failed,
    Cancelled
}
