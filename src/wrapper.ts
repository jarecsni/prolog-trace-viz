import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface WrapperConfig {
  prologContent: string;
  query: string;
  depth?: number;
}

export interface TempFile {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Generates the sldnfdraw wrapper file content.
 * The wrapper includes:
 * - sldnfdraw library import
 * - User's Prolog clauses in begin_program section (instrumented with clause markers)
 * - User's query in begin_query section
 * - Optional depth parameter
 */
export function generateWrapper(config: WrapperConfig): string {
  const { prologContent, query, depth } = config;
  
  const lines: string[] = [
    ':- use_module(library(sldnfdraw)).',
    '',
    ':- sldnf.',
    '',
  ];
  
  // Add depth configuration if specified
  if (depth !== undefined) {
    lines.push(`:- set_depth(${depth}).`);
    lines.push('');
  }
  
  // Begin program section with instrumented Prolog content
  lines.push(':-begin_program.');
  lines.push('');
  lines.push('% Clause marker predicate (no-op, just for tracking)');
  lines.push('clause_marker(_, _).');
  lines.push('');
  lines.push(prologContent.trim());
  lines.push('');
  lines.push(':- end_program.');
  lines.push('');
  
  // Begin query section
  lines.push(':- begin_query.');
  lines.push('');
  lines.push(query.trim() + '.');
  lines.push('');
  lines.push(':- end_query.');
  lines.push('');
  
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
  const programMatch = content.match(/:-\s*begin_program\.\s*([\s\S]*?)\s*:-\s*end_program\./);
  const queryMatch = content.match(/:-\s*begin_query\.\s*([\s\S]*?)\s*:-\s*end_query\./);
  const depthMatch = content.match(/:- set_depth\((\d+)\)\./);
  
  if (!programMatch || !queryMatch) {
    return null;
  }
  
  let query = queryMatch[1].trim();
  // Remove trailing period if present
  if (query.endsWith('.')) {
    query = query.slice(0, -1).trim();
  }
  
  return {
    prologContent: programMatch[1].trim(),
    query,
    depth: depthMatch ? parseInt(depthMatch[1], 10) : undefined,
  };
}
