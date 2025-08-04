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

### Project Structure

```
src/
├── cli/           # Command line interface
├── config/        # Configuration management
├── services/      # Business logic services
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── index.ts       # Application entry point
```

### Core Services

- **WorkflowService** - Main application orchestration
- **SpotifyService** - Spotify API integration with rate limiting
- **ScrapingService** - WWOZ playlist scraping with Puppeteer
- **SongMatcher** - Advanced song matching and confidence scoring

### Key Features

- **Type-Safe Configuration** - Zod schema validation
- **Error Recovery** - Retry logic with exponential backoff
- **Smart Matching** - Multiple matching strategies with confidence scoring
- **Duplicate Detection** - Efficient playlist duplicate checking
- **Graceful Shutdown** - Proper cleanup on exit signals

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