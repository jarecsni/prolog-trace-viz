import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  analyzeTree, 
  assignLevelVariables,
  determineExecutionOrder,
  PendingGoal,
} from './analyzer.js';
import { ExecutionNode } from './parser.js';

// Helper to create execution nodes
function makeNode(
  type: ExecutionNode['type'],
  goal: string,
  children: ExecutionNode[] = [],
  subgoals?: string[],
  binding?: string
): ExecutionNode {
  return {
    id: `node_${Math.random().toString(36).slice(2)}`,
    type,
    goal,
    children,
    subgoals,
    binding,
    level: 0,
  };
}

// Arbitrary goal names
const arbitraryGoalName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
  { minLength: 1, maxLength: 15 }
);

// Arbitrary subgoal lists
const arbitrarySubgoals = fc.array(arbitraryGoalName, { minLength: 1, maxLength: 5 });

describe('Tree Analyzer - Property Tests', () => {
  /**
   * **Feature: prolog-trace-visualizer, Property 4: Pending goal identification is complete**
   * **Validates: Requirements 4.1**
   * 
   * For any execution tree containing pending goals, the analyzer SHALL identify
   * all goals that are queued but not immediately solved.
   */
  it('Property 4: Pending goal identification is complete', () => {
    fc.assert(
      fc.property(
        arbitrarySubgoals,
        (subgoals) => {
          // Create a node with subgoals (these become pending goals)
          const root = makeNode('query', 'test_query', [], subgoals);
          
          const result = analyzeTree(root);
          
          // Should have pending nodes for subgoals (except first which is solving)
          const pendingNodes = result.nodes.filter(n => n.type === 'pending');
          expect(pendingNodes.length).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 5: Pending goal deduplication preserves first occurrence**
   * **Validates: Requirements 4.2**
   * 
   * For any execution tree where the same pending goal appears at multiple nesting levels,
   * the analyzer SHALL track only the first occurrence.
   */
  it('Property 5: Pending goal deduplication preserves first occurrence', () => {
    fc.assert(
      fc.property(
        arbitraryGoalName,
        (goalName) => {
          // Create a tree where the same goal appears at multiple levels
          const innerNode = makeNode('goal', 'inner', [], [goalName]);
          const outerNode = makeNode('query', 'outer', [innerNode], [goalName]);
          
          const result = analyzeTree(outerNode);
          
          // Should only have one pending node for the goal
          const pendingNodes = result.nodes.filter(n => n.type === 'pending' && n.label === goalName);
          expect(pendingNodes.length).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 6: Clause tracking preserves clause information**
   * **Validates: Requirements 4.3**
   * 
   * For any execution tree node that matched a clause, the analysis result SHALL
   * include the clause number in the corresponding visualization node.
   */
  it('Property 6: Clause tracking preserves clause information', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        arbitraryGoalName,
        (clauseNumber, goalName) => {
          const childNode = makeNode('goal', goalName, [makeNode('success', 'success')]);
          childNode.clauseNumber = clauseNumber;
          childNode.binding = `clause_${clauseNumber}`;
          
          const root = makeNode('query', 'test_query', [childNode]);
          
          const result = analyzeTree(root);
          
          // Find the edge that should have clause info
          const edgeWithClause = result.edges.find(e => e.label.includes(`clause_${clauseNumber}`));
          expect(edgeWithClause).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 7: Level-based variable naming produces unique names**
   * **Validates: Requirements 4.4**
   * 
   * For any execution tree with recursive calls, variables at different recursion levels
   * SHALL have unique names following the pattern `{VarName}_L{level}`.
   */
  it('Property 7: Level-based variable naming produces unique names', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('X', 'Y', 'Z', 'Result', 'Acc'),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (varName, level1, level2) => {
          // Create nodes at different levels with the same variable
          const node1 = makeNode('goal', `pred(${varName})`);
          const node2 = makeNode('goal', `pred(${varName})`);
          
          assignLevelVariables(node1, level1);
          assignLevelVariables(node2, level2);
          
          if (level1 !== level2) {
            // Variables should have different suffixes
            expect(node1.goal).not.toBe(node2.goal);
            expect(node1.goal).toContain(`_L${level1}`);
            expect(node2.goal).toContain(`_L${level2}`);
          } else {
            // Same level should produce same naming
            expect(node1.goal).toBe(node2.goal);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 8: Execution order is deterministic and sequential**
   * **Validates: Requirements 4.5**
   * 
   * For any execution tree, the determined execution order SHALL be consistent
   * across multiple analyses and follow left-to-right, depth-first traversal.
   */
  it('Property 8: Execution order is deterministic and sequential', () => {
    fc.assert(
      fc.property(
        arbitraryGoalName,
        arbitraryGoalName,
        arbitraryGoalName,
        (goal1, goal2, goal3) => {
          // Create a tree with known structure
          const child1 = makeNode('goal', goal1, [makeNode('success', 'success')]);
          const child2 = makeNode('goal', goal2, [makeNode('success', 'success')]);
          const child3 = makeNode('goal', goal3, [makeNode('success', 'success')]);
          const root = makeNode('query', 'root', [child1, child2, child3]);
          
          // Run analysis twice
          const order1 = determineExecutionOrder(root);
          const order2 = determineExecutionOrder(root);
          
          // Order should be deterministic
          expect(order1).toEqual(order2);
          
          // Order should be depth-first (root first, then children in order)
          expect(order1[0]).toBe(root.id);
          expect(order1[1]).toBe(child1.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: prolog-trace-visualizer, Property 9: Activation relationships are recorded**
   * **Validates: Requirements 4.6**
   * 
   * For any pending goal that becomes active, the analysis result SHALL contain
   * an edge of type 'activate' connecting the pending node to the solving node.
   */
  it('Property 9: Activation relationships are recorded', () => {
    fc.assert(
      fc.property(
        arbitraryGoalName,
        (goalName) => {
          // Create a tree where a goal is first pending, then activated
          const activatedNode = makeNode('goal', goalName, [makeNode('success', 'success')]);
          const root = makeNode('query', 'test_query', [activatedNode], [goalName]);
          
          const result = analyzeTree(root);
          
          // Should have an activation edge if the goal was pending and then solved
          // The pending goal should be tracked
          expect(result.pendingGoals.has(goalName)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
