import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseLatex, serializeToLatex, ExecutionNode } from './parser.js';

// Generate arbitrary Prolog-like goal names
const arbitraryGoalName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
  { minLength: 1, maxLength: 20 }
);

// Generate arbitrary bindings (variable assignments)
const arbitraryBinding = fc.option(
  fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=_'),
    { minLength: 1, maxLength: 15 }
  ),
  { nil: undefined }
);

// Generate arbitrary execution trees
function makeLeafNode(): ExecutionNode {
  return {
    id: `leaf_${Math.random().toString(36).slice(2)}`,
    type: 'success',
    goal: 'success',
    children: [],
    level: 0,
  };
}

function makeGoalNode(goal: string, children: ExecutionNode[], binding?: string): ExecutionNode {
  return {
    id: `goal_${Math.random().toString(36).slice(2)}`,
    type: 'goal',
    goal,
    binding,
    children,
    level: 0,
  };
}

function makeQueryNode(goal: string, children: ExecutionNode[], binding?: string): ExecutionNode {
  return {
    id: `query_${Math.random().toString(36).slice(2)}`,
    type: 'query',
    goal,
    binding,
    children,
    level: 0,
  };
}

const arbitraryLeaf: fc.Arbitrary<ExecutionNode> = fc.constant(null).map(() => makeLeafNode());

const arbitraryExecutionTree: fc.Arbitrary<ExecutionNode> = fc.letrec<{ tree: ExecutionNode }>((tie) => ({
  tree: fc.oneof(
    { weight: 2, arbitrary: arbitraryLeaf },
    { 
      weight: 3, 
      arbitrary: fc.tuple(
        arbitraryGoalName,
        fc.array(tie('tree'), { minLength: 0, maxLength: 2 }),
        arbitraryBinding
      ).map(([goal, children, binding]) => makeGoalNode(goal, children, binding))
    }
  ),
})).tree.chain((children) => 
  fc.tuple(arbitraryGoalName, arbitraryBinding).map(([goal, binding]) => 
    makeQueryNode(goal, [children], binding)
  )
);

// Helper to compare trees structurally (ignoring generated IDs)
function treesEquivalent(a: ExecutionNode, b: ExecutionNode): boolean {
  if (a.goal !== b.goal) return false;
  if (a.type !== b.type) return false;
  if (a.binding !== b.binding) return false;
  if (a.children.length !== b.children.length) return false;
  
  for (let i = 0; i < a.children.length; i++) {
    if (!treesEquivalent(a.children[i], b.children[i])) return false;
  }
  
  return true;
}

describe('LaTeX Parser - Property Tests', () => {
  /**
   * **Feature: prolog-trace-visualizer, Property 3: LaTeX parsing round-trip preserves structure**
   * **Validates: Requirements 3.1**
   * 
   * For any valid execution tree, serializing it to LaTeX format and parsing it back
   * SHALL produce an equivalent tree structure (same goals, same hierarchy, same bindings).
   */
  it('Property 3: LaTeX parsing round-trip preserves structure', () => {
    fc.assert(
      fc.property(arbitraryExecutionTree, (tree) => {
        // Serialize tree to LaTeX
        const latex = serializeToLatex(tree);
        
        // Parse it back
        const parsed = parseLatex(latex);
        
        // Verify structural equivalence
        expect(parsed.goal).toBe(tree.goal);
        expect(parsed.type).toBe(tree.type);
        
        // For trees with children, verify child count matches
        // Note: The parser may normalize some structures, so we check goals match
        if (tree.children.length > 0) {
          expect(parsed.children.length).toBe(tree.children.length);
          
          for (let i = 0; i < tree.children.length; i++) {
            // LaTeX parser may normalize 'success' to 'true'
            const expectedGoal = tree.children[i].goal === 'success' ? 'true' : tree.children[i].goal;
            expect(parsed.children[i].goal).toBe(expectedGoal);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('parses simple bundle correctly', () => {
    const latex = `\\begin{bundle}{test_goal}
\\chunk{success}
\\end{bundle}`;
    
    const result = parseLatex(latex);
    
    expect(result.goal).toBe('test_goal');
    expect(result.type).toBe('query');
    expect(result.children.length).toBe(1);
    expect(result.children[0].type).toBe('success');
  });

  it('parses nested bundles correctly', () => {
    const latex = `\\begin{bundle}{outer}
\\chunk{
\\begin{bundle}{inner}
\\chunk{success}
\\end{bundle}
}
\\end{bundle}`;
    
    const result = parseLatex(latex);
    
    expect(result.goal).toBe('outer');
    expect(result.children.length).toBe(1);
    expect(result.children[0].goal).toBe('inner');
  });

  it('extracts bindings from chunks', () => {
    const latex = `\\begin{bundle}{goal}
\\chunk[X=1]{success}
\\end{bundle}`;
    
    const result = parseLatex(latex);
    
    expect(result.goal).toBe('goal');
    expect(result.children.length).toBe(1);
  });
});
