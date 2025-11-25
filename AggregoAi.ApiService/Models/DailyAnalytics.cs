using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AggregoAi.ApiService.Models;

/// <summary>
/// Represents daily aggregated analytics metrics.
/// Requirements: 8.2
/// </summary>
public record DailyAnalytics
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; init; } = null!;

    [BsonElement("date")]
    public DateTime Date { get; init; }

    [BsonElement("tokenUsage")]
    public TokenUsageMetrics TokenUsage { get; init; } = new();

    [BsonElement("verificationMetrics")]
    public VerificationMetrics VerificationMetrics { get; init; } = new();

    [BsonElement("ingestionMetrics")]
    public IngestionMetrics IngestionMetrics { get; init; } = new();

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; init; }
}

/// <summary>
/// AI token usage metrics for a day.
/// </summary>
public record TokenUsageMetrics
{
    [BsonElement("totalPromptTokens")]
    public int TotalPromptTokens { get; init; }

    [BsonElement("totalCompletionTokens")]
    public int TotalCompletionTokens { get; init; }

    [BsonElement("totalTokens")]
    public int TotalTokens { get; init; }

    [BsonElement("estimatedCost")]
    public decimal EstimatedCost { get; init; }
}

/// <summary>
/// Article verification metrics for a day.
/// </summary>
public record VerificationMetrics
{
    [BsonElement("totalVerifications")]
    public int TotalVerifications { get; init; }

    [BsonElement("successfulVerifications")]
    public int SuccessfulVerifications { get; init; }

    [BsonElement("failedVerifications")]
    public int FailedVerifications { get; init; }

    [BsonElement("averageVerificationTimeMs")]
    public double AverageVerificationTimeMs { get; init; }
}

/// <summary>
/// Article ingestion metrics for a day.
/// </summary>
public record IngestionMetrics
{
    [BsonElement("totalArticlesIngested")]
    public int TotalArticlesIngested { get; init; }

    [BsonElement("totalFeedsProcessed")]
    public int TotalFeedsProcessed { get; init; }

    [BsonElement("duplicatesSkipped")]
    public int DuplicatesSkipped { get; init; }

    [BsonElement("parseErrors")]
    public int ParseErrors { get; init; }
}
