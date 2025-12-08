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
  const { prologContent, query, tracerPath } = config;
  
  const lines: string[] = [
    `% Load custom tracer`,
    `:- ['${tracerPath}'].`,
    '',
    `% User's Prolog code (no instrumentation)`,
    prologContent.trim(),
    '',
    '% Run trace with error handling',
    'run_trace :-',
    '    install_tracer,',
    '    catch(',
    `        (${query.trim()}, export_trace_json('trace.json')),`,
    '        Error,',
    `        (format('Error: ~w~n', [Error]), export_trace_json('trace.json'))`,
    '    ),',
    '    remove_tracer.',
    '',
    ':- run_trace.',
    ':- halt.',
    '',
  ];
  
  return lines.join('\n');
}

/**
 * Creates a temporary wrapper file and returns its path along with a cleanup function.
 */
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
