import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateWrapper, parseWrapper, WrapperConfig } from './wrapper.js';

describe('Wrapper Generator - Property Tests', () => {
  /**
   * **Feature: prolog-trace-visualizer, Property 2: Wrapper file contains all input content**
   * **Validates: Requirements 2.2, 2.3**
   * 
   * For any Prolog file content and query string, the generated wrapper file SHALL contain
   * the Prolog content within `:-begin_program.` and `:-end_program.` markers AND the query
   * within `:-begin_query.` and `:-end_query.` markers.
   */
  it('Property 2: Wrapper file contains all input content', () => {
    // Generate arbitrary Prolog-like content (avoiding special regex chars for simplicity)
    const arbitraryPrologContent = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_(),. \n'),
      { minLength: 1, maxLength: 200 }
    ).filter(s => s.trim().length > 0);

    const arbitraryQuery = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_(),. '),
      { minLength: 1, maxLength: 100 }
    ).filter(s => s.trim().length > 0);

    const arbitraryDepth = fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined });

    fc.assert(
      fc.property(
        arbitraryPrologContent,
        arbitraryQuery,
        arbitraryDepth,
        (prologContent, query, depth) => {
          const config: WrapperConfig = { prologContent, query, depth };
          const wrapper = generateWrapper(config);

          // Verify begin_program and end_program markers exist
          expect(wrapper).toContain(':- begin_program.');
          expect(wrapper).toContain(':- end_program.');

          // Verify begin_query and end_query markers exist
          expect(wrapper).toContain(':- begin_query.');
          expect(wrapper).toContain(':- end_query.');

          // Verify the prolog content is between program markers
          const programMatch = wrapper.match(/:-\s*begin_program\.\s*([\s\S]*?)\s*:-\s*end_program\./);
          expect(programMatch).not.toBeNull();
          expect(programMatch![1].trim()).toBe(prologContent.trim());

          // Verify the query is between query markers
          const queryMatch = wrapper.match(/:-\s*begin_query\.\s*([\s\S]*?)\s*:-\s*end_query\./);
          expect(queryMatch).not.toBeNull();
          expect(queryMatch![1].trim()).toBe(query.trim());

          // Verify depth is included if specified
          if (depth !== undefined) {
            expect(wrapper).toContain(`:- set_depth(${depth}).`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trip: parseWrapper recovers original config', () => {
    const arbitraryPrologContent = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_(),. \n'),
      { minLength: 1, maxLength: 200 }
    ).filter(s => s.trim().length > 0);

    const arbitraryQuery = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_(),. '),
      { minLength: 1, maxLength: 100 }
    ).filter(s => s.trim().length > 0);

    const arbitraryDepth = fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined });

    fc.assert(
      fc.property(
        arbitraryPrologContent,
        arbitraryQuery,
        arbitraryDepth,
        (prologContent, query, depth) => {
          const config: WrapperConfig = { prologContent, query, depth };
          const wrapper = generateWrapper(config);
          const parsed = parseWrapper(wrapper);

          expect(parsed).not.toBeNull();
          expect(parsed!.prologContent).toBe(prologContent.trim());
          expect(parsed!.query).toBe(query.trim());
          expect(parsed!.depth).toBe(depth);
        }
      ),
      { numRuns: 100 }
    );
  });
});
