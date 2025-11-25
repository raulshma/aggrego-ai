namespace AggregoAi.ApiService.Services;

/// <summary>
/// Represents a parsed article from an RSS/Atom feed.
/// </summary>
public record ParsedArticle(
    string Title,
    string Link,
    string? Description,
    DateTime? PublicationDate,
    string SourceFeedId
);

/// <summary>
/// Represents an error encountered while parsing an RSS entry.
/// </summary>
public record ParseError(
    string Message,
    string? EntryIdentifier,
    Exception? Exception
);

/// <summary>
/// Result of parsing RSS/Atom XML content.
/// </summary>
public record ParseResult(
    IReadOnlyList<ParsedArticle> Articles,
    IReadOnlyList<ParseError> Errors
)
{
    public bool HasErrors => Errors.Count > 0;
    public bool HasArticles => Articles.Count > 0;
}

/// <summary>
/// Interface for parsing RSS 2.0 and Atom feed XML content.
/// </summary>
public interface IRssParser
{
    /// <summary>
    /// Parses RSS or Atom XML content and extracts articles.
    /// Handles malformed entries gracefully by skipping them and reporting errors.
    /// </summary>
    /// <param name="xmlContent">The XML content to parse.</param>
    /// <param name="sourceFeedId">The identifier of the source feed.</param>
    /// <returns>A ParseResult containing successfully parsed articles and any errors encountered.</returns>
    ParseResult Parse(string xmlContent, string sourceFeedId);
}
