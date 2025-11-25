# AggregoAi

An AI-powered news aggregation platform built with .NET Aspire and React.

## Features

- RSS feed aggregation and parsing
- AI-powered article analysis and summarization
- Fact-checking with SearXNG meta-search integration
- Scheduled job processing with Quartz.NET
- MongoDB persistence
- JWT authentication
- Modern React frontend with Tailwind CSS

## Architecture

| Project | Description |
|---------|-------------|
| `AggregoAi.AppHost` | .NET Aspire orchestration host |
| `AggregoAi.ApiService` | Backend API with AI services, RSS processing, and scheduling |
| `AggregoAi.ServiceDefaults` | Shared service configuration and extensions |
| `AggregoAi.Web` | React + Vite frontend |

## Prerequisites

- .NET 8.0 SDK or later
- Node.js 18+ and npm
- Docker (for MongoDB and SearXNG containers)

## Getting Started

1. Clone the repository
2. Run the Aspire host:
   ```bash
   dotnet run --project AggregoAi.AppHost
   ```

This will start:
- MongoDB database
- SearXNG search engine
- API service
- React frontend (dev server)

## Configuration

Configure the API service in `AggregoAi.ApiService/appsettings.json`:
- `Auth:JwtSecret` - JWT signing key
- OpenRouter API settings for AI services

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
