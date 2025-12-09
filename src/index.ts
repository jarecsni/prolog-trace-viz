#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import { parseArgs, getHelpText, getVersion, CLIOptions } from './cli.js';
import { formatError } from './errors.js';
import { createTempWrapper } from './wrapper.js';
import { executeTracer, checkDependencies } from './executor.js';
import { parseTraceJson } from './parser.js';
import * as path from 'node:path';
import { analyzeTree } from './analyzer.js';
import { generateMermaid } from './mermaid.js';
import { renderMarkdown } from './renderer.js';
import { writeOutput, logVerbose, logInfo, logError } from './output.js';
import { parsePrologFile } from './clauses.js';

async function main(): Promise<void> {
  const result = parseArgs(process.argv);
  
  if (result.type === 'help') {
    console.log(getHelpText());
    process.exit(0);
  }
  
  if (result.type === 'version') {
    console.log(getVersion());
    process.exit(0);
  }
  
  if (result.type === 'error') {
    logError(formatError(result.error!));
    process.exit(1);
  }
  
  const options = result.options!;
  
  try {
    await run(options);
  } catch (err) {
    logError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function run(options: CLIOptions): Promise<void> {
  logVerbose(`Processing ${options.prologFile} with query: ${options.query}`, options);
  
  // Check dependencies
  logVerbose('Checking dependencies...', options);
  const deps = await checkDependencies();
  if (deps.error) {
    logError(formatError(deps.error));
    process.exit(1);
  }
  
  // Read Prolog file
  logVerbose(`Reading ${options.prologFile}...`, options);
  let prologContent: string;
  try {
    prologContent = await fs.readFile(options.prologFile, 'utf-8');
  } catch (err) {
    const { createError, ErrorCode } = await import('./errors.js');
    logError(formatError(createError(ErrorCode.FILE_NOT_FOUND, options.prologFile)));
    process.exit(1);
  }
  
  // Parse Prolog clauses (for display purposes)
  logVerbose('Parsing Prolog clauses...', options);
  const clauses = parsePrologFile(prologContent);
  
  // Get absolute path to tracer.pl
  const tracerPath = path.resolve(process.cwd(), 'tracer.pl');
  
  // Create wrapper (no instrumentation needed)
  logVerbose('Creating tracer wrapper...', options);
  const tempFile = await createTempWrapper({
    prologContent,
    query: options.query,
    tracerPath,
  });
  
  try {
    // Execute custom tracer
    logVerbose('Executing custom tracer...', options);
    const execResult = await executeTracer(tempFile.path);
    
    if (execResult.exitCode !== 0 || !execResult.json) {
      logError('Custom tracer execution failed');
      if (execResult.stderr) {
        logError(execResult.stderr);
      }
      process.exit(1);
    }
    
    // Determine output paths based on Prolog file location
    const prologDir = options.prologFile.includes('/') 
      ? options.prologFile.substring(0, options.prologFile.lastIndexOf('/'))
      : '.';
    const prologBasename = options.prologFile.includes('/')
      ? options.prologFile.substring(options.prologFile.lastIndexOf('/') + 1)
      : options.prologFile;
    const nameWithoutExt = prologBasename.replace(/\.pl$/, '');
    
    // Parse JSON trace output
    logVerbose('Parsing JSON trace output...', options);
    const tree = parseTraceJson(execResult.json);
    
    // Analyze tree
    logVerbose('Analyzing execution tree...', options);
    const analysis = analyzeTree(tree, clauses, { detailLevel: options.detail });
    
    // Generate Mermaid diagram
    logVerbose('Generating Mermaid diagram...', options);
    const diagram = generateMermaid(analysis);
    
    // Render markdown
    logVerbose('Rendering markdown...', options);
    const markdown = renderMarkdown({
      query: options.query,
      diagram,
      executionSteps: analysis.executionSteps,
      finalAnswer: analysis.finalAnswer,
      clausesUsed: analysis.clausesUsed,
    });
    
    // Write output - default to source file location if not specified
    const outputPath = options.output || `${prologDir}/${nameWithoutExt}-output.md`;
    await writeOutput({
      content: markdown,
      outputPath,
      verbose: options.verbose,
      quiet: options.quiet,
    });
    
    logInfo('Done!', options);
  } finally {
    // Cleanup
    await tempFile.cleanup();
  }
}

main();
