#!/usr/bin/env node

import { createCLI, parseOptions } from './cli/commands.js';
import { WorkflowService } from './services/WorkflowService.js';
import { ErrorHandler } from './utils/errorHandler.js';
import { Logger } from './utils/logger.js';
import { config, validateEnvironment } from './config/index.js';

async function main(): Promise<void> {
  // Set up global error handlers
  ErrorHandler.setupGlobalHandlers();

  try {
    // Validate environment
    const missingVars = validateEnvironment();
    if (missingVars.length > 0) {
      Logger.error('Missing required environment variables', { missing: missingVars });
      console.error('\n❌ Missing required environment variables:');
      missingVars.forEach(envVar => console.error(`   - ${envVar}`));
      console.error('\nPlease check your .env file or environment setup.');
      process.exit(1);
    }

    // Create and parse CLI - this will handle everything
    const program = createCLI();
    await program.parseAsync();

  } catch (error) {
    ErrorHandler.handle(error);
  }
}

// Run the application
main();