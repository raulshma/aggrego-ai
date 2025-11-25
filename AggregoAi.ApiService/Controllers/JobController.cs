using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Scheduling;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AggregoAi.ApiService.Controllers;

/// <summary>
/// Controller for job management operations.
/// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class JobController : ControllerBase
{
    private readonly IJobManagementService _jobManagementService;
    private readonly ILogger<JobController> _logger;

    public JobController(
        IJobManagementService jobManagementService,
        ILogger<JobController> logger)
    {
        _jobManagementService = jobManagementService;
        _logger = logger;
    }

    /// <summary>
    /// Gets all registered jobs with their status.
    /// Requirements: 3.1
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<JobInfo>>> GetJobs()
    {
        try
        {
            var jobs = await _jobManagementService.GetAllJobsAsync();
            return Ok(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving jobs");
            return StatusCode(500, new { error = "Failed to retrieve jobs" });
        }
    }

    /// <summary>
    /// Gets a specific job by key and group.
    /// Requirements: 3.1
    /// </summary>
    [HttpGet("{jobKey}/{jobGroup}")]
    public async Task<ActionResult<JobInfo>> GetJob(string jobKey, string jobGroup)
    {
        try
        {
            var job = await _jobManagementService.GetJobAsync(jobKey, jobGroup);
            
            if (job == null)
            {
                return NotFound(new { error = $"Job '{jobKey}.{jobGroup}' not found" });
            }

            return Ok(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving job {JobKey}.{JobGroup}", jobKey, jobGroup);
            return StatusCode(500, new { error = "Failed to retrieve job" });
        }
    }


    /// <summary>
    /// Pauses a job's trigger.
    /// Requirements: 3.2
    /// </summary>
    [HttpPost("{jobKey}/{jobGroup}/pause")]
    public async Task<ActionResult> PauseJob(string jobKey, string jobGroup)
    {
        try
        {
            var success = await _jobManagementService.PauseJobAsync(jobKey, jobGroup);
            
            if (!success)
            {
                return NotFound(new { error = $"Job '{jobKey}.{jobGroup}' not found or could not be paused" });
            }

            return Ok(new { message = $"Job '{jobKey}.{jobGroup}' paused successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing job {JobKey}.{JobGroup}", jobKey, jobGroup);
            return StatusCode(500, new { error = "Failed to pause job" });
        }
    }

    /// <summary>
    /// Resumes a paused job's trigger.
    /// Requirements: 3.3
    /// </summary>
    [HttpPost("{jobKey}/{jobGroup}/resume")]
    public async Task<ActionResult> ResumeJob(string jobKey, string jobGroup)
    {
        try
        {
            var success = await _jobManagementService.ResumeJobAsync(jobKey, jobGroup);
            
            if (!success)
            {
                return NotFound(new { error = $"Job '{jobKey}.{jobGroup}' not found or could not be resumed" });
            }

            return Ok(new { message = $"Job '{jobKey}.{jobGroup}' resumed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming job {JobKey}.{JobGroup}", jobKey, jobGroup);
            return StatusCode(500, new { error = "Failed to resume job" });
        }
    }

    /// <summary>
    /// Triggers a job to execute immediately.
    /// Requirements: 3.4
    /// </summary>
    [HttpPost("{jobKey}/{jobGroup}/trigger")]
    public async Task<ActionResult> TriggerJob(string jobKey, string jobGroup)
    {
        try
        {
            var success = await _jobManagementService.TriggerJobAsync(jobKey, jobGroup);
            
            if (!success)
            {
                return NotFound(new { error = $"Job '{jobKey}.{jobGroup}' not found or could not be triggered" });
            }

            return Ok(new { message = $"Job '{jobKey}.{jobGroup}' triggered successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error triggering job {JobKey}.{JobGroup}", jobKey, jobGroup);
            return StatusCode(500, new { error = "Failed to trigger job" });
        }
    }

    /// <summary>
    /// Reschedules a job with a new CRON expression.
    /// Requirements: 3.5
    /// </summary>
    [HttpPut("{jobKey}/{jobGroup}/schedule")]
    public async Task<ActionResult> RescheduleJob(
        string jobKey, 
        string jobGroup, 
        [FromBody] RescheduleRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.CronExpression))
            {
                return BadRequest(new { error = "CRON expression is required" });
            }

            var success = await _jobManagementService.RescheduleJobAsync(jobKey, jobGroup, request.CronExpression);
            
            if (!success)
            {
                return NotFound(new { error = $"Job '{jobKey}.{jobGroup}' not found or could not be rescheduled" });
            }

            return Ok(new { message = $"Job '{jobKey}.{jobGroup}' rescheduled successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rescheduling job {JobKey}.{JobGroup}", jobKey, jobGroup);
            return StatusCode(500, new { error = "Failed to reschedule job" });
        }
    }

    /// <summary>
    /// Gets execution history for a job.
    /// Requirements: 3.6
    /// </summary>
    [HttpGet("{jobKey}/history")]
    public async Task<ActionResult<IEnumerable<JobExecutionLog>>> GetJobHistory(
        string jobKey,
        [FromQuery] int limit = 50)
    {
        try
        {
            var history = await _jobManagementService.GetExecutionHistoryAsync(jobKey, limit);
            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving history for job {JobKey}", jobKey);
            return StatusCode(500, new { error = "Failed to retrieve job history" });
        }
    }
}

/// <summary>
/// Request model for rescheduling a job.
/// </summary>
public record RescheduleRequest(string CronExpression);
