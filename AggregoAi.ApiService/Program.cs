using System.Text;
using AggregoAi.ApiService.AI;
using AggregoAi.ApiService.Repositories;
using AggregoAi.ApiService.Scheduling;
using AggregoAi.ApiService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

// Add MongoDB client with Aspire integration
builder.AddMongoDBClient("aggregoai");

// Register repositories
builder.Services.AddSingleton<IArticleRepository, MongoArticleRepository>();
builder.Services.AddSingleton<IFeedConfigRepository, MongoFeedConfigRepository>();
builder.Services.AddSingleton<ISystemConfigRepository, MongoSystemConfigRepository>();
builder.Services.AddSingleton<IJobExecutionLogRepository, MongoJobExecutionLogRepository>();
builder.Services.AddSingleton<IAnalyticsRepository, MongoAnalyticsRepository>();

// Register RSS services
builder.Services.AddHttpClient<IRssFetcher, RssFetcher>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddSingleton<IRssParser, RssParser>();

// Register AI services with Semantic Kernel
builder.Services.AddSingleton<ISemanticKernelService, SemanticKernelService>();
builder.Services.AddHttpClient<ISearXNGTool, SearXNGTool>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddSingleton<IArticleSearchTool, ArticleSearchTool>();
builder.Services.AddSingleton<IFactCheckAgent, FactCheckAgent>();

// Add Quartz.NET scheduler with MongoDB persistence
builder.Services.AddQuartzScheduler(builder.Configuration);

// Register Auth service
builder.Services.AddSingleton<IAuthService, AuthService>();

// Configure JWT Authentication
var jwtSecret = builder.Configuration["Auth:JwtSecret"] 
    ?? throw new InvalidOperationException("Auth:JwtSecret must be configured");
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // Set to true in production with HTTPS
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = "AggregoAi",
        ValidateAudience = true,
        ValidAudience = "AggregoAi",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Add services to the container.
builder.Services.AddProblemDetails();
builder.Services.AddControllers();

// Configure CORS for React frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/", () => "AggregoAi API service is running.");

app.MapControllers();
app.MapDefaultEndpoints();

app.Run();
