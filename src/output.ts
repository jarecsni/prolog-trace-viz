import * as fs from 'node:fs/promises';
import { CLIOptions } from './cli.js';

export interface OutputOptions {
  content: string;
  outputPath?: string;
  verbose: boolean;
  quiet: boolean;
}

/**
 * Writes output to file or stdout based on CLI options.
 */
export async function writeOutput(options: OutputOptions): Promise<void> {
  const { content, outputPath, verbose, quiet } = options;
  
  if (outputPath) {
    await fs.writeFile(outputPath, content, 'utf-8');
    
    if (!quiet) {
      console.log(`Output written to: ${outputPath}`);
    }
  } else {
    // Write to stdout
    console.log(content);
  }
}

/**
 * Logs verbose information if verbose mode is enabled.
 */
export function logVerbose(message: string, options: Pick<CLIOptions, 'verbose' | 'quiet'>): void {
  if (options.verbose && !options.quiet) {
    console.log(`[verbose] ${message}`);
  }
}

/**
 * Logs info messages unless quiet mode is enabled.
 */
export function logInfo(message: string, options: Pick<CLIOptions, 'quiet'>): void {
  if (!options.quiet) {
    console.log(message);
  }
}

/**
 * Logs error messages (always shown).
 */
export function logError(message: string): void {
  console.error(message);
}
