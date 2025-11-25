using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Service for persisting job definitions and state to MongoDB.
/// Provides persistence layer for Quartz jobs to survive restarts.
/// Requirements: 2.1, 2.2, 2.3
/// </summary>
public interface IJobPersistenceService
{
    /// <summary>
    /// Saves a job definition to MongoDB.
    /// </summary>
    Task SaveJobDefinitionAsync(PersistedJobDefinition definition);

    /// <summary>
    /// Gets all persisted job definitions.
    /// </summary>
    Task<IEnumerable<PersistedJobDefinition>> GetAllJobDefinitionsAsync();

    /// <summary>
    /// Gets a job definition by key.
    /// </summary>
    Task<PersistedJobDefinition?> GetJobDefinitionAsync(string jobKey, string jobGroup);

    /// <summary>
    /// Updates a job definition.
    /// </summary>
    Task UpdateJobDefinitionAsync(PersistedJobDefinition definition);

    /// <summary>
    /// Deletes a job definition.
    /// </summary>
    Task DeleteJobDefinitionAsync(string jobKey, string jobGroup);

    /// <summary>
    /// Updates the pause state of a job.
    /// </summary>
    Task UpdatePauseStateAsync(string jobKey, string jobGroup, bool isPaused);

    /// <summary>
    /// Updates the last execution info for a job.
    /// </summary>
    Task UpdateLastExecutionAsync(string jobKey, string jobGroup, DateTime executionTime, JobExecutionStatus status);
}
