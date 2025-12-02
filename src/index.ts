#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import { parseArgs, getHelpText, getVersion, CLIOptions } from './cli.js';
import { formatError } from './errors.js';
import { generateWrapper, createTempWrapper } from './wrapper.js';
import { executeSldnfdraw, checkDependencies } from './executor.js';
import { parseLatex } from './parser.js';
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
  
  // Parse Prolog clauses
  logVerbose('Parsing Prolog clauses...', options);
  const clauses = parsePrologFile(prologContent);
  
  // Instrument Prolog code with clause markers
  logVerbose('Instrumenting Prolog code...', options);
  const { instrumentPrologCode } = await import('./clauses.js');
  const instrumentedContent = instrumentPrologCode(prologContent);
  
  // Create wrapper
  logVerbose('Creating sldnfdraw wrapper...', options);
  const tempFile = await createTempWrapper({
    prologContent: instrumentedContent,
    query: options.query,
    depth: options.depth,
  });
  
  try {
    // Execute sldnfdraw
    logVerbose('Executing sldnfdraw...', options);
    const execResult = await executeSldnfdraw(tempFile.path);
    
    if (execResult.exitCode !== 0 || !execResult.latex) {
      logError('sldnfdraw execution failed');
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
    
    // Save LaTeX trace next to source file
    const latexPath = `${prologDir}/${nameWithoutExt}-trace.tex`;
    await fs.writeFile(latexPath, execResult.latex, 'utf-8');
    logVerbose(`LaTeX saved to ${latexPath}`, options);
    
    // Parse LaTeX
    logVerbose('Parsing LaTeX output...', options);
    const tree = parseLatex(execResult.latex);
    
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
