using Microsoft.Extensions.AI;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Service interface for managing AI chat client with hot-reload configuration.
/// Uses Microsoft.Extensions.AI with OpenRouter's OpenAI-compatible API.
/// </summary>
public interface IAiChatService
{
    /// <summary>
    /// Gets a configured IChatClient instance with current AI settings.
    /// </summary>
    Task<IChatClient> GetChatClientAsync();
    
    /// <summary>
    /// Gets the current AI configuration (model, temperature, etc.).
    /// </summary>
    Task<AiChatOptions> GetChatOptionsAsync();
    
    /// <summary>
    /// Refreshes the chat client configuration from the system config repository.
    /// </summary>
    Task RefreshConfigurationAsync();
}

/// <summary>
/// Options for AI chat completions.
/// </summary>
public record AiChatOptions(
    string ModelId,
    float Temperature,
    int MaxTokens
);
