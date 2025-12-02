import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  generateMermaid, 
  formatNode, 
  formatEdge, 
  getCircledNumber,
  generateNodeStyle,
  hasRequiredNodeTypes,
  validateStepNumbers,
} from './mermaid.js';
import { analyzeTree } from './analyzer.js';
import { ExecutionNode } from './parser.js';

// Helper to create execution nodes
function makeNode(
  type: ExecutionNode['type'],
  goal: string,
  children: ExecutionNode[] = [],
  binding?: string
): ExecutionNode {
  return {
    id: `node_${Math.random().toString(36).slice(2)}`,
    type,
    goal,
    children,
    binding,
    level: 0,
  };
}

// Arbitrary goal names
const arbitraryGoalName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
  { minLength: 1, maxLength: 15 }
);

describe('Mermaid Generator - Property Tests', () => {
  /**
   * **Feature: prolog-trace-visualizer, Property 10: Diagram contains all required node types**
   * **Validates: Requirements 5.1**
   * 
   * For any non-trivial execution tree, the generated Mermaid diagram SHALL contain
   * at least one query node, and for successful executions SHALL contain a success node.
   */
  it('Property 10: Diagram contains all required node types', () => {
    fc.assert(
      fc.property(
        arbitraryGoalName,
        (goalName) => {
          // Create a successful execution tree
          const successNode = makeNode('success', 'success');
          const goalNode = makeNode('goal', goalName, [successNode]);
          const root = makeNode('query', 'test_query', [goalNode]);
          root.type = 'query';
          
          const analysis = analyzeTree(root);
          const result = hasRequiredNodeTypes(analysis);
          
          expect(result.hasQuery).toBe(true);
          expect(result.hasSuccess).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 11: Diagram styling matches node semantics**
   * **Validates: Requirements 5.2, 5.3, 5.7**
   * 
   * For any generated Mermaid diagram, query nodes SHALL have blue styling,
   * solving nodes SHALL have yellow styling, pending nodes SHALL have gray styling,
   * and solved/success nodes SHALL have green styling.
   */
  it('Property 11: Diagram styling matches node semantics', () => {
    const nodeTypes = ['query', 'solving', 'pending', 'solved', 'success'] as const;
    const expectedColors: Record<string, string> = {
      query: '#4A90D9',
      solving: '#F5A623',
      pending: '#9B9B9B',
      solved: '#7ED321',
      success: '#7ED321',
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...nodeTypes),
        arbitraryGoalName,
        (nodeType, goal) => {
          const node = {
            id: 'test_node',
            type: nodeType,
            label: goal,
            emoji: '🎯',
            level: 0,
          };
          
          const style = generateNodeStyle(node);
          
          expect(style).toContain(expectedColors[nodeType]);
          expect(style).toContain('test_node');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 12: Step numbers are sequential and use circled format**
   * **Validates: Requirements 5.4**
   * 
   * For any generated Mermaid diagram with N edges, the step numbers SHALL be
   * the sequence ①②③...ⓝ with no gaps or duplicates.
   */
  it('Property 12: Step numbers are sequential and use circled format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (n) => {
          const circled = getCircledNumber(n);
          
          // Should be a single character (circled number) for 1-20
          expect(circled.length).toBe(1);
          
          // Should not be a plain number
          expect(circled).not.toBe(String(n));
        }
      ),
      { numRuns: 20 }
    );

    // Test sequential validation
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 10 }),
        (stepNumbers) => {
          // Create edges with these step numbers
          const edges = stepNumbers.map((n, i) => ({
            id: `edge_${i}`,
            from: 'a',
            to: 'b',
            type: 'active' as const,
            label: '',
            stepNumber: n,
          }));
          
          // Sort and check if sequential starting from 1
          const sorted = [...stepNumbers].sort((a, b) => a - b);
          const isSequential = sorted.every((n, i) => n === i + 1);
          
          expect(validateStepNumbers(edges)).toBe(isSequential);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 13: Arrow labels contain clause and binding information**
   * **Validates: Requirements 5.6**
   * 
   * For any edge in the generated diagram that represents a clause match,
   * the edge label SHALL contain the clause identifier and any variable bindings.
   */
  it('Property 13: Arrow labels contain clause and binding information', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.stringOf(fc.constantFrom(...'ABCXYZ=0123456789'), { minLength: 1, maxLength: 10 }),
        (stepNumber, binding) => {
          const edge = {
            id: 'test_edge',
            from: 'node_a',
            to: 'node_b',
            type: 'active' as const,
            label: binding,
            stepNumber,
          };
          
          const formatted = formatEdge(edge);
          
          // Should contain the step number (circled)
          expect(formatted).toContain(getCircledNumber(stepNumber));
          
          // Should contain the binding info
          expect(formatted).toContain(binding);
          
          // Should have proper arrow syntax
          expect(formatted).toContain('-->');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates valid Mermaid syntax', () => {
    fc.assert(
      fc.property(
        arbitraryGoalName,
        (goalName) => {
          const successNode = makeNode('success', 'success');
          const goalNode = makeNode('goal', goalName, [successNode]);
          const root = makeNode('query', 'test_query', [goalNode]);
          root.type = 'query';
          
          const analysis = analyzeTree(root);
          const mermaid = generateMermaid(analysis);
          
          // Should start with flowchart directive
          expect(mermaid).toContain('flowchart TD');
          
          // Should have nodes section
          expect(mermaid).toContain('%% Nodes');
          
          // Should have edges section
          expect(mermaid).toContain('%% Edges');
          
          // Should have styles section
          expect(mermaid).toContain('%% Styles');
        }
      ),
      { numRuns: 100 }
    );
  });
});
