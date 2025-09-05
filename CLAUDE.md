# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Run
```bash
npm run dev          # Development mode with tsx (hot reload)
npm run build        # TypeScript compilation to dist/
npm run start        # Run compiled JavaScript
npm run clean        # Clean build directory
npm run dry-run      # Run in dry-run mode (no Spotify changes)
```

### Code Quality
```bash
npm run lint         # ESLint checking
npm run lint:fix     # Auto-fix linting issues
npm run format       # Prettier formatting
npm run test         # Run Vitest tests
npm run test:coverage # Test coverage report
```

### Application Commands
```bash
# Basic usage
wwoz-tracker                              # Continuous monitoring
wwoz-tracker --once                       # Single run
wwoz-tracker --dry-run                    # Test mode
wwoz-tracker --verbose                    # Debug logging

# Configuration
wwoz-tracker validate                     # Validate environment config
wwoz-tracker config                       # Show current config
wwoz-tracker test                         # Test connections

# Advanced
wwoz-tracker --playlist-name "Custom"     # Use custom playlist name
wwoz-tracker --all                        # Process all songs (not just recent)
wwoz-tracker --count 20                   # Limit to 20 songs
```

## Architecture Overview

### Core Service Architecture
This is a **service-oriented TypeScript application** that orchestrates web scraping and Spotify API integration:

- **WorkflowService** - Main orchestrator that manages the entire processing workflow, handles continuous monitoring, keyboard input, and graceful shutdown
- **ScrapingService** - Puppeteer-based WWOZ playlist scraping with dynamic content loading
- **SpotifyService** - Spotify Web API integration with rate limiting, caching, and playlist management
- **ArchiveService** - Daily markdown file archiving with table format and unique IDs for each scraped song

### Key Architectural Patterns
- **Type-Safe Configuration** - Zod schemas validate environment variables at runtime with helpful error messages
- **Rate-Limited API Calls** - Bottleneck library enforces rate limits for both Spotify API and web scraping
- **Fuzzy String Matching** - Multi-strategy song matching with confidence scoring using string-similarity
- **In-Memory Caching** - Playlist tracks cached for efficient duplicate detection during processing
- **Error Recovery** - Retry logic with exponential backoff, graceful degradation, and workflow continuation

### Data Flow
```
WWOZ Scraping → Song Processing → Fuzzy Matching → Spotify Search → 
Duplicate Check → Playlist Updates → Daily Archive → Statistics Tracking
```

The workflow stops processing when it encounters 5 consecutive duplicate songs, indicating the playlist is up-to-date.

### Interactive Features
During continuous mode:
- **↑ Arrow/Enter** - Skip wait period, run immediately
- **↓ Arrow** - Graceful shutdown after current cycle
- **Ctrl+C** - Force immediate exit with cleanup

### Configuration System
All configuration uses **Zod validation schemas** in `src/config/schema.ts`:
- Environment variables validated at startup
- Type-safe configuration objects throughout codebase
- Clear error messages for missing/invalid config
- Optional static playlist ID support vs. dynamic daily playlists

### Matching Algorithm
The `SongMatcher` class implements sophisticated fuzzy matching:
- Extracts featured artists from song titles
- Normalizes strings (lowercase, strip punctuation)
- Compares with/without parenthetical content
- Uses multiple scoring strategies with confidence thresholds
- 70% minimum confidence required for matches

### Project Structure
```
src/
├── cli/           # Commander.js CLI interface
├── config/        # Zod schemas and env validation  
├── services/      # Core business logic
│   ├── WorkflowService.ts    # Main orchestrator
│   ├── SpotifyService.ts     # Spotify API client
│   ├── ScrapingService.ts    # WWOZ scraping
│   └── ArchiveService.ts     # Daily markdown archiving
├── types/         # TypeScript type definitions
├── utils/         # Matching algorithms, logging, errors
└── index.ts       # Entry point
```

## Key Implementation Details

### Environment Setup
The application requires Spotify API credentials and validates them at startup. See `.env.example` for required variables. Configuration is validated using Zod schemas with helpful error messages.

### Error Handling Strategy
- **Consecutive Duplicates** - Stops batch processing after 5 consecutive duplicates (playlist is up-to-date)
- **Individual Song Failures** - Logged but don't stop the batch; processing continues
- **API Failures** - Retry with exponential backoff
- **System Errors** - Trigger graceful shutdown with cleanup

### Performance Optimizations
- **Playlist Cache Loading** - Pre-loads existing playlist tracks for fast duplicate detection
- **Rate Limiting** - Intelligent throttling prevents API rate limit violations  
- **Batch Processing** - Songs processed sequentially with proper error isolation
- **Smart Matching** - Multiple fuzzy matching strategies with confidence validation

### Testing & Development
- **Dry Run Mode** - Test all functionality without making Spotify changes
- **Verbose Logging** - Detailed debug output for troubleshooting
- **Configuration Validation** - Separate command to validate env setup
- **Connection Testing** - Test Spotify API connectivity

### Chrome/Puppeteer Configuration
The scraping service requires Chrome/Chromium. Set `CHROME_PATH` environment variable to the browser executable path. The service uses headless mode with anti-detection measures for reliable scraping.

### Archive System
The ArchiveService creates daily markdown files with:
- **Table format** - Organized columns for Time, Artist, Title, Album, Status, Confidence, Spotify link, and Scraped time
- **Unique IDs** - Each song gets a `HHMMSS-XXX` identifier (e.g., `082607-F46`) for easy reference
- **Statistics tracking** - Daily counts of found/not found/duplicates automatically updated
- **Backward compatibility** - Reads both old header-based format and new table format
- **Configuration** - Set `ARCHIVE_ENABLED=true` and `ARCHIVE_PATH` in environment