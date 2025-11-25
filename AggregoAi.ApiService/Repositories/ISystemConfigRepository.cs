using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.Repositories;

/// <summary>
/// Repository interface for system configuration persistence.
/// </summary>
public interface ISystemConfigRepository
{
    Task<T?> GetValueAsync<T>(string key);
    Task SetValueAsync<T>(string key, T value);
    Task<SystemConfig> GetAllAsync();
    Task<bool> IsFeatureEnabledAsync(string featureKey);
    Task SetFeatureEnabledAsync(string featureKey, bool enabled);
    Task<AiConfig> GetAiConfigAsync();
    Task SetAiConfigAsync(AiConfig config);
    Task<SearchConfig> GetSearchConfigAsync();
    Task SetSearchConfigAsync(SearchConfig config);
}
