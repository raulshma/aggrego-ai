using Microsoft.SemanticKernel;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Service interface for managing Semantic Kernel instances with hot-reload configuration.
/// </summary>
public interface ISemanticKernelService
{
    /// <summary>
    /// Gets a configured Kernel instance with current AI settings.
    /// </summary>
    Task<Kernel> GetKernelAsync();
    
    /// <summary>
    /// Refreshes the kernel configuration from the system config repository.
    /// </summary>
    Task RefreshConfigurationAsync();
}
