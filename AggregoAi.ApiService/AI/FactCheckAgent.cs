using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.Extensions.AI;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Implementation of IFactCheckAgent using streaming and native tool calling.
/// Uses Microsoft.Extensions.AI with OpenRouter.
/// </summary>
public partial class FactCheckAgent(
    IAiChatService aiChatService,
    ISearXNGTool searxngTool,
    IArticleSearchTool articleSearchTool,
    ILogger<FactCheckAgent> logger) : IFactCheckAgent
{
    private const int MaxToolIterations = 6;
    
    private const string SystemPrompt = """
        You are a fact-checking AI assistant. Verify claims in news articles using the available tools.
        
        Use tools to search for corroborating or contradicting information, then provide your verdict.
        
        Final response format:
        Assessment: [Your detailed assessment]
        Confidence: [Low/Medium/High]
        Citations:
        - Source: [name], URL: [url], Excerpt: [relevant text]
        """;

    public async IAsyncEnumerable<AgentStep> VerifyArticleAsync(
        Models.Article article, 
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chatClient = await aiChatService.GetChatClientAsync();
        var options = await aiChatService.GetChatOptionsAsync();
        
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, SystemPrompt),
            new(ChatRole.User, $"""
                Verify this article:
                Title: {article.Title}
                Source: {article.SourceFeedName ?? article.SourceFeedId}
                Published: {article.PublicationDate:yyyy-MM-dd}
                Content: {article.Description ?? "(No description)"}
                Link: {article.Link}
                """)
        };

        var tools = new List<AITool>
        {
            AIFunctionFactory.Create((string query) => query, "web_search", "Search the web"),
            AIFunctionFactory.Create((string query) => query, "article_search", "Search articles")
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
                yield return new AgentStep(AgentStepType.FinalAnswer, $"Error: {streamResult.Error}", DateTime.UtcNow);
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
                var results = new List<AIContent>();
                foreach (var tc in streamResult.ToolCalls)
                {
                    var arg = tc.Arguments?.Values.FirstOrDefault()?.ToString() ?? "";
                    yield return new AgentStep(AgentStepType.Action, $"{tc.Name}({arg})", DateTime.UtcNow);

                    var result = tc.Name switch
                    {
                        "web_search" => await ExecuteWebSearch(arg, cancellationToken),
                        "article_search" => await ExecuteArticleSearch(arg, cancellationToken),
                        _ => "Unknown tool"
                    };

                    results.Add(new FunctionResultContent(tc.CallId, result));
                    yield return new AgentStep(AgentStepType.Observation, TruncateText(result, 400), DateTime.UtcNow);
                }
                messages.Add(new ChatMessage(ChatRole.Tool, results));
                continue;
            }

            // Final response
            if (!string.IsNullOrEmpty(streamResult.Text))
            {
                yield return new AgentStep(AgentStepType.FinalAnswer, streamResult.Text, DateTime.UtcNow);
                yield break;
            }
        }

        yield return new AgentStep(AgentStepType.FinalAnswer, "Max iterations reached", DateTime.UtcNow);
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
                    responseBuilder.Append(update.Text);

                foreach (var content in update.Contents)
                {
                    if (content is FunctionCallContent fc)
                        toolCalls.Add(fc);
                }
            }
            return new StreamResult(responseBuilder.ToString(), toolCalls, null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Streaming error");
            return new StreamResult("", [], ex.Message);
        }
    }

    private async Task<string> ExecuteWebSearch(string query, CancellationToken ct)
    {
        var result = await searxngTool.SearchAsync(query, cancellationToken: ct);
        if (result.Items.Count == 0) return "No results.";
        var sb = new StringBuilder();
        foreach (var i in result.Items.Take(5))
            sb.AppendLine($"- {i.Title}: {TruncateText(i.Content, 150)} ({i.Url})");
        return sb.ToString();
    }

    private async Task<string> ExecuteArticleSearch(string query, CancellationToken ct)
    {
        var articles = await articleSearchTool.FindSimilarAsync(query, 5, ct);
        var list = articles.ToList();
        if (list.Count == 0) return "No articles found.";
        var sb = new StringBuilder();
        foreach (var a in list)
            sb.AppendLine($"- {a.Title} ({a.SourceFeedName}): {TruncateText(a.Description ?? "", 100)}");
        return sb.ToString();
    }

    private static string TruncateText(string text, int max) =>
        string.IsNullOrEmpty(text) || text.Length <= max ? text : text[..(max - 3)] + "...";

    private record StreamResult(string Text, List<FunctionCallContent> ToolCalls, string? Error);
}
