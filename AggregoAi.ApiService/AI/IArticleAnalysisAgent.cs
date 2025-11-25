using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Agent interface for comprehensive article analysis including fact-checking and bias detection.
/// Designed for Indian news context with international coverage.
/// </summary>
public interface IArticleAnalysisAgent
{
    /// <summary>
    /// Performs comprehensive analysis of an article including fact-checking and bias detection.
    /// Streams intermediate steps for both analysis types.
    /// </summary>
    IAsyncEnumerable<AnalysisStep> AnalyzeArticleAsync(Article article, CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents a single step in the analysis process.
/// </summary>
public record AnalysisStep(
    AnalysisStepType Type,
    string Content,
    DateTime Timestamp,
    AnalysisPanel Panel
);

/// <summary>
/// Types of steps in the analysis process.
/// </summary>
public enum AnalysisStepType
{
    Thought,
    Action,
    Observation,
    Result,
    Error
}

/// <summary>
/// Which panel the step belongs to.
/// </summary>
public enum AnalysisPanel
{
    FactCheck,
    Bias
}


/// <summary>
/// Result of fact-checking analysis.
/// </summary>
public record FactCheckResult(
    string Status, // verified, partially_verified, unverified, misleading
    string Summary,
    List<ClaimCheck> Claims,
    List<SourceReference> Sources
);

/// <summary>
/// Individual claim verification result.
/// </summary>
public record ClaimCheck(
    string Claim,
    string Verdict, // true, mostly_true, mixed, mostly_false, false, unverifiable
    string Explanation,
    List<string> Sources
);

/// <summary>
/// Reference to a source used in verification.
/// </summary>
public record SourceReference(
    string Title,
    string Url,
    string Relevance,
    string? PublishedDate = null
);

/// <summary>
/// Result of bias analysis.
/// </summary>
public record BiasAnalysisResult(
    string OverallBias, // far_left, left, center_left, center, center_right, right, far_right
    int Confidence,
    List<BiasIndicator> Indicators,
    string Context,
    string? RegionalContext = null // Specific context for Indian news
);

/// <summary>
/// Individual bias indicator found in the article.
/// </summary>
public record BiasIndicator(
    string Type, // language, framing, source_selection, omission, emotional_appeal
    string Description,
    string Severity, // low, medium, high
    string Leaning // left, right, neutral
);
