using AggregoAi.ApiService.Models;

namespace AggregoAi.ApiService.AI;

/// <summary>
/// Agent interface for AI-powered fact-checking using the ReAct pattern.
/// </summary>
public interface IFactCheckAgent
{
    /// <summary>
    /// Verifies an article using the ReAct reasoning pattern.
    /// Streams intermediate steps (thoughts, actions, observations) as they occur.
    /// </summary>
    /// <param name="article">The article to verify.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Async enumerable of agent steps during verification.</returns>
    IAsyncEnumerable<AgentStep> VerifyArticleAsync(Article article, CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents a single step in the ReAct agent's reasoning process.
/// </summary>
public record AgentStep(
    AgentStepType Type,
    string Content,
    DateTime Timestamp
);

/// <summary>
/// Types of steps in the ReAct reasoning loop.
/// </summary>
public enum AgentStepType
{
    /// <summary>The agent's reasoning about what to do next.</summary>
    Thought,
    /// <summary>An action the agent is taking (tool call).</summary>
    Action,
    /// <summary>The result of an action (tool response).</summary>
    Observation,
    /// <summary>The final verification verdict.</summary>
    FinalAnswer
}

/// <summary>
/// Represents a citation/source used in fact-checking.
/// </summary>
public record Citation(
    string Source,
    string Url,
    string Excerpt
);
