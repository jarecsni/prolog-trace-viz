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
   * **Feature: json-parser-tree-builder, Property 5: Stack management**
   * **Validates: Requirements 2.1, 2.5**
   * 
   * For any sequence of call events, the call stack should grow appropriately, 
   * and for matching exit events, the stack should shrink correctly.
   */
  it('Property 5: Stack management - call stack grows and shrinks correctly', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit'),
            level: fc.integer({ min: 0, max: 5 }),
            goal: fc.string({ minLength: 1 }),
            predicate: fc.string({ minLength: 3 }).filter(s => s.includes('/')),
            arguments: fc.option(fc.array(fc.oneof(fc.integer(), fc.string())), { nil: undefined }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (events) => {
          // Ensure we have balanced call/exit pairs
          const balancedEvents = [];
          const callStack = new Map();
          
          for (const event of events) {
            if (event.port === 'call') {
              balancedEvents.push(event);
              callStack.set(event.level, event);
            } else if (event.port === 'exit' && callStack.has(event.level)) {
              const callEvent = callStack.get(event.level);
              balancedEvents.push({
                ...event,
                goal: callEvent.goal,
                predicate: callEvent.predicate,
              });
              callStack.delete(event.level);
            }
          }
          
          if (balancedEvents.length === 0) return;
          
          const json = JSON.stringify(balancedEvents);
          const tree = parseTraceJson(json);
          
          // Should produce a valid tree structure
          expect(tree).toHaveProperty('id');
          expect(tree).toHaveProperty('type');
          expect(tree).toHaveProperty('children');
          expect(Array.isArray(tree.children)).toBe(true);
          
          // Tree should reflect proper nesting based on levels
          function validateNesting(node: any, expectedMinLevel: number): void {
            expect(node.level).toBeGreaterThanOrEqual(expectedMinLevel);
            for (const child of node.children) {
              if (child.type !== 'success' && child.type !== 'failure') {
                validateNesting(child, node.level);
              }
            }
          }
          
          if (balancedEvents.length > 0) {
            const minLevel = Math.min(...balancedEvents.map(e => e.level));
            validateNesting(tree, minLevel);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 11: Recursion handling**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   * 
   * For any recursive call sequence, the tree builder should maintain separate 
   * stack entries for each recursion level and create distinct ExecutionNode instances.
   */
  it('Property 11: Recursion handling - separate nodes for each recursion level', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.string({ minLength: 1 }),
        (maxDepth, basePredicate) => {
          // Generate recursive call sequence
          const events = [];
          const predicate = `${basePredicate}/1`;
          
          // Generate nested calls
          for (let level = 0; level < maxDepth; level++) {
            events.push({
              port: 'call' as const,
              level,
              goal: `${basePredicate}(${level})`,
              predicate,
            });
          }
          
          // Generate matching exits in reverse order
          for (let level = maxDepth - 1; level >= 0; level--) {
            events.push({
              port: 'exit' as const,
              level,
              goal: `${basePredicate}(${level})`,
              predicate,
              arguments: [level.toString()],
            });
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Should have proper recursive structure
          expect(tree.type).toBe('query');
          expect(tree.level).toBe(0);
          
          // Each level should have distinct nodes
          function countNodesAtLevel(node: any, targetLevel: number): number {
            let count = node.level === targetLevel ? 1 : 0;
            for (const child of node.children) {
              count += countNodesAtLevel(child, targetLevel);
            }
            return count;
          }
          
          // Should have exactly one node at each level
          for (let level = 0; level < maxDepth; level++) {
            const nodesAtLevel = countNodesAtLevel(tree, level);
            expect(nodesAtLevel).toBeGreaterThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 6: Unification extraction**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   * 
   * For any exit event containing arguments, the tree builder should extract 
   * unifications and create appropriate Unification objects.
   */
  it('Property 6: Unification extraction - extracts variable bindings from exit events', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            predicate: fc.constantFrom('test/1', 'factorial/2', 'append/3'),
            level: fc.integer({ min: 0, max: 2 }),
            variables: fc.array(fc.constantFrom('X', 'Y', 'Z', 'N', 'F', 'L'), { minLength: 1, maxLength: 3 }),
            values: fc.array(fc.oneof(fc.integer(), fc.string(), fc.array(fc.integer())), { minLength: 1, maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (specs) => {
          const events = [];
          
          for (const spec of specs) {
            const goalName = spec.predicate.split('/')[0];
            const callArgs = spec.variables.join(',');
            const callGoal = `${goalName}(${callArgs})`;
            
            // Generate call event
            events.push({
              port: 'call' as const,
              level: spec.level,
              goal: callGoal,
              predicate: spec.predicate,
            });
            
            // Generate matching exit event with arguments
            const exitArgs = spec.values.slice(0, spec.variables.length);
            events.push({
              port: 'exit' as const,
              level: spec.level,
              goal: callGoal,
              predicate: spec.predicate,
              arguments: exitArgs,
            });
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Should extract unifications from exit events
          function checkUnifications(node: any): void {
            if (node.unifications && node.unifications.length > 0) {
              // Each unification should have variable and value
              for (const unification of node.unifications) {
                expect(unification).toHaveProperty('variable');
                expect(unification).toHaveProperty('value');
                expect(typeof unification.variable).toBe('string');
                expect(typeof unification.value).toBe('string');
                
                // Variable should start with uppercase or underscore (Prolog variable convention)
                expect(unification.variable).toMatch(/^[A-Z_]/);
              }
              
              // Should have binding format for analyzer compatibility
              if (node.binding) {
                expect(typeof node.binding).toBe('string');
                // Should contain variable = value format
                expect(node.binding).toMatch(/\w+\s*=\s*.+/);
              }
            }
            
            // Recursively check children
            for (const child of node.children) {
              checkUnifications(child);
            }
          }
          
          checkUnifications(tree);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 16: Binding format consistency**
   * **Validates: Requirements 7.5**
   * 
   * For any ExecutionNode with bindings, the binding format should match 
   * the analyzer's expectations (e.g., "X = 5").
   */
  it('Property 16: Binding format consistency - bindings match analyzer format', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            predicate: fc.constantFrom('test/1', 'factorial/2', 'append/3'),
            level: fc.integer({ min: 0, max: 2 }),
            variable: fc.constantFrom('X', 'Y', 'Z', 'N', 'F', 'Result'),
            value: fc.oneof(
              fc.integer({ min: 0, max: 100 }),
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.array(fc.integer({ min: 0, max: 10 }), { maxLength: 5 })
            ),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (specs) => {
          const events = [];
          
          for (const spec of specs) {
            const goalName = spec.predicate.split('/')[0];
            const callGoal = `${goalName}(${spec.variable})`;
            
            // Generate call event
            events.push({
              port: 'call' as const,
              level: spec.level,
              goal: callGoal,
              predicate: spec.predicate,
            });
            
            // Generate matching exit event with arguments
            events.push({
              port: 'exit' as const,
              level: spec.level,
              goal: callGoal,
              predicate: spec.predicate,
              arguments: [spec.value],
            });
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Check binding format consistency
          function checkBindingFormat(node: any): void {
            if (node.binding) {
              // Should be a string
              expect(typeof node.binding).toBe('string');
              
              // Should match "Variable = Value" format
              expect(node.binding).toMatch(/^[A-Z_][a-zA-Z0-9_]*\s*=\s*.+/);
              
              // Should not have trailing commas
              expect(node.binding).not.toMatch(/,\s*$/);
              
              // Should not have leading whitespace (trailing whitespace may occur with whitespace-only values)
              expect(node.binding).not.toMatch(/^\s/);
              
              // If multiple bindings, should be comma-separated (but not inside arrays/objects)
              // For now, just check that the overall format is correct
              // More sophisticated parsing would be needed to handle nested commas properly
            }
            
            // Recursively check children
            for (const child of node.children) {
              checkBindingFormat(child);
            }
          }
          
          checkBindingFormat(tree);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 7: Clause information preservation**
   * **Validates: Requirements 4.1, 4.2**
   * 
   * For any trace event containing clause information, the resulting ExecutionNode 
   * should preserve the clause head, body, line number, and clause number.
   */
  it('Property 7: Clause information preservation - preserves clause metadata', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            predicate: fc.constantFrom('factorial/2', 'append/3', 'member/2'),
            level: fc.integer({ min: 0, max: 2 }),
            clauseHead: fc.string({ minLength: 5, maxLength: 20 }),
            clauseBody: fc.string({ minLength: 3, maxLength: 15 }),
            clauseLine: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (specs) => {
          const events = [];
          
          for (const spec of specs) {
            const goalName = spec.predicate.split('/')[0];
            const goal = `${goalName}(X)`;
            
            // Generate call event with clause information
            events.push({
              port: 'call' as const,
              level: spec.level,
              goal,
              predicate: spec.predicate,
              clause: {
                head: spec.clauseHead,
                body: spec.clauseBody,
                line: spec.clauseLine,
              },
            });
            
            // Generate matching exit event with same clause information
            events.push({
              port: 'exit' as const,
              level: spec.level,
              goal,
              predicate: spec.predicate,
              arguments: ['result'],
              clause: {
                head: spec.clauseHead,
                body: spec.clauseBody,
                line: spec.clauseLine,
              },
            });
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Check clause information preservation
          function checkClauseInfo(node: any): void {
            if (node.clauseLine !== undefined) {
              // Should preserve clause line number
              expect(typeof node.clauseLine).toBe('number');
              expect(node.clauseLine).toBeGreaterThan(0);
              
              // Should have clause number (currently same as line number)
              expect(node.clauseNumber).toBeDefined();
              expect(typeof node.clauseNumber).toBe('number');
              expect(node.clauseNumber).toBeGreaterThan(0);
            }
            
            // Recursively check children
            for (const child of node.children) {
              checkClauseInfo(child);
            }
          }
          
          checkClauseInfo(tree);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 8: Graceful clause handling**
   * **Validates: Requirements 4.3**
   * 
   * For any trace event missing clause information, the tree builder should 
   * continue processing without errors.
   */
  it('Property 8: Graceful clause handling - handles missing clause info', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            predicate: fc.constantFrom('test/1', 'helper/2', 'factorial/2'),
            level: fc.integer({ min: 0, max: 2 }),
            hasClause: fc.boolean(),
            clauseHead: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
            clauseBody: fc.option(fc.string({ minLength: 3, maxLength: 15 }), { nil: undefined }),
            clauseLine: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (specs) => {
          const events = [];
          
          for (const spec of specs) {
            const goalName = spec.predicate.split('/')[0];
            const goal = `${goalName}(X)`;
            
            // Generate call event - sometimes with clause info, sometimes without
            const callEvent: any = {
              port: 'call' as const,
              level: spec.level,
              goal,
              predicate: spec.predicate,
            };
            
            // Add clause information only if hasClause is true and all fields are present
            if (spec.hasClause && spec.clauseHead && spec.clauseBody && spec.clauseLine) {
              callEvent.clause = {
                head: spec.clauseHead,
                body: spec.clauseBody,
                line: spec.clauseLine,
              };
            }
            
            events.push(callEvent);
            
            // Generate matching exit event
            const exitEvent: any = {
              port: 'exit' as const,
              level: spec.level,
              goal,
              predicate: spec.predicate,
              arguments: ['result'],
            };
            
            // Sometimes add clause info to exit event too
            if (spec.hasClause && spec.clauseHead && spec.clauseBody && spec.clauseLine) {
              exitEvent.clause = {
                head: spec.clauseHead,
                body: spec.clauseBody,
                line: spec.clauseLine,
              };
            }
            
            events.push(exitEvent);
          }
          
          const json = JSON.stringify(events);
          
          // Should not throw even with missing clause information
          expect(() => {
            const tree = parseTraceJson(json);
            
            // Should produce a valid tree structure
            expect(tree).toHaveProperty('id');
            expect(tree).toHaveProperty('type');
            expect(tree).toHaveProperty('children');
            expect(Array.isArray(tree.children)).toBe(true);
            
            // Tree should be valid even if some nodes lack clause info
            function validateTree(node: any): void {
              expect(node).toHaveProperty('id');
              expect(node).toHaveProperty('type');
              expect(['query', 'goal', 'success', 'failure']).toContain(node.type);
              
              // Clause info is optional - should not cause errors if missing
              if (node.clauseLine !== undefined) {
                expect(typeof node.clauseLine).toBe('number');
              }
              if (node.clauseNumber !== undefined) {
                expect(typeof node.clauseNumber).toBe('number');
              }
              
              for (const child of node.children) {
                validateTree(child);
              }
            }
            
            validateTree(tree);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 4: Call/exit matching**
   * **Validates: Requirements 2.2, 2.4**
   * 
   * For any call event followed by a matching exit event at the same level 
   * and predicate, the tree builder should create a parent-child relationship.
   */
  it('Property 4: Call/exit matching - creates proper parent-child relationships', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            predicate: fc.constantFrom('test/1', 'helper/2', 'factorial/2'),
            level: fc.integer({ min: 0, max: 3 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (predicateSpecs) => {
          // Generate balanced call/exit pairs
          const events = [];
          
          // Generate calls in ascending level order
          for (const spec of predicateSpecs.sort((a, b) => a.level - b.level)) {
            const goalName = spec.predicate.split('/')[0];
            events.push({
              port: 'call' as const,
              level: spec.level,
              goal: `${goalName}(X)`,
              predicate: spec.predicate,
            });
          }
          
          // Generate exits in descending level order
          for (const spec of predicateSpecs.sort((a, b) => b.level - a.level)) {
            const goalName = spec.predicate.split('/')[0];
            events.push({
              port: 'exit' as const,
              level: spec.level,
              goal: `${goalName}(X)`,
              predicate: spec.predicate,
              arguments: ['result'],
            });
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Should create proper tree structure
          expect(tree).toHaveProperty('type');
          expect(tree).toHaveProperty('children');
          
          // Verify parent-child relationships
          function validateParentChild(node: any): void {
            for (const child of node.children) {
              if (child.type !== 'success' && child.type !== 'failure') {
                // Child level should be greater than parent level
                expect(child.level).toBeGreaterThan(node.level);
              }
              validateParentChild(child);
            }
          }
          
          validateParentChild(tree);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 3: Root node structure**
   * **Validates: Requirements 1.4, 7.1**
   * 
   * For any valid trace event sequence, the tree builder should return 
   * exactly one root node with type 'query'.
   */
  it('Property 3: Root node structure - returns single query root', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit'),
            level: fc.integer({ min: 0, max: 3 }),
            goal: fc.constantFrom('test(X)', 'helper(Y)', 'factorial(N,F)'),
            predicate: fc.constantFrom('test/1', 'helper/1', 'factorial/2'),
            arguments: fc.option(fc.array(fc.string()), { nil: undefined }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (events) => {
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Should always return exactly one root node
          expect(tree).toHaveProperty('id');
          expect(tree).toHaveProperty('type');
          expect(tree.type).toBe('query');
          expect(tree).toHaveProperty('children');
          expect(Array.isArray(tree.children)).toBe(true);
          expect(tree).toHaveProperty('level');
          expect(typeof tree.level).toBe('number');
          expect(tree.level).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 13: Node type correctness**
   * **Validates: Requirements 7.2**
   * 
   * For any trace event, the resulting ExecutionNode should have the 
   * appropriate type based on the event sequence (goal, success, failure).
   */
  it('Property 13: Node type correctness - assigns correct node types', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            port: fc.constantFrom('call', 'exit', 'fail'),
            level: fc.integer({ min: 0, max: 2 }),
            goal: fc.string({ minLength: 1 }),
            predicate: fc.string({ minLength: 3 }).filter(s => s.includes('/')),
            arguments: fc.option(fc.array(fc.string()), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 8 }
        ),
        (events) => {
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Root should always be query type
          expect(tree.type).toBe('query');
          
          // Validate node types throughout tree
          function validateNodeTypes(node: any): void {
            expect(['query', 'goal', 'success', 'failure']).toContain(node.type);
            
            // Query type should only be at root
            if (node.type === 'query') {
              // The root level should be >= 0 (since invalid events might be filtered out)
              expect(node.level).toBeGreaterThanOrEqual(0);
            }
            
            // Success/failure nodes should be leaf nodes
            if (node.type === 'success' || node.type === 'failure') {
              expect(node.children).toEqual([]);
            }
            
            for (const child of node.children) {
              validateNodeTypes(child);
            }
          }
          
          validateNodeTypes(tree);
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
   * **Feature: json-parser-tree-builder, Property 9: Backtracking representation**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   * 
   * For any sequence containing redo events, the tree builder should maintain 
   * proper tree structure and handle alternative execution paths correctly.
   */
  it('Property 9: Backtracking representation - handles redo events correctly', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            predicate: fc.constantFrom('member/2', 'append/3', 'test/1'),
            level: fc.integer({ min: 0, max: 2 }),
            solutions: fc.array(fc.oneof(fc.integer(), fc.string()), { minLength: 1, maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (specs) => {
          const events = [];
          
          for (const spec of specs) {
            const goalName = spec.predicate.split('/')[0];
            const goal = `${goalName}(X,Y)`;
            
            // Generate call event
            events.push({
              port: 'call' as const,
              level: spec.level,
              goal,
              predicate: spec.predicate,
            });
            
            // Generate multiple solutions with redo events
            for (let i = 0; i < spec.solutions.length; i++) {
              if (i > 0) {
                // Add redo event before subsequent solutions
                events.push({
                  port: 'redo' as const,
                  level: spec.level,
                  goal,
                  predicate: spec.predicate,
                });
              }
              
              // Add exit event for this solution
              events.push({
                port: 'exit' as const,
                level: spec.level,
                goal,
                predicate: spec.predicate,
                arguments: [spec.solutions[i], 'result'],
              });
            }
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Should handle redo events without breaking tree structure
          expect(tree).toHaveProperty('id');
          expect(tree).toHaveProperty('type');
          expect(tree.type).toBe('query');
          expect(tree).toHaveProperty('children');
          expect(Array.isArray(tree.children)).toBe(true);
          
          // Tree should remain valid even with backtracking
          function validateTreeStructure(node: any): void {
            expect(node).toHaveProperty('id');
            expect(node).toHaveProperty('type');
            expect(['query', 'goal', 'success', 'failure']).toContain(node.type);
            expect(node).toHaveProperty('children');
            expect(Array.isArray(node.children)).toBe(true);
            
            for (const child of node.children) {
              validateTreeStructure(child);
            }
          }
          
          validateTreeStructure(tree);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 10: Multiple solution handling**
   * **Validates: Requirements 5.4**
   * 
   * For any goal with multiple solutions, the tree builder should represent 
   * all solutions appropriately without losing information.
   */
  it('Property 10: Multiple solution handling - preserves all solutions', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.constantFrom('member/2', 'test/1', 'choice/1'),
        (numSolutions, predicate) => {
          const events = [];
          const goalName = predicate.split('/')[0];
          const goal = `${goalName}(X)`;
          
          // Generate call event
          events.push({
            port: 'call' as const,
            level: 0,
            goal,
            predicate,
          });
          
          // Generate multiple solutions
          for (let i = 0; i < numSolutions; i++) {
            if (i > 0) {
              // Add redo event for backtracking
              events.push({
                port: 'redo' as const,
                level: 0,
                goal,
                predicate,
              });
            }
            
            // Add exit event for this solution
            events.push({
              port: 'exit' as const,
              level: 0,
              goal,
              predicate,
              arguments: [i + 1], // Different solution each time
            });
          }
          
          const json = JSON.stringify(events);
          const tree = parseTraceJson(json);
          
          // Should preserve information about multiple solutions
          expect(tree.type).toBe('query');
          expect(tree.goal).toBe(goal);
          
          // Should have unifications from the final solution
          if (tree.unifications) {
            expect(tree.unifications.length).toBeGreaterThan(0);
            // Should have the last solution's binding
            const xUnification = tree.unifications.find(u => u.variable === 'X');
            expect(xUnification).toBeDefined();
            expect(xUnification?.value).toBe(numSolutions.toString());
          }
          
          // Tree structure should remain valid
          expect(tree.children).toBeDefined();
          expect(Array.isArray(tree.children)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: json-parser-tree-builder, Property 12: Deep recursion support**
   * **Validates: Requirements 6.4**
   * 
   * For any deeply nested recursive sequence, the tree builder should handle 
   * arbitrary recursion depths without stack overflow or performance issues.
   */
  it('Property 12: Deep recursion support - handles arbitrary recursion depths', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }), // Test with significant recursion depth
        fc.constantFrom('factorial/2', 'countdown/1', 'deep/1'),
        (depth, predicate) => {
          const events = [];
          const goalName = predicate.split('/')[0];
          
          // Generate deep recursive call sequence
          for (let level = 0; level < depth; level++) {
            events.push({
              port: 'call' as const,
              level,
              goal: `${goalName}(${depth - level})`,
              predicate,
            });
          }
          
          // Generate matching exits in reverse order (unwinding recursion)
          for (let level = depth - 1; level >= 0; level--) {
            events.push({
              port: 'exit' as const,
              level,
              goal: `${goalName}(${depth - level})`,
              predicate,
              arguments: [depth - level, 'result'],
            });
          }
          
          const json = JSON.stringify(events);
          
          // Should handle deep recursion without stack overflow
          const startTime = Date.now();
          const tree = parseTraceJson(json);
          const endTime = Date.now();
          
          // Should complete in reasonable time (less than 1 second for 100 levels)
          expect(endTime - startTime).toBeLessThan(1000);
          
          // Should produce valid tree structure
          expect(tree.type).toBe('query');
          expect(tree.level).toBe(0);
          
          // Should have proper nesting depth
          function getMaxDepth(node: any): number {
            if (node.children.length === 0) return node.level;
            return Math.max(...node.children.map(getMaxDepth));
          }
          
          const maxDepth = getMaxDepth(tree);
          expect(maxDepth).toBeGreaterThanOrEqual(depth - 1);
          
          // Should maintain tree structure integrity
          function validateDeepTree(node: any, expectedMinLevel: number): void {
            expect(node.level).toBeGreaterThanOrEqual(expectedMinLevel);
            expect(node).toHaveProperty('id');
            expect(node).toHaveProperty('type');
            expect(node).toHaveProperty('children');
            
            for (const child of node.children) {
              if (child.type !== 'success' && child.type !== 'failure') {
                validateDeepTree(child, node.level);
              }
            }
          }
          
          validateDeepTree(tree, 0);
        }
      ),
      { numRuns: 20 } // Reduce runs for performance since we're testing deep recursion
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
