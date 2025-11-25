using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using AggregoAi.ApiService.Scheduling;
using Microsoft.AspNetCore.Mvc;

namespace AggregoAi.ApiService.Controllers;

/// <summary>
/// Controller for RSS feed configuration operations.
/// Requirements: 1.1
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FeedController : ControllerBase
{
    private readonly IFeedConfigRepository _feedConfigRepository;
    private readonly IJobFactory _jobFactory;
    private readonly ILogger<FeedController> _logger;

    public FeedController(
        IFeedConfigRepository feedConfigRepository,
        IJobFactory jobFactory,
        ILogger<FeedController> logger)
    {
        _feedConfigRepository = feedConfigRepository;
        _jobFactory = jobFactory;
        _logger = logger;
    }

    /// <summary>
    /// Gets all RSS feed configurations.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RssFeedConfig>>> GetFeeds()
    {
        try
        {
            var feeds = await _feedConfigRepository.GetAllAsync();
            return Ok(feeds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feeds");
            return StatusCode(500, new { error = "Failed to retrieve feeds" });
        }
    }

    /// <summary>
    /// Gets a specific RSS feed configuration by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<RssFeedConfig>> GetFeed(string id)
    {
        try
        {
            var feed = await _feedConfigRepository.GetByIdAsync(id);
            
            if (feed == null)
            {
                return NotFound(new { error = $"Feed with ID '{id}' not found" });
            }

            return Ok(feed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feed {FeedId}", id);
            return StatusCode(500, new { error = "Failed to retrieve feed" });
        }
    }


    /// <summary>
    /// Creates a new RSS feed configuration and schedules its ingestion job.
    /// Requirements: 1.1
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<RssFeedConfig>> CreateFeed([FromBody] CreateFeedRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "Feed name is required" });
            }

            if (string.IsNullOrWhiteSpace(request.Url))
            {
                return BadRequest(new { error = "Feed URL is required" });
            }

            var feedConfig = new RssFeedConfig
            {
                Name = request.Name,
                Url = request.Url,
                CronExpression = request.CronExpression ?? "0 */15 * * * ?",
                IsEnabled = request.IsEnabled ?? true,
                MaxRetries = request.MaxRetries ?? 5,
                MisfireInstruction = request.MisfireInstruction ?? MisfireInstruction.FireNow,
                CreatedAt = DateTime.UtcNow
            };

            var createdFeed = await _feedConfigRepository.CreateAsync(feedConfig);

            // Create and schedule the ingestion job for this feed
            if (createdFeed.IsEnabled)
            {
                var (job, trigger) = await _jobFactory.CreateIngestionJobAsync(createdFeed);
                var definition = new PersistedJobDefinition
                {
                    JobKey = job.Key.Name,
                    JobGroup = job.Key.Group,
                    JobType = "Ingestion",
                    CronExpression = createdFeed.CronExpression,
                    JobData = new Dictionary<string, string> { { "FeedId", createdFeed.Id } },
                    CreatedAt = DateTime.UtcNow
                };
                await _jobFactory.ScheduleJobAsync(job, trigger, definition);
                
                _logger.LogInformation("Created ingestion job for feed {FeedName}", createdFeed.Name);
            }

            return CreatedAtAction(nameof(GetFeed), new { id = createdFeed.Id }, createdFeed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating feed");
            return StatusCode(500, new { error = "Failed to create feed" });
        }
    }

    /// <summary>
    /// Updates an existing RSS feed configuration.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<RssFeedConfig>> UpdateFeed(string id, [FromBody] UpdateFeedRequest request)
    {
        try
        {
            var existingFeed = await _feedConfigRepository.GetByIdAsync(id);
            
            if (existingFeed == null)
            {
                return NotFound(new { error = $"Feed with ID '{id}' not found" });
            }

            var updatedFeed = existingFeed with
            {
                Name = request.Name ?? existingFeed.Name,
                Url = request.Url ?? existingFeed.Url,
                CronExpression = request.CronExpression ?? existingFeed.CronExpression,
                IsEnabled = request.IsEnabled ?? existingFeed.IsEnabled,
                MaxRetries = request.MaxRetries ?? existingFeed.MaxRetries,
                MisfireInstruction = request.MisfireInstruction ?? existingFeed.MisfireInstruction
            };

            var result = await _feedConfigRepository.UpdateAsync(updatedFeed);
            
            if (result == null)
            {
                return StatusCode(500, new { error = "Failed to update feed" });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating feed {FeedId}", id);
            return StatusCode(500, new { error = "Failed to update feed" });
        }
    }

    /// <summary>
    /// Deletes an RSS feed configuration.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteFeed(string id)
    {
        try
        {
            var success = await _feedConfigRepository.DeleteAsync(id);
            
            if (!success)
            {
                return NotFound(new { error = $"Feed with ID '{id}' not found" });
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting feed {FeedId}", id);
            return StatusCode(500, new { error = "Failed to delete feed" });
        }
    }
}

/// <summary>
/// Request model for creating a new feed.
/// </summary>
public record CreateFeedRequest(
    string Name,
    string Url,
    string? CronExpression = null,
    bool? IsEnabled = null,
    int? MaxRetries = null,
    MisfireInstruction? MisfireInstruction = null
);

/// <summary>
/// Request model for updating a feed.
/// </summary>
public record UpdateFeedRequest(
    string? Name = null,
    string? Url = null,
    string? CronExpression = null,
    bool? IsEnabled = null,
    int? MaxRetries = null,
    MisfireInstruction? MisfireInstruction = null
);
