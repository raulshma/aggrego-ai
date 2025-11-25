using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AggregoAi.ApiService.Models;

/// <summary>
/// Represents a news article fetched from an RSS feed.
/// </summary>
public record Article
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; init; } = null!;

    [BsonElement("title")]
    public string Title { get; init; } = null!;

    [BsonElement("link")]
    public string Link { get; init; } = null!;

    [BsonElement("description")]
    public string? Description { get; init; }

    [BsonElement("publicationDate")]
    public DateTime PublicationDate { get; init; }

    [BsonElement("sourceFeedId")]
    public string SourceFeedId { get; init; } = null!;

    [BsonElement("sourceFeedName")]
    public string? SourceFeedName { get; init; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; init; }

    [BsonElement("verificationStatus")]
    public VerificationStatus VerificationStatus { get; init; } = VerificationStatus.NotVerified;

    [BsonElement("verdict")]
    public VerificationVerdict? Verdict { get; init; }

    [BsonElement("tags")]
    public IEnumerable<string> Tags { get; init; } = [];
}

public enum VerificationStatus
{
    NotVerified,
    InProgress,
    Verified
}

public record VerificationVerdict(
    [property: BsonElement("assessment")] string Assessment,
    [property: BsonElement("confidence")] ConfidenceLevel Confidence,
    [property: BsonElement("citations")] IEnumerable<Citation> Citations,
    [property: BsonElement("verifiedAt")] DateTime VerifiedAt
);

public enum ConfidenceLevel { Low, Medium, High }

public record Citation(
    [property: BsonElement("source")] string Source,
    [property: BsonElement("url")] string Url,
    [property: BsonElement("excerpt")] string Excerpt
);
