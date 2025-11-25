using Quartz;

namespace AggregoAi.ApiService.Scheduling;

/// <summary>
/// Configures Quartz.NET scheduler with MongoDB persistence.
/// Requirements: 2.1, 2.2, 2.3
/// </summary>
public static class QuartzConfiguration
{
    /// <summary>
    /// Adds Quartz.NET scheduler with MongoDB job store to the service collection.
    /// </summary>
    public static IServiceCollection AddQuartzScheduler(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var mongoConnectionString = configuration.GetConnectionString("aggregoai") 
            ?? "mongodb://localhost:27017";

        services.AddQuartz(q =>
        {
            // Configure persistent job store using MongoDB via ADO.NET provider
            // Note: Quartz doesn't have native MongoDB support, so we use RAM store
            // with custom persistence layer through our repositories
            q.UseInMemoryStore();

            // Configure job serialization
            q.UseDefaultThreadPool(tp =>
            {
                tp.MaxConcurrency = 10;
            });

            // Configure misfire handling
            q.MisfireThreshold = TimeSpan.FromMinutes(1);

            // Add job listener for execution logging
            q.AddJobListener<JobExecutionListener>();

            // Add job listener for retry handling with exponential backoff
            q.AddJobListener<RetryJobListener>();
        });

        // Add the Quartz.NET hosted service
        services.AddQuartzHostedService(options =>
        {
            // Wait for jobs to complete before shutting down
            options.WaitForJobsToComplete = true;
        });

        // Register our custom services
        services.AddSingleton<IJobFactory, QuartzJobFactory>();
        services.AddSingleton<IJobManagementService, JobManagementService>();
        services.AddSingleton<IJobPersistenceService, JobPersistenceService>();

        // Register hosted service for job restoration
        services.AddHostedService<JobRestoreHostedService>();

        return services;
    }
}
