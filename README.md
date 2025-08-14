# WWOZ Tracker v2.5

A modern, TypeScript-based application that tracks WWOZ radio playlists and automatically curates Spotify playlists with discovered music.

## ✨ Features

- **Modern TypeScript Architecture** - Clean, maintainable codebase with full type safety
- **Smart Song Matching** - Advanced fuzzy matching with confidence scoring
- **Robust Error Handling** - Comprehensive error management and recovery
- **Flexible CLI** - Multiple operation modes with extensive options
- **Rate Limiting** - Proper API rate limiting for both Spotify and scraping
- **Configuration Validation** - Environment validation with helpful error messages
- **Comprehensive Logging** - Structured logging with multiple levels
- **Dry Run Mode** - Test changes without modifying playlists

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Spotify Premium account
- Spotify Developer App credentials

### Installation

```bash
git clone <repository-url>
cd wwoztracker2.5
npm install
```

### Environment Setup

Create a `.env` file:

```env
# Required Spotify API credentials
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
SPOTIFY_REFRESH_TOKEN=your_refresh_token_here
SPOTIFY_USER_ID=your_spotify_user_id

# Optional configuration
SCRAPE_INTERVAL_SECONDS=300
LOG_LEVEL=info
DRY_RUN=false
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
SPOTIFY_STATIC_PLAYLIST_ID=optional_playlist_id
```

### Build and Run

```bash
# Development mode (with TypeScript compilation)
npm run dev

# Build for production
npm run build
npm start

# Run with options
npm run dev -- --dry-run --verbose
npm run dev -- --once --playlist-name "My Custom Playlist"
```

## 📋 CLI Usage

### Basic Commands

```bash
# Run continuously (default)
wwoz-tracker

# Run once and exit
wwoz-tracker --once

# Dry run mode (no Spotify changes)
wwoz-tracker --dry-run

# Custom playlist name
wwoz-tracker --playlist-name "My WWOZ Discoveries"

# Process all songs (not just recent ones)
wwoz-tracker --all

# Verbose logging
wwoz-tracker --verbose
```

### Utility Commands

```bash
# Validate configuration
wwoz-tracker validate

# Show current configuration
wwoz-tracker config

# Test connections
wwoz-tracker test
```

### Advanced Options

```bash
# Combine multiple options
wwoz-tracker --dry-run --verbose --once --all

# Process specific number of songs
wwoz-tracker --count 20

# Configuration check only
wwoz-tracker --config-check
```

## 🏗️ Architecture

### System Architecture

The WWOZ Tracker follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        WWOZ TRACKER 2.5                        │
│                     TypeScript Application                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                           CLI Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  src/cli/commands.ts                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Continuous monitoring mode                           │   │
│  │  • One-time execution                                   │   │
│  │  • Dry-run mode                                        │   │
│  │  • Keyboard controls (↑↓ arrows, Ctrl+C)               │   │
│  │  • Commander.js argument parsing                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Configuration Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  src/config/                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  schema.ts: Zod validation schemas                      │   │
│  │  index.ts:  Environment variable processing            │   │
│  │  • Spotify API credentials validation                  │   │
│  │  • Runtime type safety                                 │   │
│  │  • Clear error messages for missing config             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               WorkflowService.ts                        │   │
│  │           (Main Orchestrator)                           │   │
│  │  • Coordinates entire workflow                          │   │
│  │  • Continuous monitoring loop                           │   │
│  │  • Processing statistics                                │   │
│  │  • Keyboard input handling                              │   │
│  │  • Graceful shutdown management                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                               │                                 │
│              ┌────────────────┼────────────────┐                │
│              ▼                ▼                ▼                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐    │
│  │ ScrapingService │  │ SpotifyService  │  │   Utilities  │    │
│  │     .ts         │  │      .ts        │  │              │    │
│  │                 │  │                 │  │              │    │
│  │ • Puppeteer     │  │ • API client    │  │ • Logging    │    │
│  │ • WWOZ scraping │  │ • Rate limiting │  │ • Error      │    │
│  │ • Dynamic content│ │ • Playlist mgmt │  │   handling   │    │
│  │ • Error recovery│  │ • Track search  │  │ • Matching   │    │
│  │ • Bottleneck    │  │ • Confidence    │  │   algorithms │    │
│  │   rate limiting │  │   scoring       │  │              │    │
│  └─────────────────┘  │ • Duplicate     │  └──────────────┘    │
│                       │   detection     │                      │
│                       │ • Caching       │                      │
│                       └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Utility Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  src/utils/                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  errorHandler.ts: Global error handling                 │   │
│  │  logger.ts:      Winston structured logging             │   │
│  │  matching.ts:    Multi-strategy fuzzy matching          │   │
│  │                  with confidence scoring                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Type System                             │
├─────────────────────────────────────────────────────────────────┤
│  src/types/                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  config.ts:    Configuration type definitions           │   │
│  │  errors.ts:    Custom error types                       │   │
│  │  playlist.ts:  Playlist-related types                   │   │
│  │  song.ts:      Song and track types                     │   │
│  │  index.ts:     Type exports and aggregations            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

External Integrations:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WWOZ Radio    │    │  Spotify API    │    │   File System  │
│    Website      │◄───┤   (Web API)     │◄───┤   (Logging)     │
│  (Puppeteer)    │    │  Rate Limited   │    │   Configuration │
└─────────────────┘    └─────────────────┘    └─────────────────┘

Data Flow:
WWOZ Scraping → Song Processing → Fuzzy Matching → Spotify Search → 
Playlist Updates → Statistics Tracking → Logging
```

### Architecture Patterns

The application follows these key architectural patterns:

- **Layered Architecture**: Clear separation between CLI, configuration, services, utilities, and types
- **Service-Oriented Design**: Each major functionality is encapsulated in dedicated services
- **Type-Safe Configuration**: Runtime validation using Zod schemas with compile-time TypeScript safety
- **Error Boundary Pattern**: Centralized error handling with custom error types and recovery strategies
- **Observer Pattern**: Event-driven keyboard input handling and graceful shutdown coordination
- **Strategy Pattern**: Multiple fuzzy matching algorithms with confidence-based selection

### Project Structure

```
src/
├── cli/           # Command line interface and argument parsing
├── config/        # Configuration management with validation
├── services/      # Core business logic services
│   ├── WorkflowService.ts    # Main orchestrator
│   ├── SpotifyService.ts     # Spotify API integration
│   └── ScrapingService.ts    # WWOZ playlist scraping
├── types/         # TypeScript type definitions
├── utils/         # Shared utilities and algorithms
└── index.ts       # Application entry point
```

### Core Services

- **WorkflowService** - Main application orchestration and user interaction management
- **SpotifyService** - Spotify API integration with intelligent rate limiting and caching
- **ScrapingService** - WWOZ playlist scraping with robust error handling and content loading
- **SongMatcher** - Advanced fuzzy matching with multi-strategy confidence scoring

### Key Features

- **Type-Safe Configuration** - Zod schema validation with helpful error messages
- **Error Recovery** - Retry logic with exponential backoff and graceful degradation
- **Smart Matching** - Multiple matching strategies with confidence scoring and validation
- **Duplicate Detection** - Efficient playlist duplicate checking with caching optimization
- **Graceful Shutdown** - Proper cleanup on exit signals and keyboard interrupt handling
- **Rate Limiting** - Bottleneck-based rate limiting for both Spotify API and scraping operations

## 🔄 Application Workflow

The WWOZ Tracker follows a comprehensive workflow process with multiple execution modes and robust error handling:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     WWOZ TRACKER WORKFLOW                           │
└──────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌─────────────────────────────────────────┐
│           CLI Initialization           │
│ • Parse command-line options            │
│ • Validate configuration                │
│ • Setup keyboard input handlers         │
│   ↑/Enter: Skip wait                    │
│   ↓: Stop tracker                       │
│   Ctrl+C: Force exit                    │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐    ┌─────────────────────┐
│         Mode Decision                   │    │                     │
│                                         │◄───┤   One-time Mode     │
│  Once Mode?     Continuous Mode?        │    │   (--once flag)     │
└─────────────┬───────────────────────────┘    └─────────────────────┘
              │                   │
              ▼                   ▼
    ┌─────────────────┐    ┌─────────────────┐
    │  Single Run     │    │ Continuous Loop │
    │                 │    │                 │
    └─────────────────┘    └─────────────────┘
              │                   │
              │                   ▼
              │            ┌─────────────────────────────────────┐
              │            │        Continuous Monitoring        │
              │            │                                     │
              │            │  ┌─────────────────────────────┐   │
              │            │  │        Main Loop            │   │
              │            │  │                             │   │
              │            │  │  while (!shouldStop) {      │   │
              │            │  │    • Run execution cycle    │   │
              │            │  │    • Check stop conditions  │   │
              │            │  │    • Wait for next interval │   │
              │            │  │    • Handle keyboard input  │   │
              │            │  │  }                          │   │
              │            │  └─────────────────────────────┘   │
              │            └─────────────────────────────────────┘
              │                         │
              │                         │
              └─────────────────────────┘
                            │
                            ▼
      ┌─────────────────────────────────────────────────────────────┐
      │                  EXECUTION CYCLE                            │
      │                                                             │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │                1. SCRAPING PHASE                    │   │
      │  │  ┌─────────────────────────────────────────────┐   │   │
      │  │  │ • Launch Puppeteer browser                  │   │   │
      │  │  │ • Navigate to WWOZ playlist page           │   │   │
      │  │  │ • Wait for dynamic content loading         │   │   │
      │  │  │ • Extract song data (artist, title, time) │   │   │
      │  │  │ • Handle pagination if needed              │   │   │
      │  │  │ • Close browser                           │   │   │
      │  │  │ • Return ScrapedSong[] array              │   │   │
      │  │  └─────────────────────────────────────────────┘   │   │
      │  └─────────────────────────────────────────────────────┘   │
      │                            │                               │
      │                            ▼                               │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │           2. PLAYLIST CACHE LOADING                 │   │
      │  │  ┌─────────────────────────────────────────────┐   │   │
      │  │  │ • Determine playlist ID (static/dynamic)   │   │   │
      │  │  │ • Load existing playlist tracks into cache │   │   │
      │  │  │ • Optimize duplicate detection performance │   │   │
      │  │  └─────────────────────────────────────────────┘   │   │
      │  └─────────────────────────────────────────────────────┘   │
      │                            │                               │
      │                            ▼                               │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │              3. SONG PROCESSING                     │   │
      │  │                                                     │   │
      │  │    For each scraped song:                           │   │
      │  │    ┌─────────────────────────────────────────┐     │   │
      │  │    │           SINGLE SONG FLOW              │     │   │
      │  │    │                                         │     │   │
      │  │    │  ┌─────────────────────────────────┐   │     │   │
      │  │    │  │      a) Spotify Search          │   │     │   │
      │  │    │  │  • Build search query           │   │     │   │
      │  │    │  │  • Rate-limited API call        │   │     │   │
      │  │    │  │  • Parse search results         │   │     │   │
      │  │    │  │  • Return track candidates      │   │     │   │
      │  │    │  └─────────────────────────────────┘   │     │   │
      │  │    │                 │                       │     │   │
      │  │    │                 ▼                       │     │   │
      │  │    │  ┌─────────────────────────────────┐   │     │   │
      │  │    │  │      b) Fuzzy Matching          │   │     │   │
      │  │    │  │  • Compare artist names         │   │     │   │
      │  │    │  │  • Compare song titles          │   │     │   │
      │  │    │  │  • Calculate confidence score   │   │     │   │
      │  │    │  │  • Apply matching thresholds    │   │     │   │
      │  │    │  └─────────────────────────────────┘   │     │   │
      │  │    │                 │                       │     │   │
      │  │    │     ┌───────────┼───────────┐          │     │   │
      │  │    │     ▼           ▼           ▼          │     │   │
      │  │    │  ┌──────┐  ┌─────────┐ ┌───────────┐  │     │   │
      │  │    │  │ Low  │  │ Medium  │ │   High    │  │     │   │
      │  │    │  │Score │  │ Score   │ │  Score    │  │     │   │
      │  │    │  │ ❌   │  │ ⚠️      │ │    ✅     │  │     │   │
      │  │    │  └──────┘  └─────────┘ └───────────┘  │     │   │
      │  │    │                 │                       │     │   │
      │  │    │                 ▼                       │     │   │
      │  │    │  ┌─────────────────────────────────┐   │     │   │
      │  │    │  │      c) Duplicate Check         │   │     │   │
      │  │    │  │  • Check against playlist cache │   │     │   │
      │  │    │  │  • Track consecutive duplicates │   │     │   │
      │  │    │  │  • Abort if 5+ consecutive     │   │     │   │
      │  │    │  └─────────────────────────────────┘   │     │   │
      │  │    │                 │                       │     │   │
      │  │    │     ┌───────────┼───────────┐          │     │   │
      │  │    │     ▼           ▼           ▼          │     │   │
      │  │    │  ┌──────┐  ┌─────────┐ ┌───────────┐  │     │   │
      │  │    │  │Dupli-│  │ New     │ │5+ Consec  │  │     │   │
      │  │    │  │cate  │  │ Track   │ │Duplicates │  │     │   │
      │  │    │  │ ⏭️   │  │         │ │ 🛑 ABORT  │  │     │   │
      │  │    │  └──────┘  └─────────┘ └───────────┘  │     │   │
      │  │    │                 │                       │     │   │
      │  │    │                 ▼                       │     │   │
      │  │    │  ┌─────────────────────────────────┐   │     │   │
      │  │    │  │      d) Playlist Addition       │   │     │   │
      │  │    │  │                                 │   │     │   │
      │  │    │  │  Dry Run?                       │   │     │   │
      │  │    │  │  ├─ Yes: Log "Would add"        │   │     │   │
      │  │    │  │  └─ No:  Add to Spotify         │   │     │   │
      │  │    │  │           playlist via API      │   │     │   │
      │  │    │  └─────────────────────────────────┘   │     │   │
      │  │    └─────────────────────────────────────────┘     │   │
      │  │                                                     │   │
      │  └─────────────────────────────────────────────────────┘   │
      │                            │                               │
      │                            ▼                               │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │             4. STATISTICS TRACKING                 │   │
      │  │  • Update processing counters                       │   │
      │  │  • Track success/failure rates                     │   │
      │  │  • Monitor consecutive duplicates                  │   │
      │  │  • Log final statistics                            │   │
      │  └─────────────────────────────────────────────────────┘   │
      └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    ERROR HANDLING                           │
    │                                                             │
    │  ┌─────────────────┐  ┌─────────────────┐ ┌─────────────┐ │
    │  │ Consecutive     │  │ Processing      │ │ Unexpected  │ │
    │  │ Duplicates      │  │ Errors          │ │ Errors      │ │
    │  │                 │  │                 │ │             │ │
    │  │ • Log & continue│  │ • Log & retry   │ │ • Log & exit│ │
    │  │ • Reset counter │  │ • Reset counter │ │ • Cleanup   │ │
    │  │ • Normal interval│ │ • Normal interval│ │ • Graceful  │ │
    │  └─────────────────┘  └─────────────────┘ └─────────────┘ │
    └─────────────────────────────────────────────────────────────┘
                                  │
                     ┌────────────┼────────────┐
                     ▼            ▼            ▼
        ┌─────────────────┐ ┌──────────┐ ┌─────────────┐
        │ Continue Loop   │ │   Wait    │ │    END      │
        │ (Continuous)    │ │ Interval  │ │             │
        │                 │ │           │ │             │
        │ • Reset stats   │ │ • Count   │ │ • Cleanup   │
        │ • Next cycle    │ │   down    │ │ • Exit      │
        └─────────────────┘ │ • Handle  │ └─────────────┘
                            │   keys    │
                            │ • Show    │
                            │   tips    │
                            └──────────┘
                                  │
                                  │ (Back to cycle)
                                  │
                          ┌───────┘
                          │
                          ▼
                ┌─────────────────────┐
                │   KEYBOARD INPUT    │
                │    MONITORING       │
                │                     │
                │ • ↑/Enter: Force    │
                │   immediate run     │
                │ • ↓: Graceful stop  │
                │ • Ctrl+C: Force     │
                │   immediate exit    │
                └─────────────────────┘

Legend:
✅ Success    ⚠️ Warning    ❌ Failed    ⏭️ Skip    🛑 Stop    ⏳ Wait
```

### Workflow Execution Modes

The application supports two primary execution modes:

#### One-Time Execution (`--once`)
- Runs a single scraping and processing cycle
- Exits after completion
- Ideal for testing or scheduled runs

#### Continuous Monitoring (default)
- Runs indefinitely with configurable intervals
- Interactive keyboard controls during operation
- Automatic error recovery and retry logic
- Graceful shutdown handling

### Interactive Features

During continuous monitoring, users can interact with the running application:

- **↑ Arrow Key / Enter**: Skip the current wait period and run immediately
- **↓ Arrow Key**: Initiate graceful shutdown after current cycle
- **Ctrl+C**: Force immediate exit with cleanup

### Error Handling Strategy

The workflow implements a multi-layered error handling approach:

1. **Consecutive Duplicates**: Stops processing when 5+ consecutive tracks are already in playlist (indicates up-to-date playlist)
2. **Processing Errors**: Individual song failures don't stop the batch; errors are logged and processing continues
3. **System Errors**: Unexpected errors trigger cleanup and graceful exit
4. **Recovery Logic**: Failed cycles retry after the normal interval in continuous mode

### Performance Optimizations

- **Playlist Caching**: Pre-loads existing playlist contents for fast duplicate checking
- **Rate Limiting**: Intelligent throttling for both Spotify API and web scraping
- **Batch Processing**: Processes songs in sequence with proper error isolation
- **Smart Matching**: Multi-strategy fuzzy matching with confidence-based validation

## 🔧 Development

### Scripts

```bash
npm run dev          # Development mode with tsx
npm run build        # TypeScript compilation
npm run start        # Run compiled JavaScript
npm run lint         # ESLint checking
npm run lint:fix     # Auto-fix linting issues
npm run format       # Prettier formatting
npm run test         # Run tests
npm run clean        # Clean build directory
```

### Code Quality

- **TypeScript** - Full type safety
- **ESLint** - Code linting with TypeScript rules
- **Prettier** - Code formatting
- **Vitest** - Testing framework

## 📊 Monitoring

The application provides comprehensive logging and statistics:

- Processing statistics (processed, successful, failed, duplicates)
- API response times and error rates
- Configuration validation results
- Real-time progress updates

## 🔒 Security

- No secrets in code or logs
- Environment variable validation
- Secure API token management
- Input sanitization for scraped content

## 🐛 Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```bash
   wwoz-tracker validate
   ```

2. **Chrome/Puppeteer Issues**
   - Update `CHROME_PATH` in `.env`
   - Install Chrome or Chromium

3. **Spotify API Errors**
   - Verify refresh token is valid
   - Check API rate limits

4. **WWOZ Scraping Issues**
   - Website structure may have changed
   - Check network connectivity

### Debug Mode

```bash
# Enable verbose logging
wwoz-tracker --verbose

# Check logs in development
npm run dev -- --verbose --dry-run
```

## 📄 License

MIT License - see LICENSE file for details