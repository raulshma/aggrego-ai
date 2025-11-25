using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace AggregoAi.ApiService.Controllers;

/// <summary>
/// Controller for system configuration operations.
/// Requirements: 4.1, 4.2, 4.3, 4.4
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly ISystemConfigRepository _configRepository;
    private readonly ILogger<ConfigController> _logger;

    public ConfigController(
        ISystemConfigRepository configRepository,
        ILogger<ConfigController> logger)
    {
        _configRepository = configRepository;
        _logger = logger;
    }

    /// <summary>
    /// Gets all system configuration.
    /// Requirements: 4.4
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<SystemConfig>> GetConfig()
    {
        try
        {
            var config = await _configRepository.GetAllAsync();
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving configuration");
            return StatusCode(500, new { error = "Failed to retrieve configuration" });
        }
    }

    /// <summary>
    /// Updates system configuration.
    /// Requirements: 4.1, 4.2, 4.3
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<SystemConfig>> UpdateConfig([FromBody] UpdateConfigRequest request)
    {
        try
        {
            if (request.AiSettings != null)
            {
                await _configRepository.SetAiConfigAsync(request.AiSettings);
                _logger.LogInformation("AI settings updated");
            }

            if (request.SearchSettings != null)
            {
                await _configRepository.SetSearchConfigAsync(request.SearchSettings);
                _logger.LogInformation("Search settings updated");
            }

            var updatedConfig = await _configRepository.GetAllAsync();
            return Ok(updatedConfig);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating configuration");
            return StatusCode(500, new { error = "Failed to update configuration" });
        }
    }


    /// <summary>
    /// Gets AI configuration.
    /// Requirements: 4.2
    /// </summary>
    [HttpGet("ai")]
    public async Task<ActionResult<AiConfig>> GetAiConfig()
    {
        try
        {
            var config = await _configRepository.GetAiConfigAsync();
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving AI configuration");
            return StatusCode(500, new { error = "Failed to retrieve AI configuration" });
        }
    }

    /// <summary>
    /// Updates AI configuration.
    /// Requirements: 4.2
    /// </summary>
    [HttpPut("ai")]
    public async Task<ActionResult<AiConfig>> UpdateAiConfig([FromBody] AiConfig config)
    {
        try
        {
            await _configRepository.SetAiConfigAsync(config);
            _logger.LogInformation("AI configuration updated: Model={Model}, Temperature={Temperature}", 
                config.ModelString, config.Temperature);
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating AI configuration");
            return StatusCode(500, new { error = "Failed to update AI configuration" });
        }
    }

    /// <summary>
    /// Gets search configuration.
    /// Requirements: 4.3
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<SearchConfig>> GetSearchConfig()
    {
        try
        {
            var config = await _configRepository.GetSearchConfigAsync();
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving search configuration");
            return StatusCode(500, new { error = "Failed to retrieve search configuration" });
        }
    }

    /// <summary>
    /// Updates search configuration.
    /// Requirements: 4.3
    /// </summary>
    [HttpPut("search")]
    public async Task<ActionResult<SearchConfig>> UpdateSearchConfig([FromBody] SearchConfig config)
    {
        try
        {
            await _configRepository.SetSearchConfigAsync(config);
            _logger.LogInformation("Search configuration updated: MaxResults={MaxResults}", config.MaxResults);
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating search configuration");
            return StatusCode(500, new { error = "Failed to update search configuration" });
        }
    }

    /// <summary>
    /// Gets the status of a feature flag.
    /// Requirements: 4.1
    /// </summary>
    [HttpGet("features/{key}")]
    public async Task<ActionResult<FeatureFlagResponse>> GetFeatureFlag(string key)
    {
        try
        {
            var isEnabled = await _configRepository.IsFeatureEnabledAsync(key);
            return Ok(new FeatureFlagResponse(key, isEnabled));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feature flag {Key}", key);
            return StatusCode(500, new { error = "Failed to retrieve feature flag" });
        }
    }

    /// <summary>
    /// Toggles a feature flag.
    /// Requirements: 4.1
    /// </summary>
    [HttpPost("features/{key}")]
    public async Task<ActionResult<FeatureFlagResponse>> ToggleFeatureFlag(
        string key, 
        [FromBody] ToggleFeatureRequest request)
    {
        try
        {
            await _configRepository.SetFeatureEnabledAsync(key, request.Enabled);
            _logger.LogInformation("Feature flag '{Key}' set to {Enabled}", key, request.Enabled);
            return Ok(new FeatureFlagResponse(key, request.Enabled));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling feature flag {Key}", key);
            return StatusCode(500, new { error = "Failed to toggle feature flag" });
        }
    }
}

/// <summary>
/// Request model for updating configuration.
/// </summary>
public record UpdateConfigRequest(
    AiConfig? AiSettings = null,
    SearchConfig? SearchSettings = null
);

/// <summary>
/// Request model for toggling a feature flag.
/// </summary>
public record ToggleFeatureRequest(bool Enabled);

/// <summary>
/// Response model for feature flag status.
/// </summary>
public record FeatureFlagResponse(string Key, bool Enabled);
