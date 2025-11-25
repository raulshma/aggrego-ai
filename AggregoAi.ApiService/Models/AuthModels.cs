namespace AggregoAi.ApiService.Models;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, DateTime ExpiresAt);

public record AdminUser
{
    public string Username { get; init; } = string.Empty;
    public string PasswordHash { get; init; } = string.Empty;
}
