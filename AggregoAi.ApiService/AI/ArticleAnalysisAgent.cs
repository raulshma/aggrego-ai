using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.Extensions.AI;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Implementation of IArticleAnalysisAgent for comprehensive article analysis.
/// Uses Microsoft.Extensions.AI with streaming and native tool calling via OpenRouter.
/// </summary>
public partial class ArticleAnalysisAgent(
    IAiChatService aiChatService,
    ISearXNGTool searxngTool,
    IArticleSearchTool articleSearchTool,
    ILogger<ArticleAnalysisAgent> logger) : IArticleAnalysisAgent
{
    private const int MaxToolIterations = 5;

    private const string FactCheckSystemPrompt = """
        You are a fact-checking AI assistant specializing in Indian and international news.
        Your task is to verify claims made in news articles.
        
        You have access to tools to search for information. Use them to verify claims.
        After gathering information, provide your final assessment as JSON:
        {
            "status": "verified|partially_verified|unverified|misleading",
            "summary": "Brief summary of findings",
            "claims": [
                {
                    "claim": "The specific claim",
                    "verdict": "true|mostly_true|mixed|mostly_false|false|unverifiable",
                    "explanation": "Why this verdict",
                    "sources": ["source1", "source2"]
                }
            ],
            "sources": [
                {"title": "Source title", "url": "https://...", "relevance": "How it relates"}
            ]
        }
        """;

    private const string BiasAnalysisSystemPrompt = """
        You are a media bias analyst specializing in Indian political spectrum and international news.
        
        Indian Political Spectrum:
        - Far Left to Far Right scale considering Indian political context
        - For international news, use standard left-right spectrum
        
        Analyze for: language choices, framing, source selection, omissions, emotional appeals.
        
        Provide your analysis as JSON:
        {
            "overallBias": "far_left|left|center_left|center|center_right|right|far_right",
            "confidence": 75,
            "indicators": [
                {
                    "type": "language|framing|source_selection|omission|emotional_appeal",
                    "description": "Specific example",
                    "severity": "low|medium|high",
                    "leaning": "left|right|neutral"
                }
            ],
            "context": "Overall analysis explanation",
            "regionalContext": "Indian political context if applicable"
        }
        """;

    public async IAsyncEnumerable<AnalysisStep> AnalyzeArticleAsync(
        Models.Article article,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chatClient = await aiChatService.GetChatClientAsync();
        var options = await aiChatService.GetChatOptionsAsync();

        var articleContent = $"""
            Title: {article.Title}
            Source: {article.SourceFeedName ?? article.SourceFeedId}
            Published: {article.PublicationDate:yyyy-MM-dd}
            Content: {article.Description ?? "(No description available)"}
            Link: {article.Link}
            """;

        await foreach (var step in RunFactCheckWithToolsAsync(chatClient, options, articleContent, cancellationToken))
        {
            yield return step;
        }

        await foreach (var step in RunBiasAnalysisStreamingAsync(chatClient, options, articleContent, cancellationToken))
        {
            yield return step;
        }
    }

    private async IAsyncEnumerable<AnalysisStep> RunFactCheckWithToolsAsync(
        IChatClient chatClient,
        AiChatOptions options,
        string articleContent,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        yield return new AnalysisStep(AnalysisStepType.Thought, "Starting fact-check analysis...", DateTime.UtcNow, AnalysisPanel.FactCheck);

        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, FactCheckSystemPrompt),
            new(ChatRole.User, $"Analyze and fact-check this article:\n\n{articleContent}")
        };

        var tools = new List<AITool>
        {
            AIFunctionFactory.Create(
                (string query) => query,
                "web_search",
                "Search the web for recent news and information to verify claims"),
            AIFunctionFactory.Create(
                (string query) => query,
                "article_search",
                "Search our article database for related news articles")
        };

        var chatOptions = new ChatOptions
        {
            Temperature = options.Temperature,
            MaxOutputTokens = options.MaxTokens,
            Tools = tools,
            ToolMode = ChatToolMode.Auto
        };

        var iteration = 0;
        while (iteration < MaxToolIterations && !cancellationToken.IsCancellationRequested)
        {
            iteration++;
            var streamResult = await CollectStreamingResponseAsync(chatClient, messages, chatOptions, cancellationToken);

            if (streamResult.Error != null)
            {
                yield return new AnalysisStep(AnalysisStepType.Error, streamResult.Error, DateTime.UtcNow, AnalysisPanel.FactCheck);
                yield break;
            }

            // Add to history
            if (!string.IsNullOrEmpty(streamResult.Text) || streamResult.ToolCalls.Count > 0)
            {
                var contents = new List<AIContent>();
                if (!string.IsNullOrEmpty(streamResult.Text))
                    contents.Add(new TextContent(streamResult.Text));
                contents.AddRange(streamResult.ToolCalls);
                messages.Add(new ChatMessage(ChatRole.Assistant, contents));
            }

            // Handle tool calls
            if (streamResult.ToolCalls.Count > 0)
            {
                var toolResults = new List<AIContent>();
                foreach (var tc in streamResult.ToolCalls)
                {
                    var arg = tc.Arguments?.Values.FirstOrDefault()?.ToString() ?? "";
                    yield return new AnalysisStep(AnalysisStepType.Action, $"Searching: {arg}", DateTime.UtcNow, AnalysisPanel.FactCheck);

                    var result = tc.Name switch
                    {
                        "web_search" => await ExecuteWebSearchAsync(arg, cancellationToken),
                        "article_search" => await ExecuteArticleSearchAsync(arg, cancellationToken),
                        _ => "Unknown tool"
                    };

                    toolResults.Add(new FunctionResultContent(tc.CallId, result));
                    yield return new AnalysisStep(AnalysisStepType.Observation, TruncateText(result, 500), DateTime.UtcNow, AnalysisPanel.FactCheck);
                }
                messages.Add(new ChatMessage(ChatRole.Tool, toolResults));
                continue;
            }

            // Final response - extract JSON
            if (!string.IsNullOrEmpty(streamResult.Text))
            {
                var json = ExtractJson(streamResult.Text);
                if (json != null)
                {
                    yield return new AnalysisStep(AnalysisStepType.Result, json, DateTime.UtcNow, AnalysisPanel.FactCheck);
                }
                else
                {
                    yield return new AnalysisStep(AnalysisStepType.Thought, streamResult.Text, DateTime.UtcNow, AnalysisPanel.FactCheck);
                }
                yield break;
            }
            break;
        }
    }


    private async IAsyncEnumerable<AnalysisStep> RunBiasAnalysisStreamingAsync(
        IChatClient chatClient,
        AiChatOptions options,
        string articleContent,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        yield return new AnalysisStep(AnalysisStepType.Thought, "Analyzing article for political bias...", DateTime.UtcNow, AnalysisPanel.Bias);

        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, BiasAnalysisSystemPrompt),
            new(ChatRole.User, $"Analyze the political bias in this article:\n\n{articleContent}")
        };

        var chatOptions = new ChatOptions
        {
            Temperature = options.Temperature,
            MaxOutputTokens = options.MaxTokens
        };

        var streamResult = await CollectStreamingResponseAsync(chatClient, messages, chatOptions, cancellationToken);

        if (streamResult.Error != null)
        {
            yield return new AnalysisStep(AnalysisStepType.Error, streamResult.Error, DateTime.UtcNow, AnalysisPanel.Bias);
            yield break;
        }

        if (string.IsNullOrEmpty(streamResult.Text))
        {
            yield return new AnalysisStep(AnalysisStepType.Error, "No response from AI", DateTime.UtcNow, AnalysisPanel.Bias);
            yield break;
        }

        var json = ExtractJson(streamResult.Text);
        if (json != null)
        {
            yield return new AnalysisStep(AnalysisStepType.Result, json, DateTime.UtcNow, AnalysisPanel.Bias);
        }
        else
        {
            yield return new AnalysisStep(AnalysisStepType.Thought, streamResult.Text, DateTime.UtcNow, AnalysisPanel.Bias);
        }
    }

    private async Task<StreamResult> CollectStreamingResponseAsync(
        IChatClient chatClient,
        List<ChatMessage> messages,
        ChatOptions chatOptions,
        CancellationToken cancellationToken)
    {
        var responseBuilder = new StringBuilder();
        var toolCalls = new List<FunctionCallContent>();

        try
        {
            await foreach (var update in chatClient.GetStreamingResponseAsync(messages, chatOptions, cancellationToken))
            {
                if (!string.IsNullOrEmpty(update.Text))
                {
                    responseBuilder.Append(update.Text);
                }

                foreach (var content in update.Contents)
                {
                    if (content is FunctionCallContent fc)
                    {
                        toolCalls.Add(fc);
                    }
                }
            }

            return new StreamResult(responseBuilder.ToString(), toolCalls, null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during streaming response");
            return new StreamResult("", [], $"API error: {ex.Message}");
        }
    }

    private async Task<string> ExecuteWebSearchAsync(string query, CancellationToken cancellationToken)
    {
        var result = await searxngTool.SearchAsync(query, cancellationToken: cancellationToken);
        if (result.Items.Count == 0) return "No search results found.";

        var sb = new StringBuilder();
        sb.AppendLine($"Found {result.Items.Count} results:");
        foreach (var item in result.Items.Take(5))
        {
            sb.AppendLine($"- {item.Title}");
            sb.AppendLine($"  URL: {item.Url}");
            sb.AppendLine($"  {TruncateText(item.Content, 200)}");
        }
        return sb.ToString();
    }

    private async Task<string> ExecuteArticleSearchAsync(string claim, CancellationToken cancellationToken)
    {
        var articles = await articleSearchTool.FindSimilarAsync(claim, 5, cancellationToken);
        var articleList = articles.ToList();
        if (articleList.Count == 0) return "No similar articles found.";

        var sb = new StringBuilder();
        sb.AppendLine($"Found {articleList.Count} similar articles:");
        foreach (var article in articleList)
        {
            sb.AppendLine($"- {article.Title}");
            sb.AppendLine($"  Source: {article.SourceFeedName ?? article.SourceFeedId}");
            sb.AppendLine($"  {TruncateText(article.Description ?? "", 150)}");
        }
        return sb.ToString();
    }

    private static string? ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : null;
    }

    private static string TruncateText(string text, int maxLength) =>
        string.IsNullOrEmpty(text) || text.Length <= maxLength ? text : text[..(maxLength - 3)] + "...";

    private record StreamResult(string Text, List<FunctionCallContent> ToolCalls, string? Error);
}
