#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import { parseArgs, getHelpText, getVersion, getCopyright, CLIOptions } from './cli.js';
import { formatError } from './errors.js';
import { createTempWrapper } from './wrapper.js';
import { executeTracer, checkDependencies } from './executor.js';
import * as path from 'node:path';
import { writeOutput, logVerbose, logInfo, logError } from './output.js';
import { parsePrologFile } from './clauses.js';
import { TimelineBuilder, TraceEvent } from './timeline.js';
import { TreeBuilder } from './tree.js';
import { generateMarkdown, ClauseDefinition } from './markdown-generator.js';

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
  
  if (result.type === 'copyright') {
    console.log(getCopyright());
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
  
  // Get absolute path to tracer.pl from package installation
  const tracerPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'tracer.pl');
  
  // Create wrapper (no instrumentation needed)
  logVerbose('Creating tracer wrapper...', options);
  const tempFile = await createTempWrapper({
    prologContent,
    query: options.query,
    depth: options.depth,
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
    const rawEvents = JSON.parse(execResult.json);
    
    // Convert raw events to TraceEvent format
    const traceEvents: TraceEvent[] = rawEvents
      .filter((e: any) => e.port && e.level !== undefined && e.goal && e.predicate)
      .map((e: any) => ({
        port: e.port,
        level: e.level,
        goal: e.goal,
        predicate: e.predicate,
        arguments: e.arguments,
        clause: e.clause,
      }));
    
    // Build timeline
    logVerbose('Building execution timeline...', options);
    const timelineBuilder = new TimelineBuilder(traceEvents);
    const timeline = timelineBuilder.build();
    
    // Build tree
    logVerbose('Building call tree...', options);
    const treeBuilder = new TreeBuilder(traceEvents);
    const tree = treeBuilder.build();
    
    // Prepare clause definitions
    const clauseDefinitions: ClauseDefinition[] = clauses.map(c => ({
      line: c.number,
      text: c.text,
    }));
    
    // Generate markdown
    logVerbose('Generating markdown output...', options);
    const markdown = generateMarkdown({
      query: options.query,
      originalQuery: options.query,
      timeline,
      tree,
      clauses: clauseDefinitions,
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
