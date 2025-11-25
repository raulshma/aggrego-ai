var builder = DistributedApplication.CreateBuilder(args);

// MongoDB for data and Quartz job store persistence
var mongodb = builder.AddMongoDB("mongodb")
    .WithDataVolume("aggregoai-mongodb-data")
    .WithLifetime(ContainerLifetime.Persistent);

var aggregoaiDb = mongodb.AddDatabase("aggregoai");

// SearXNG meta-search engine for fact-checking
var searxng = builder.AddContainer("searxng", "searxng/searxng", "latest")
    .WithHttpEndpoint(port: 8080, targetPort: 8080, name: "searxng-http")
    .WithVolume("aggregoai-searxng-data", "/etc/searxng")
    .WithLifetime(ContainerLifetime.Persistent);

// Web API service with MongoDB and SearXNG references
var apiService = builder.AddProject<Projects.AggregoAi_ApiService>("apiservice")
    .WithHttpHealthCheck("/health")
    .WithReference(aggregoaiDb)
    .WaitFor(aggregoaiDb)
    .WithReference(searxng.GetEndpoint("searxng-http"));

// React frontend with Vite (will be created in task 1.2)
var frontend = builder.AddNpmApp("frontend", "../AggregoAi.Web", "dev")
    .WithReference(apiService)
    .WaitFor(apiService)
    .WithHttpEndpoint(env: "PORT", port: 5173)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
