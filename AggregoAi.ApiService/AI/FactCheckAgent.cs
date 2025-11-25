using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Repositories;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Implementation of IFactCheckAgent using the ReAct (Reason-Act) pattern.
/// Uses Semantic Kernel for LLM interactions and tools for external data.
/// </summary>
public partial class FactCheckAgent : IFactCheckAgent
{
    private readonly ISemanticKernelService _kernelService;
    private readonly ISearXNGTool _searxngTool;
    private readonly IArticleSearchTool _articleSearchTool;
    private readonly ISystemConfigRepository _configRepository;
    private readonly ILogger<FactCheckAgent> _logger;

    private const int MaxIterations = 10;
    private const string SystemPrompt = """
        You are a fact-checking AI assistant. Your task is to verify the claims made in news articles.
        
        You have access to the following tools:
        1. web_search(query) - Search the web for information using SearXNG
        2. article_search(claim) - Search for similar articles in our database
        
        Use the ReAct pattern to reason through the verification:
        1. THOUGHT: Analyze what you need to verify and plan your approach
        2. ACTION: Call a tool to gather information (format: ACTION: tool_name(argument))
        3. OBSERVATION: Review the results from the tool
        4. Repeat steps 1-3 as needed
        5. FINAL ANSWER: Provide your verdict with supporting evidence
        
        When you have enough information, provide your final answer in this exact format:
        FINAL ANSWER:
        Assessment: [Your detailed assessment of the article's accuracy]
        Confidence: [Low/Medium/High]
        Citations:
        - Source: [source name], URL: [url], Excerpt: [relevant excerpt]
        
        Be thorough but efficient. Aim to verify key claims with 2-4 tool calls.
        """;

    public FactCheckAgent(
        ISemanticKernelService kernelService,
        ISearXNGTool searxngTool,
        IArticleSearchTool articleSearchTool,
        ISystemConfigRepository configRepository,
        ILogger<FactCheckAgent> logger)
    {
        _kernelService = kernelService;
        _searxngTool = searxngTool;
        _articleSearchTool = articleSearchTool;
        _configRepository = configRepository;
        _logger = logger;
    }


    public async IAsyncEnumerable<AgentStep> VerifyArticleAsync(
        Article article, 
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var kernel = await _kernelService.GetKernelAsync();
        var aiConfig = await _configRepository.GetAiConfigAsync();
        var chatService = kernel.GetRequiredService<IChatCompletionService>();
        
        var chatHistory = new ChatHistory();
        chatHistory.AddSystemMessage(SystemPrompt);
        
        // Initial user message with article content
        var userMessage = $"""
            Please verify the following news article:
            
            Title: {article.Title}
            Source: {article.SourceFeedName ?? article.SourceFeedId}
            Published: {article.PublicationDate:yyyy-MM-dd}
            
            Content:
            {article.Description ?? "(No description available)"}
            
            Link: {article.Link}
            
            Analyze the key claims and verify their accuracy using the available tools.
            """;
        
        chatHistory.AddUserMessage(userMessage);
        
        var citations = new List<Citation>();
        var iteration = 0;

        while (iteration < MaxIterations && !cancellationToken.IsCancellationRequested)
        {
            iteration++;
            _logger.LogDebug("ReAct iteration {Iteration}", iteration);

            // Get LLM response
            var settings = new PromptExecutionSettings
            {
                ExtensionData = new Dictionary<string, object>
                {
                    ["temperature"] = aiConfig.Temperature,
                    ["max_tokens"] = Math.Min(aiConfig.MaxContextTokens, 2048)
                }
            };

            var response = await chatService.GetChatMessageContentAsync(
                chatHistory, 
                settings, 
                kernel, 
                cancellationToken);

            var responseText = response.Content ?? "";
            chatHistory.AddAssistantMessage(responseText);


            // Parse and yield steps from the response
            var steps = ParseReActResponse(responseText);
            foreach (var step in steps)
            {
                yield return step;
                
                // If this is a final answer, we're done
                if (step.Type == AgentStepType.FinalAnswer)
                {
                    yield break;
                }
            }

            // Check for action and execute tool
            var actionMatch = ActionRegex().Match(responseText);
            if (actionMatch.Success)
            {
                var toolName = actionMatch.Groups[1].Value.Trim().ToLowerInvariant();
                var argument = actionMatch.Groups[2].Value.Trim();
                
                yield return new AgentStep(
                    AgentStepType.Action,
                    $"Calling {toolName} with: {argument}",
                    DateTime.UtcNow);

                var observation = await ExecuteToolAsync(toolName, argument, citations, cancellationToken);
                
                yield return new AgentStep(
                    AgentStepType.Observation,
                    observation,
                    DateTime.UtcNow);

                // Add observation to chat history for next iteration
                chatHistory.AddUserMessage($"OBSERVATION: {observation}");
            }
            else if (!responseText.Contains("FINAL ANSWER", StringComparison.OrdinalIgnoreCase))
            {
                // No action and no final answer - prompt for continuation
                chatHistory.AddUserMessage("Please continue with your analysis. Use ACTION to call a tool or provide your FINAL ANSWER.");
            }
        }

        // If we hit max iterations without a final answer, generate one
        if (iteration >= MaxIterations)
        {
            _logger.LogWarning("ReAct agent hit max iterations without final answer");
            yield return new AgentStep(
                AgentStepType.FinalAnswer,
                "Unable to complete verification within iteration limit. Please try again.",
                DateTime.UtcNow);
        }
    }


    private async Task<string> ExecuteToolAsync(
        string toolName, 
        string argument, 
        List<Citation> citations,
        CancellationToken cancellationToken)
    {
        try
        {
            return toolName switch
            {
                "web_search" => await ExecuteWebSearchAsync(argument, citations, cancellationToken),
                "article_search" => await ExecuteArticleSearchAsync(argument, citations, cancellationToken),
                _ => $"Unknown tool: {toolName}. Available tools: web_search, article_search"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing tool {Tool} with argument {Argument}", toolName, argument);
            return $"Error executing {toolName}: {ex.Message}";
        }
    }

    private async Task<string> ExecuteWebSearchAsync(
        string query, 
        List<Citation> citations,
        CancellationToken cancellationToken)
    {
        var result = await _searxngTool.SearchAsync(query, cancellationToken: cancellationToken);
        
        if (result.Items.Count == 0)
        {
            return "No search results found.";
        }

        var sb = new StringBuilder();
        sb.AppendLine($"Found {result.Items.Count} results:");
        
        foreach (var item in result.Items.Take(5))
        {
            sb.AppendLine($"- {item.Title}");
            sb.AppendLine($"  URL: {item.Url}");
            sb.AppendLine($"  {TruncateText(item.Content, 200)}");
            sb.AppendLine();
            
            // Add to citations
            citations.Add(new Citation(item.Title, item.Url, TruncateText(item.Content, 100)));
        }

        return sb.ToString();
    }

    private async Task<string> ExecuteArticleSearchAsync(
        string claim, 
        List<Citation> citations,
        CancellationToken cancellationToken)
    {
        var articles = await _articleSearchTool.FindSimilarAsync(claim, 5, cancellationToken);
        var articleList = articles.ToList();
        
        if (articleList.Count == 0)
        {
            return "No similar articles found in our database.";
        }

        var sb = new StringBuilder();
        sb.AppendLine($"Found {articleList.Count} similar articles:");
        
        foreach (var article in articleList)
        {
            sb.AppendLine($"- {article.Title}");
            sb.AppendLine($"  Source: {article.SourceFeedName ?? article.SourceFeedId}");
            sb.AppendLine($"  Published: {article.PublicationDate:yyyy-MM-dd}");
            sb.AppendLine($"  {TruncateText(article.Description ?? "", 150)}");
            sb.AppendLine();
            
            // Add to citations
            citations.Add(new Citation(
                article.SourceFeedName ?? article.SourceFeedId,
                article.Link,
                TruncateText(article.Description ?? article.Title, 100)));
        }

        return sb.ToString();
    }


    private static List<AgentStep> ParseReActResponse(string response)
    {
        var steps = new List<AgentStep>();
        var lines = response.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var currentType = AgentStepType.Thought;
        var currentContent = new StringBuilder();

        foreach (var line in lines)
        {
            var trimmedLine = line.Trim();
            
            if (trimmedLine.StartsWith("THOUGHT:", StringComparison.OrdinalIgnoreCase))
            {
                FlushCurrentStep(steps, currentType, currentContent);
                currentType = AgentStepType.Thought;
                currentContent.AppendLine(trimmedLine[8..].Trim());
            }
            else if (trimmedLine.StartsWith("ACTION:", StringComparison.OrdinalIgnoreCase))
            {
                FlushCurrentStep(steps, currentType, currentContent);
                currentType = AgentStepType.Action;
                currentContent.AppendLine(trimmedLine[7..].Trim());
            }
            else if (trimmedLine.StartsWith("OBSERVATION:", StringComparison.OrdinalIgnoreCase))
            {
                FlushCurrentStep(steps, currentType, currentContent);
                currentType = AgentStepType.Observation;
                currentContent.AppendLine(trimmedLine[12..].Trim());
            }
            else if (trimmedLine.StartsWith("FINAL ANSWER:", StringComparison.OrdinalIgnoreCase))
            {
                FlushCurrentStep(steps, currentType, currentContent);
                currentType = AgentStepType.FinalAnswer;
                currentContent.AppendLine(trimmedLine[13..].Trim());
            }
            else if (currentContent.Length > 0 || !string.IsNullOrWhiteSpace(trimmedLine))
            {
                currentContent.AppendLine(trimmedLine);
            }
        }

        FlushCurrentStep(steps, currentType, currentContent);
        return steps;
    }

    private static void FlushCurrentStep(List<AgentStep> steps, AgentStepType type, StringBuilder content)
    {
        var text = content.ToString().Trim();
        if (!string.IsNullOrEmpty(text))
        {
            steps.Add(new AgentStep(type, text, DateTime.UtcNow));
        }
        content.Clear();
    }

    private static string TruncateText(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
            return text;
        return text[..(maxLength - 3)] + "...";
    }

    [GeneratedRegex(@"ACTION:\s*(\w+)\s*\(\s*(.+?)\s*\)", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex ActionRegex();
}
