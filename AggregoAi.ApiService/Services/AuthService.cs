using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AggregoAi.ApiService.Models;
using Microsoft.IdentityModel.Tokens;

namespace AggregoAi.ApiService.Services;

public interface IAuthService
{
    LoginResponse? Authenticate(string username, string password);
    bool ValidateToken(string token);
}

public class AuthService : IAuthService
{
    private readonly string _jwtSecret;
    private readonly string _adminUsername;
    private readonly string _adminPasswordHash;
    private readonly int _tokenExpirationHours;

    public AuthService(IConfiguration configuration)
    {
        // Get JWT secret from configuration (should be at least 32 chars)
        _jwtSecret = configuration["Auth:JwtSecret"] 
            ?? throw new InvalidOperationException("Auth:JwtSecret must be configured");
        
        if (_jwtSecret.Length < 32)
            throw new InvalidOperationException("Auth:JwtSecret must be at least 32 characters");

        _adminUsername = configuration["Auth:AdminUsername"] ?? "admin";
        
        // Password should be stored as a hash in configuration
        var adminPassword = configuration["Auth:AdminPassword"] 
            ?? throw new InvalidOperationException("Auth:AdminPassword must be configured");
        _adminPasswordHash = HashPassword(adminPassword);
        
        _tokenExpirationHours = configuration.GetValue("Auth:TokenExpirationHours", 24);
    }

    public LoginResponse? Authenticate(string username, string password)
    {
        // Constant-time comparison to prevent timing attacks
        var usernameMatch = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(username.ToLowerInvariant()),
            Encoding.UTF8.GetBytes(_adminUsername.ToLowerInvariant()));

        var passwordHash = HashPassword(password);
        var passwordMatch = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(passwordHash),
            Encoding.UTF8.GetBytes(_adminPasswordHash));

        if (!usernameMatch || !passwordMatch)
            return null;

        var expiresAt = DateTime.UtcNow.AddHours(_tokenExpirationHours);
        var token = GenerateJwtToken(username, expiresAt);

        return new LoginResponse(token, expiresAt);
    }

    public bool ValidateToken(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtSecret);

            tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = "AggregoAi",
                ValidateAudience = true,
                ValidAudience = "AggregoAi",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);

            return true;
        }
        catch
        {
            return false;
        }
    }

    private string GenerateJwtToken(string username, DateTime expiresAt)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtSecret);

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = "AggregoAi",
            Audience = "AggregoAi",
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(bytes);
    }
}
