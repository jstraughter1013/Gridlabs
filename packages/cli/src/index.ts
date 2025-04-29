#!/usr/bin/env node
import { program } from 'commander';
// Import version manually since TypeScript may not support direct JSON imports
const version = '0.1.0';
import './upload';

// Main CLI program
program
  .name('gridlabs')
  .description('GridLabs CLI - Zero-config, component-first UI preview')
  .version(version);

// Parse arguments
program.parse(process.argv);

// If no command is provided, show help
if (process.argv.length <= 2) {
  program.help();
}
