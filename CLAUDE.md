# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development (with TypeScript compilation on-the-fly)
npm run dev

# Development with options
npm run dev -- --dry-run --verbose
npm run dev -- --once --playlist-name "Custom Playlist"

# Production build and run
npm run build
npm start

# Code quality
npm run lint          # Check for linting issues
npm run lint:fix      # Auto-fix linting issues  
npm run format        # Format code with Prettier

# Testing
npm test              # Run Vitest tests
npm test:coverage     # Run tests with coverage

# Utilities
npm run clean         # Clean build directory
npm run dry-run       # Run in dry-run mode (no Spotify changes)
```

## Architecture Overview

This is a modern TypeScript application that scrapes WWOZ radio playlists and automatically curates Spotify playlists with discovered music. The architecture follows a service-oriented design with clear separation of concerns.

### Core Services

- **WorkflowService** (`src/services/WorkflowService.ts`): Main orchestration service that coordinates the entire workflow. Handles continuous monitoring, song processing, keyboard input for immediate scraping triggers, and maintains processing statistics.

- **SpotifyService** (`src/services/SpotifyService.ts`): Spotify API integration with rate limiting, playlist management, track search with confidence scoring, and duplicate detection with efficient caching.

- **ScrapingService** (`src/services/ScrapingService.ts`): WWOZ website scraping using Puppeteer. Handles dynamic content loading and robust error recovery.

### Key Architecture Patterns

- **Type-Safe Configuration**: Uses Zod schemas for environment variable validation with helpful error messages (`src/config/schema.ts`)
- **Centralized Error Handling**: Custom error types and global error handlers (`src/utils/errorHandler.ts`, `src/types/errors.ts`)
- **Advanced Song Matching**: Multi-strategy fuzzy matching with confidence scoring (`src/utils/matching.ts`)
- **Rate Limiting**: Bottleneck-based rate limiting for both Spotify API and scraping operations
- **Graceful Shutdown**: Proper cleanup on exit signals with keyboard input handling

### CLI Architecture

The CLI (`src/cli/commands.ts`) supports multiple operation modes:
- Continuous monitoring with configurable intervals
- One-time execution mode
- Dry-run mode for testing without Spotify changes
- Configuration validation and connection testing
- Keyboard shortcuts for immediate scraping during wait periods

### Configuration System

Configuration is managed through environment variables with strict validation:
- Required: Spotify API credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, USER_ID)
- Optional: Custom scrape intervals, logging levels, static playlist IDs
- All config is validated at startup with clear error messages for missing variables

## Development Notes

### TypeScript Configuration
- Target: ES2022 with ESNext modules
- Strict mode enabled with full type safety
- Source maps and declaration files generated
- Tests excluded from compilation

### Code Quality Tools
- ESLint with TypeScript rules and Prettier integration
- Prettier configured for consistent formatting (single quotes, 100 char width, semicolons)
- Vitest for testing with v8 coverage

### Key Dependencies
- **puppeteer**: Web scraping with Chrome automation
- **spotify-web-api-node**: Spotify API integration
- **bottleneck**: Rate limiting for API calls
- **commander**: CLI argument parsing
- **zod**: Runtime type validation for configuration
- **dayjs**: Date manipulation for playlist naming
- **string-similarity**: Fuzzy matching for song titles/artists
- **winston**: Structured logging

### Debugging Features
- Comprehensive logging with configurable levels
- Dry-run mode for testing without side effects
- Verbose mode for detailed operation logging
- Processing statistics tracking (successful/failed/duplicate counts)
- Connection testing utilities

The codebase emphasizes reliability, observability, and maintainability with extensive error handling and logging throughout.