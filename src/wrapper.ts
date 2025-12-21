import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface WrapperConfig {
  prologContent: string;
  query: string;
  depth?: number;
  tracerPath: string;
}

export interface TempFile {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Generates the custom tracer wrapper file content.
 * The wrapper includes:
 * - Custom tracer import
 * - User's Prolog code (loaded without instrumentation)
 * - Query execution with tracer installed
 * - JSON export after query
 * - Tracer cleanup
 */
export function generateWrapper(config: WrapperConfig): string {
  const { prologContent, query, depth, tracerPath } = config;
  const maxDepth = depth || 100; // Default to 100 if not specified
  
  const lines: string[] = [
    `% Load custom tracer`,
    `:- ['${tracerPath}'].`,
    '',
    `% User's Prolog code (no instrumentation)`,
  ];
  
  // Add user content and track line mapping
  const userLines = prologContent.trim().split('\n');
  const wrapperStartLine = lines.length + 1; // +1 for 1-based indexing
  
  lines.push(...userLines);
  lines.push('');
  lines.push('% Run trace with error handling');
  lines.push('run_trace :-');
  lines.push(`    install_tracer(${maxDepth}),`);
  lines.push('    catch(');
  lines.push(`        (${query.trim()}, export_trace_json('trace.json')),`);
  lines.push('        Error,');
  lines.push(`        (format('Error: ~w~n', [Error]), export_trace_json('trace.json'))`);
  lines.push('    ),');
  lines.push('    remove_tracer.');
  lines.push('');
  lines.push(':- run_trace.');
  lines.push(':- halt.');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Calculates the line offset between wrapper file and original source file.
 * This is needed because the tracer reports line numbers from the wrapper file,
 * but we need to map them back to the original source file line numbers.
 */
export function calculateLineOffset(prologContent: string): number {
  // The wrapper structure is:
  // Line 1: % Load custom tracer
  // Line 2: :- ['tracerPath'].
  // Line 3: (empty)
  // Line 4: % User's Prolog code (no instrumentation)
  // Line 5+: User content starts here
  
  return 4; // User content starts at line 5 in wrapper, so offset is 4
}

/**
 * Maps a line number from the wrapper file back to the original source file.
 */
export function mapWrapperLineToSource(wrapperLine: number, prologContent: string): number {
  const offset = calculateLineOffset(prologContent);
  const sourceLineInWrapper = wrapperLine - offset;
  
  // Now we need to find which actual source line this corresponds to
  // by accounting for empty lines and comments that were preserved
  const sourceLines = prologContent.split('\n');
  let actualSourceLine = 0;
  let nonEmptyLineCount = 0;
  
  for (let i = 0; i < sourceLines.length; i++) {
    actualSourceLine = i + 1; // 1-based line numbers
    const line = sourceLines[i].trim();
    
    // Skip empty lines and comments when counting
    if (line.length > 0 && !line.startsWith('%') && !line.startsWith('/*')) {
      nonEmptyLineCount++;
      if (nonEmptyLineCount === sourceLineInWrapper) {
        return actualSourceLine;
      }
    }
  }
  
  return actualSourceLine; // Fallback to last line
}
export async function createTempWrapper(config: WrapperConfig): Promise<TempFile> {
  const content = generateWrapper(config);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prolog-trace-viz-'));
  const wrapperPath = path.join(tempDir, 'wrapper.pl');
  
  await fs.writeFile(wrapperPath, content, 'utf-8');
  
  return {
    path: wrapperPath,
    cleanup: async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

/**
 * Serializes a wrapper back to its component parts (for testing round-trips).
 * Returns null if the content doesn't match expected wrapper format.
 */
export function parseWrapper(content: string): WrapperConfig | null {
  // Extract tracer path
  const tracerMatch = content.match(/:-\s*\['([^']+)'\]\./);
  if (!tracerMatch) {
    return null;
  }
  const tracerPath = tracerMatch[1];
  
  // Extract query from run_trace predicate - match everything between ( and , export_trace_json
  const queryMatch = content.match(/catch\(\s*\(([\s\S]*?),\s*export_trace_json/);
  if (!queryMatch) {
    return null;
  }
  const query = queryMatch[1].trim();
  
  // Extract user's Prolog content (between tracer load and run_trace)
  const contentMatch = content.match(/:-\s*\['[^']+'\]\.\s*\n\s*%\s*User's Prolog code[^\n]*\n([\s\S]*?)\n\s*%\s*Run trace/);
  if (!contentMatch) {
    return null;
  }
  const prologContent = contentMatch[1].trim();
  
  return {
    prologContent,
    query,
    tracerPath,
  };
}
