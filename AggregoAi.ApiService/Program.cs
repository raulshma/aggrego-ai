using AggregoAi.ApiService.Repositories;
using AggregoAi.ApiService.Services;

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

// Register RSS services
builder.Services.AddHttpClient<IRssFetcher, RssFetcher>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddSingleton<IRssParser, RssParser>();

// Add services to the container.
builder.Services.AddProblemDetails();

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/", () => "AggregoAi API service is running.");

app.MapDefaultEndpoints();

app.Run();
