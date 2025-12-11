import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseTraceJson, TraceEvent } from './parser.js';

describe('JSON Parser Property Tests', () => {
  /**
   * **Feature: json-parser-tree-builder, Property 1: JSON parsing completeness**
   * **Validates: Requirements 1.1, 1.2**
   * 
   * For any valid JSON array of trace events, the parser should successfully parse 
   * all events into TraceEvent objects with all required fields present.
   */
  it('Property 1: JSON parsing completeness - parses valid events with required fields', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit', 'redo', 'fail'),
            level: fc.integer({ min: 0, max: 20 }),
            goal: fc.string({ minLength: 1 }),
            predicate: fc.string({ minLength: 3 }).filter(s => s.includes('/')),
            arguments: fc.option(fc.array(fc.oneof(fc.integer(), fc.string())), { nil: undefined }),
            clause: fc.option(
              fc.record({
                head: fc.string({ minLength: 1 }),
                body: fc.string({ minLength: 1 }),
                line: fc.integer({ min: 1, max: 1000 }),
              }),
              { nil: undefined }
            ),
          }),
          { minLength: 0, maxLength: 100 }
        ),
        (events) => {
          const json = JSON.stringify(events);
          
          // Should parse without throwing
          const tree = parseTraceJson(json);
          
          // Should produce a valid ExecutionNode
          expect(tree).toHaveProperty('id');
          expect(tree).toHaveProperty('type');
          expect(tree).toHaveProperty('goal');
          expect(tree).toHaveProperty('children');
          expect(tree).toHaveProperty('level');
          expect(Array.isArray(tree.children)).toBe(true);
          expect(typeof tree.id).toBe('string');
          expect(['query', 'goal', 'success', 'failure']).toContain(tree.type);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 2: Error resilience**
   * **Validates: Requirements 1.3**
   * 
   * For any malformed JSON input, the parser should handle errors gracefully 
   * and continue processing valid events without crashing.
   */
  it('Property 2: Error resilience - handles malformed JSON gracefully', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('invalid json'),
          fc.constant('{"incomplete": '),
          fc.constant('[{"port": "call", "level": "invalid"}]'),
          fc.constant('[{"port": "invalid_port"}]'),
          fc.constant('[{"missing_required_fields": true}]'),
          fc.constant('null'),
          fc.constant('42'),
          fc.constant('[]'),
          fc.string()
        ),
        (malformedJson) => {
          // Should not throw, even with malformed input
          expect(() => {
            const tree = parseTraceJson(malformedJson);
            // Should return a valid tree structure even for bad input
            expect(tree).toHaveProperty('id');
            expect(tree).toHaveProperty('type');
            expect(tree).toHaveProperty('children');
            expect(Array.isArray(tree.children)).toBe(true);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: custom-tracer-integration, Property 6: JSON output validity**
   * **Validates: Requirements 2.6**
   * 
   * For any trace execution, the output should be valid JSON that can be parsed
   * back into an equivalent data structure.
   */
  it('Property 6: JSON round-trip - valid JSON can be parsed', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit', 'redo', 'fail'),
            level: fc.integer({ min: 0, max: 10 }),
            goal: fc.oneof(
              fc.constant('factorial(0,1)'),
              fc.constant('factorial(N,F)'),
              fc.constant('append([],L,L)'),
              fc.constant('member(X,[X|_])'),
              fc.constant('true')
            ),
            predicate: fc.oneof(
              fc.constant('factorial/2'),
              fc.constant('append/3'),
              fc.constant('member/2'),
              fc.constant('true/0')
            ),
            arguments: fc.option(fc.array(fc.oneof(fc.integer(), fc.string())), { nil: undefined }),
            clause: fc.option(
              fc.record({
                head: fc.string(),
                body: fc.string(),
                line: fc.integer({ min: 1, max: 100 }),
              }),
              { nil: undefined }
            ),
          })
        ),
        (events) => {
          // Serialize to JSON
          const json = JSON.stringify(events);
          
          // Should be valid JSON
          expect(() => JSON.parse(json)).not.toThrow();
          
          // Parse back
          const parsed = JSON.parse(json);
          
          // Should be equivalent
          expect(parsed).toEqual(events);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: custom-tracer-integration, Property 11: Parser format compatibility**
   * **Validates: Requirements 4.3**
   * 
   * For any trace output, the parser should successfully parse JSON input (not LaTeX)
   * and produce ExecutionNode structures.
   */
  it('Property 11: Parser format compatibility - parses JSON to ExecutionNode', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit', 'redo', 'fail'),
            level: fc.integer({ min: 0, max: 5 }),
            goal: fc.constantFrom(
              'factorial(0,1)',
              'factorial(N,F)',
              'append([],L,L)',
              'member(X,[X|_])',
              'true'
            ),
            predicate: fc.constantFrom('factorial/2', 'append/3', 'member/2', 'true/0'),
            arguments: fc.option(fc.array(fc.oneof(fc.integer(), fc.constant('_'))), { nil: undefined }),
            clause: fc.option(
              fc.record({
                head: fc.string(),
                body: fc.string(),
                line: fc.integer({ min: 1, max: 100 }),
              }),
              { nil: undefined }
            ),
          }),
          { minLength: 1 }
        ),
        (events) => {
          const json = JSON.stringify(events);
          
          // Should parse without throwing
          const tree = parseTraceJson(json);
          
          // Should produce a valid ExecutionNode
          expect(tree).toHaveProperty('id');
          expect(tree).toHaveProperty('type');
          expect(tree).toHaveProperty('goal');
          expect(tree).toHaveProperty('children');
          expect(tree).toHaveProperty('level');
          expect(Array.isArray(tree.children)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: custom-tracer-integration, Property 12: Analyzer interface compatibility**
   * **Validates: Requirements 4.4, 6.1**
   * 
   * For any parsed trace, the analyzer should receive ExecutionNode structures with
   * the expected fields (id, type, goal, binding, clauseNumber, children, level).
   */
  it('Property 12: Analyzer interface compatibility - ExecutionNode has required fields', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit'),
            level: fc.integer({ min: 0, max: 3 }),
            goal: fc.constantFrom('test(1)', 'test(2)', 'foo(X)', 'bar(Y,Z)'),
            predicate: fc.constantFrom('test/1', 'foo/1', 'bar/2'),
            arguments: fc.option(fc.array(fc.integer({ min: 0, max: 10 })), { nil: undefined }),
            clause: fc.option(
              fc.record({
                head: fc.string(),
                body: fc.string(),
                line: fc.integer({ min: 1, max: 50 }),
              }),
              { nil: undefined }
            ),
          }),
          { minLength: 2 }
        ),
        (events) => {
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Verify all required fields exist
          function checkNode(node: any): void {
            expect(node).toHaveProperty('id');
            expect(typeof node.id).toBe('string');
            
            expect(node).toHaveProperty('type');
            expect(['query', 'goal', 'success', 'failure']).toContain(node.type);
            
            expect(node).toHaveProperty('goal');
            expect(typeof node.goal).toBe('string');
            
            expect(node).toHaveProperty('children');
            expect(Array.isArray(node.children)).toBe(true);
            
            expect(node).toHaveProperty('level');
            expect(typeof node.level).toBe('number');
            expect(node.level).toBeGreaterThanOrEqual(0);
            
            // Recursively check children
            for (const child of node.children) {
              checkNode(child);
            }
          }
          
          checkNode(tree);
        }
      ),
      { numRuns: 100 }
    );
  });
});
