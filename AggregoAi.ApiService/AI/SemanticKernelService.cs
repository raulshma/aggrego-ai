using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Microsoft.SemanticKernel;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Manages Semantic Kernel instances with hot-reload configuration from MongoDB.
/// Integrates with ISystemConfigRepository for dynamic AI parameter updates.
/// </summary>
public class SemanticKernelService : ISemanticKernelService
{
    private readonly ISystemConfigRepository _configRepository;
    private readonly IConfiguration _appConfig;
    private readonly ILogger<SemanticKernelService> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);
    
    private Kernel? _kernel;
    private AiConfig? _lastConfig;

    public SemanticKernelService(
        ISystemConfigRepository configRepository,
        IConfiguration appConfig,
        ILogger<SemanticKernelService> logger)
    {
        _configRepository = configRepository;
        _appConfig = appConfig;
        _logger = logger;
    }

    public async Task<Kernel> GetKernelAsync()
    {
        var currentConfig = await _configRepository.GetAiConfigAsync();
        
        // Check if we need to rebuild the kernel due to config changes
        if (_kernel is null || !ConfigEquals(_lastConfig, currentConfig))
        {
            await _lock.WaitAsync();
            try
            {
                // Double-check after acquiring lock
                if (_kernel is null || !ConfigEquals(_lastConfig, currentConfig))
                {
                    _kernel = BuildKernel(currentConfig);
                    _lastConfig = currentConfig;
                    _logger.LogInformation(
                        "Semantic Kernel configured with model: {Model}, temperature: {Temperature}",
                        currentConfig.ModelString,
                        currentConfig.Temperature);
                }
            }
            finally
            {
                _lock.Release();
            }
        }

        return _kernel;
    }


    public async Task RefreshConfigurationAsync()
    {
        await _lock.WaitAsync();
        try
        {
            var currentConfig = await _configRepository.GetAiConfigAsync();
            _kernel = BuildKernel(currentConfig);
            _lastConfig = currentConfig;
            _logger.LogInformation("Semantic Kernel configuration refreshed");
        }
        finally
        {
            _lock.Release();
        }
    }

    private Kernel BuildKernel(AiConfig config)
    {
        var builder = Kernel.CreateBuilder();
        
        // Get API key and endpoint from app configuration
        var apiKey = _appConfig["AI:ApiKey"] ?? _appConfig["OpenAI:ApiKey"] ?? "";
        var endpoint = _appConfig["AI:Endpoint"] ?? _appConfig["OpenAI:Endpoint"];
        
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("No AI API key configured. Set AI:ApiKey or OpenAI:ApiKey in configuration.");
        }

        // Support both OpenAI and OpenRouter (via custom endpoint)
        if (!string.IsNullOrEmpty(endpoint))
        {
            // OpenRouter or custom endpoint
            builder.AddOpenAIChatCompletion(
                modelId: config.ModelString,
                apiKey: apiKey,
                endpoint: new Uri(endpoint));
        }
        else
        {
            // Standard OpenAI
            builder.AddOpenAIChatCompletion(
                modelId: config.ModelString,
                apiKey: apiKey);
        }

        return builder.Build();
    }

    private static bool ConfigEquals(AiConfig? a, AiConfig? b)
    {
        if (a is null || b is null) return false;
        return a.ModelString == b.ModelString &&
               Math.Abs(a.Temperature - b.Temperature) < 0.001 &&
               a.MaxContextTokens == b.MaxContextTokens;
    }
}
