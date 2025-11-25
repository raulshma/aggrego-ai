using AggregoAi.ApiService.Models;
using AggregoAi.ApiService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AggregoAi.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Username and password are required" });
        }

        var result = _authService.Authenticate(request.Username, request.Password);

        if (result == null)
        {
            _logger.LogWarning("Failed login attempt for user: {Username}", request.Username);
            // Use generic message to prevent username enumeration
            return Unauthorized(new { error = "Invalid credentials" });
        }

        _logger.LogInformation("Successful login for user: {Username}", request.Username);
        return Ok(result);
    }

    [HttpGet("verify")]
    [Authorize(Roles = "Admin")]
    public IActionResult Verify()
    {
        return Ok(new { valid = true });
    }
}
