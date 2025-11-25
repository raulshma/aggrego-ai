using System.ClientModel;
using AggregoAi.ApiService.Repositories;
using Microsoft.Extensions.AI;
using OpenAI;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Manages AI chat client instances with hot-reload configuration from MongoDB.
/// Uses Microsoft.Extensions.AI with OpenRouter's OpenAI-compatible API.
/// </summary>
public class AiChatService(
    ISystemConfigRepository configRepository,
    IConfiguration appConfig,
    ILogger<AiChatService> logger) : IAiChatService
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private IChatClient? _chatClient;
    private string? _lastModelId;
    private string? _lastEndpoint;

    public async Task<IChatClient> GetChatClientAsync()
    {
        var currentConfig = await configRepository.GetAiConfigAsync();
        var endpoint = GetEndpoint();

        if (_chatClient is null || _lastModelId != currentConfig.ModelString || _lastEndpoint != endpoint)
        {
            await _lock.WaitAsync();
            try
            {
                if (_chatClient is null || _lastModelId != currentConfig.ModelString || _lastEndpoint != endpoint)
                {
                    _chatClient = BuildChatClient(currentConfig.ModelString, endpoint);
                    _lastModelId = currentConfig.ModelString;
                    _lastEndpoint = endpoint;
                    logger.LogInformation(
                        "AI Chat Client configured with model: {Model}, endpoint: {Endpoint}",
                        currentConfig.ModelString,
                        endpoint ?? "default");
                }
            }
            finally
            {
                _lock.Release();
            }
        }

        return _chatClient;
    }

    public async Task<AiChatOptions> GetChatOptionsAsync()
    {
        var config = await configRepository.GetAiConfigAsync();
        return new AiChatOptions(
            config.ModelString,
            (float)config.Temperature,
            Math.Min(config.MaxContextTokens, 4096)
        );
    }

    public async Task RefreshConfigurationAsync()
    {
        await _lock.WaitAsync();
        try
        {
            var currentConfig = await configRepository.GetAiConfigAsync();
            var endpoint = GetEndpoint();
            _chatClient = BuildChatClient(currentConfig.ModelString, endpoint);
            _lastModelId = currentConfig.ModelString;
            _lastEndpoint = endpoint;
            logger.LogInformation("AI Chat Client configuration refreshed");
        }
        finally
        {
            _lock.Release();
        }
    }

    private IChatClient BuildChatClient(string modelId, string? endpoint)
    {
        var apiKey = appConfig["AI:ApiKey"] ?? appConfig["OpenRouter:ApiKey"] ?? "";

        if (string.IsNullOrEmpty(apiKey))
        {
            logger.LogWarning("No AI API key configured. Set AI:ApiKey in configuration.");
        }

        var credential = new ApiKeyCredential(apiKey);
        var options = new OpenAIClientOptions();

        if (!string.IsNullOrEmpty(endpoint))
        {
            // OpenRouter endpoint should be https://openrouter.ai/api/v1
            // The OpenAI SDK appends /chat/completions automatically
            var baseEndpoint = endpoint.TrimEnd('/');
            
            // Remove /chat/completions if present (user might have included it)
            if (baseEndpoint.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase))
            {
                baseEndpoint = baseEndpoint[..^"/chat/completions".Length];
            }
            
            options.Endpoint = new Uri(baseEndpoint);
            logger.LogInformation("OpenRouter endpoint configured: {Endpoint}", baseEndpoint);
        }

        logger.LogInformation("Creating OpenAI client - Model: {Model}, Endpoint: {Endpoint}", 
            modelId, options.Endpoint);

        var client = new OpenAIClient(credential, options);
        var chatClient = client.GetChatClient(modelId);
        
        return chatClient.AsIChatClient();
    }

    private string? GetEndpoint() => 
        appConfig["AI:Endpoint"] ?? appConfig["OpenRouter:Endpoint"];
}
