using AggregoAi.ApiService.AI;
using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AggregoAi.ApiService.Controllers;

/// <summary>
/// Controller for article operations.
/// Requirements: 6.1, 6.2, 5.5
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ArticleController : ControllerBase
{
    private readonly IArticleRepository _articleRepository;
    private readonly IFactCheckAgent _factCheckAgent;
    private readonly IArticleAnalysisAgent _analysisAgent;
    private readonly ILogger<ArticleController> _logger;
    
    private static readonly JsonSerializerOptions CamelCaseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ArticleController(
        IArticleRepository articleRepository,
        IFactCheckAgent factCheckAgent,
        IArticleAnalysisAgent analysisAgent,
        ILogger<ArticleController> logger)
    {
        _articleRepository = articleRepository;
        _factCheckAgent = factCheckAgent;
        _analysisAgent = analysisAgent;
        _logger = logger;
    }

    /// <summary>
    /// Gets a paginated list of articles sorted by publication date.
    /// Requirements: 6.1
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ArticleListResponse>> GetArticles(
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0,
        [FromQuery] string? feedId = null)
    {
        try
        {
            IEnumerable<Article> articles;
            
            if (!string.IsNullOrEmpty(feedId))
            {
                articles = await _articleRepository.GetByFeedAsync(feedId, limit, offset);
            }
            else
            {
                articles = await _articleRepository.GetRecentAsync(limit);
            }

            return Ok(new ArticleListResponse(articles.ToList(), limit, offset));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving articles");
            return StatusCode(500, new { error = "Failed to retrieve articles" });
        }
    }


    /// <summary>
    /// Gets a single article by ID.
    /// Requirements: 6.2
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Article>> GetArticle(string id)
    {
        try
        {
            var article = await _articleRepository.GetByIdAsync(id);
            
            if (article == null)
            {
                return NotFound(new { error = $"Article with ID '{id}' not found" });
            }

            return Ok(article);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving article {ArticleId}", id);
            return StatusCode(500, new { error = "Failed to retrieve article" });
        }
    }

    /// <summary>
    /// Initiates AI verification of an article with streaming response.
    /// Requirements: 5.5
    /// </summary>
    [HttpPost("{id}/verify")]
    public async Task VerifyArticle(string id, CancellationToken cancellationToken)
    {
        var article = await _articleRepository.GetByIdAsync(id);
        
        if (article == null)
        {
            Response.StatusCode = 404;
            await Response.WriteAsJsonAsync(new { error = $"Article with ID '{id}' not found" }, cancellationToken);
            return;
        }

        // Set up streaming response
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        try
        {
            // Update article status to InProgress
            await _articleRepository.UpdateVerificationAsync(id, VerificationStatus.InProgress, null);

            VerificationVerdict? finalVerdict = null;

            await foreach (var step in _factCheckAgent.VerifyArticleAsync(article, cancellationToken))
            {
                var eventData = new AgentStepEvent(
                    step.Type.ToString(),
                    step.Content,
                    step.Timestamp
                );

                var json = JsonSerializer.Serialize(eventData, CamelCaseOptions);
                await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);

                // Capture final verdict from FinalAnswer step
                if (step.Type == AgentStepType.FinalAnswer)
                {
                    finalVerdict = ParseVerdict(step.Content);
                }
            }

            // Update article with final verdict
            if (finalVerdict != null)
            {
                await _articleRepository.UpdateVerificationAsync(id, VerificationStatus.Verified, finalVerdict);
            }

            // Send completion event
            await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Verification cancelled for article {ArticleId}", id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during verification of article {ArticleId}", id);
            
            // Reset verification status on error
            await _articleRepository.UpdateVerificationAsync(id, VerificationStatus.NotVerified, null);
            
            var errorEvent = new { type = "error", message = "Verification failed" };
            var errorJson = JsonSerializer.Serialize(errorEvent, CamelCaseOptions);
            await Response.WriteAsync($"data: {errorJson}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    private static VerificationVerdict? ParseVerdict(string content)
    {
        try
        {
            // Try to parse the verdict from the final answer content
            // The content should contain assessment, confidence, and citations
            return new VerificationVerdict(
                Assessment: content,
                Confidence: ConfidenceLevel.Medium,
                Citations: [],
                VerifiedAt: DateTime.UtcNow
            );
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Gets the stored analysis result for an article if it exists.
    /// </summary>
    [HttpGet("{id}/analysis")]
    public async Task<ActionResult<ArticleAnalysisResponse>> GetAnalysis(string id)
    {
        try
        {
            var article = await _articleRepository.GetByIdAsync(id);
            
            if (article == null)
            {
                return NotFound(new { error = $"Article with ID '{id}' not found" });
            }

            if (article.AnalysisResult == null)
            {
                return NotFound(new { error = "No analysis found for this article" });
            }

            return Ok(new ArticleAnalysisResponse(
                article.AnalysisResult.FactCheckResult,
                article.AnalysisResult.BiasResult,
                article.AnalysisResult.AnalyzedAt
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving analysis for article {ArticleId}", id);
            return StatusCode(500, new { error = "Failed to retrieve analysis" });
        }
    }

    /// <summary>
    /// Performs comprehensive AI analysis of an article including fact-checking and bias detection.
    /// Streams results for both analysis types in parallel.
    /// </summary>
    [HttpPost("{id}/analyze")]
    public async Task AnalyzeArticle(string id, CancellationToken cancellationToken)
    {
        var article = await _articleRepository.GetByIdAsync(id);
        
        if (article == null)
        {
            Response.StatusCode = 404;
            await Response.WriteAsJsonAsync(new { error = $"Article with ID '{id}' not found" }, cancellationToken);
            return;
        }

        // Set up streaming response
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        string? factCheckResult = null;
        string? biasResult = null;

        try
        {
            await foreach (var step in _analysisAgent.AnalyzeArticleAsync(article, cancellationToken))
            {
                var eventData = new AnalysisStepEvent(
                    step.Type.ToString(),
                    step.Content,
                    step.Timestamp,
                    step.Panel == AnalysisPanel.FactCheck ? "factcheck" : "bias"
                );

                // Capture results for storage
                if (step.Type == AnalysisStepType.Result)
                {
                    if (step.Panel == AnalysisPanel.FactCheck)
                        factCheckResult = step.Content;
                    else if (step.Panel == AnalysisPanel.Bias)
                        biasResult = step.Content;
                }

                var json = JsonSerializer.Serialize(eventData, CamelCaseOptions);
                await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            // Store analysis results if we got any
            if (factCheckResult != null || biasResult != null)
            {
                var analysisResult = new ArticleAnalysisResult
                {
                    FactCheckResult = factCheckResult,
                    BiasResult = biasResult,
                    AnalyzedAt = DateTime.UtcNow
                };
                await _articleRepository.UpdateAnalysisResultAsync(id, analysisResult);
            }

            // Send completion event
            await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Analysis cancelled for article {ArticleId}", id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during analysis of article {ArticleId}", id);
            
            var errorEvent = new AnalysisStepEvent("error", "Analysis failed", DateTime.UtcNow, "factcheck");
            var errorJson = JsonSerializer.Serialize(errorEvent, CamelCaseOptions);
            await Response.WriteAsync($"data: {errorJson}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    /// <summary>
    /// Deletes a single article by ID.
    /// Admin only.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteArticle(string id)
    {
        try
        {
            var deleted = await _articleRepository.DeleteAsync(id);

            if (!deleted)
            {
                return NotFound(new { error = $"Article with ID '{id}' not found" });
            }

            return Ok(new { message = "Article deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting article {ArticleId}", id);
            return StatusCode(500, new { error = "Failed to delete article" });
        }
    }

    /// <summary>
    /// Deletes multiple articles by IDs.
    /// Admin only.
    /// </summary>
    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> BulkDeleteArticles([FromBody] BulkArticleRequest request)
    {
        try
        {
            if (request.Ids == null || request.Ids.Count == 0)
            {
                return BadRequest(new { error = "No article IDs provided" });
            }

            var deletedCount = await _articleRepository.DeleteManyAsync(request.Ids);

            return Ok(new { message = $"{deletedCount} articles deleted successfully", deletedCount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk deleting articles");
            return StatusCode(500, new { error = "Failed to delete articles" });
        }
    }

    /// <summary>
    /// Hides or unhides a single article.
    /// Admin only.
    /// </summary>
    [HttpPatch("{id}/hidden")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> SetArticleHidden(string id, [FromBody] SetHiddenRequest request)
    {
        try
        {
            var updated = await _articleRepository.SetHiddenAsync(id, request.IsHidden);

            if (!updated)
            {
                return NotFound(new { error = $"Article with ID '{id}' not found" });
            }

            return Ok(new { message = $"Article {(request.IsHidden ? "hidden" : "unhidden")} successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating hidden status for article {ArticleId}", id);
            return StatusCode(500, new { error = "Failed to update article" });
        }
    }

    /// <summary>
    /// Hides or unhides multiple articles.
    /// Admin only.
    /// </summary>
    [HttpPost("bulk-hidden")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> BulkSetArticlesHidden([FromBody] BulkHiddenRequest request)
    {
        try
        {
            if (request.Ids == null || request.Ids.Count == 0)
            {
                return BadRequest(new { error = "No article IDs provided" });
            }

            var updatedCount = await _articleRepository.SetHiddenManyAsync(request.Ids, request.IsHidden);

            return Ok(new { message = $"{updatedCount} articles {(request.IsHidden ? "hidden" : "unhidden")} successfully", updatedCount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk updating hidden status for articles");
            return StatusCode(500, new { error = "Failed to update articles" });
        }
    }
}

/// <summary>
/// Response model for article list endpoint.
/// </summary>
public record ArticleListResponse(
    List<Article> Articles,
    int Limit,
    int Offset
);

/// <summary>
/// Event model for streaming agent steps.
/// </summary>
public record AgentStepEvent(
    string Type,
    string Content,
    DateTime Timestamp
);

/// <summary>
/// Request model for bulk article operations.
/// </summary>
public record BulkArticleRequest(List<string> Ids);

/// <summary>
/// Request model for hiding/unhiding an article.
/// </summary>
public record SetHiddenRequest(bool IsHidden);

/// <summary>
/// Request model for bulk hide/unhide operations.
/// </summary>
public record BulkHiddenRequest(List<string> Ids, bool IsHidden);

/// <summary>
/// Event model for streaming analysis steps.
/// </summary>
public record AnalysisStepEvent(
    string Type,
    string Content,
    DateTime Timestamp,
    string Panel
);

/// <summary>
/// Response model for stored analysis results.
/// </summary>
public record ArticleAnalysisResponse(
    string? FactCheckResult,
    string? BiasResult,
    DateTime AnalyzedAt
);
