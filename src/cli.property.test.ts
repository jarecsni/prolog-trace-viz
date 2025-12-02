import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseArgs } from './cli.js';

describe('CLI Argument Parser - Property Tests', () => {
  /**
   * **Feature: prolog-trace-visualizer, Property 1: Argument validation rejects invalid inputs**
   * **Validates: Requirements 1.2, 1.10**
   * 
   * For any argument array that is missing required arguments (prolog file or query),
   * the argument parser SHALL return an error and the error message SHALL contain usage information.
   */
  it('Property 1: Argument validation rejects invalid inputs', () => {
    // Test with empty arguments (missing both prolog file and query)
    fc.assert(
      fc.property(
        fc.constant(['node', 'prolog-trace-viz']),
        (argv) => {
          const result = parseArgs(argv);
          expect(result.type).toBe('error');
          expect(result.error).toBeDefined();
          expect(result.error!.suggestion).toContain('--help');
        }
      ),
      { numRuns: 100 }
    );

    // Test with only one positional argument (missing query)
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.startsWith('-')),
        (prologFile) => {
          const argv = ['node', 'prolog-trace-viz', prologFile];
          const result = parseArgs(argv);
          expect(result.type).toBe('error');
          expect(result.error).toBeDefined();
          expect(result.error!.details).toContain('query');
        }
      ),
      { numRuns: 100 }
    );

    // Test with unknown flags - should reject
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.startsWith('-')),
        fc.string({ minLength: 1 }).filter(s => !s.startsWith('-')),
        fc.string({ minLength: 2, maxLength: 10 })
          .filter(s => !['h', 'v', 'o'].includes(s) && !s.includes(' '))
          .map(s => `--${s}`),
        (prologFile, query, unknownFlag) => {
          // Skip known flags
          if (['--help', '--version', '--output', '--depth', '--verbose', '--quiet'].includes(unknownFlag)) {
            return true;
          }
          const argv = ['node', 'prolog-trace-viz', prologFile, query, unknownFlag];
          const result = parseArgs(argv);
          expect(result.type).toBe('error');
          expect(result.error).toBeDefined();
          expect(result.error!.details).toContain('Unknown option');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts valid arguments with two positional args', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.startsWith('-') && s.trim().length > 0),
        fc.string({ minLength: 1 }).filter(s => !s.startsWith('-') && s.trim().length > 0),
        (prologFile, query) => {
          const argv = ['node', 'prolog-trace-viz', prologFile, query];
          const result = parseArgs(argv);
          expect(result.type).toBe('options');
          expect(result.options).toBeDefined();
          expect(result.options!.prologFile).toBe(prologFile);
          expect(result.options!.query).toBe(query);
        }
      ),
      { numRuns: 100 }
    );
  });
});
