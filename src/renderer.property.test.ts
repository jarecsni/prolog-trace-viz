import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  renderMarkdown, 
  renderLegend, 
  renderExecutionSteps,
  hasRequiredSections,
  RenderContext,
} from './renderer.js';
import { ExecutionStep, ClauseUsage } from './analyzer.js';

// Arbitrary query strings
const arbitraryQuery = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_(),. '),
  { minLength: 1, maxLength: 50 }
).filter(s => s.trim().length > 0);

// Arbitrary execution steps
const arbitraryExecutionStep: fc.Arbitrary<ExecutionStep> = fc.record({
  stepNumber: fc.integer({ min: 1, max: 20 }),
  description: fc.string({ minLength: 1, maxLength: 50 }),
  goal: fc.string({ minLength: 1, maxLength: 30 }),
  clauseMatched: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  bindings: fc.option(
    fc.dictionary(
      fc.stringOf(fc.constantFrom(...'ABCXYZ'), { minLength: 1, maxLength: 5 }),
      fc.string({ minLength: 1, maxLength: 10 })
    ),
    { nil: undefined }
  ),
  newGoals: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }), { nil: undefined }),
});

// Arbitrary clause usage
const arbitraryClauseUsage: fc.Arbitrary<ClauseUsage> = fc.record({
  clauseNumber: fc.integer({ min: 1, max: 10 }),
  clauseText: fc.string({ minLength: 1, maxLength: 30 }),
  usageCount: fc.integer({ min: 1, max: 10 }),
  usedAtSteps: fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 5 }),
});

describe('Markdown Renderer - Property Tests', () => {
  /**
   * **Feature: prolog-trace-visualizer, Property 14: Markdown output contains all required sections**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
   * 
   * For any generated markdown output, the document SHALL contain:
   * - a title with the query
   * - a code block with the original query
   * - a mermaid code fence
   * - a legend section
   * - an execution steps section
   * - a final answer section
   * - a clauses used section
   */
  it('Property 14: Markdown output contains all required sections', () => {
    fc.assert(
      fc.property(
        arbitraryQuery,
        fc.array(arbitraryExecutionStep, { maxLength: 5 }),
        fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
        fc.array(arbitraryClauseUsage, { maxLength: 3 }),
        (query, steps, finalAnswer, clauses) => {
          const context: RenderContext = {
            query,
            diagram: 'flowchart TD\n  A --> B',
            executionSteps: steps,
            finalAnswer,
            clausesUsed: clauses,
          };
          
          const markdown = renderMarkdown(context);
          const sections = hasRequiredSections(markdown);
          
          expect(sections.hasTitle).toBe(true);
          expect(sections.hasQuery).toBe(true);
          expect(sections.hasMermaid).toBe(true);
          expect(sections.hasLegend).toBe(true);
          expect(sections.hasSteps).toBe(true);
          expect(sections.hasFinalAnswer).toBe(true);
          expect(sections.hasClausesUsed).toBe(true);
          
          // Query should appear in the document
          expect(markdown).toContain(query);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('legend contains all required symbols', () => {
    const legend = renderLegend();
    
    expect(legend).toContain('🎯');
    expect(legend).toContain('🔄');
    expect(legend).toContain('⏸️');
    expect(legend).toContain('✅');
    expect(legend).toContain('🎉');
    expect(legend).toContain('Legend');
  });

  it('execution steps are rendered with step numbers', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryExecutionStep, { minLength: 1, maxLength: 5 }),
        (steps) => {
          const rendered = renderExecutionSteps(steps);
          
          for (const step of steps) {
            expect(rendered).toContain(`Step ${step.stepNumber}`);
            expect(rendered).toContain(step.goal);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty steps produce placeholder message', () => {
    const rendered = renderExecutionSteps([]);
    expect(rendered).toContain('No execution steps');
  });
});
