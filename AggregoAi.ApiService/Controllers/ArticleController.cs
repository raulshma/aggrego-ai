using AggregoAi.ApiService.AI;
using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

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
    private readonly ILogger<ArticleController> _logger;

    public ArticleController(
        IArticleRepository articleRepository,
        IFactCheckAgent factCheckAgent,
        ILogger<ArticleController> logger)
    {
        _articleRepository = articleRepository;
        _factCheckAgent = factCheckAgent;
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

                var json = JsonSerializer.Serialize(eventData);
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
            var errorJson = JsonSerializer.Serialize(errorEvent);
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
