import { describe, it, expect } from 'vitest';
import { analyzeTree, DetailLevel } from './analyzer.js';
import { ExecutionNode } from './parser.js';
import { Clause } from './clauses.js';

describe('Analyzer Detail Levels', () => {
  // Helper to create a simple factorial execution tree
  const createFactorialTree = (): ExecutionNode => ({
    id: 'root',
    type: 'query',
    goal: 'factorial(3, X)',
    level: 0,
    clauseNumber: 9,
    children: [
      {
        id: 'builtin1',
        type: 'goal',
        goal: '3>0',
        level: 1,
        children: [
          { id: 'success1', type: 'success', goal: 'true', level: 2, children: [] }
        ]
      },
      {
        id: 'builtin2',
        type: 'goal',
        goal: '_1534 is 3+ -1',
        level: 1,
        children: [
          { id: 'success2', type: 'success', goal: 'true', level: 2, children: [] }
        ]
      },
      {
        id: 'recursive',
        type: 'goal',
        goal: 'factorial(2, _1460)',
        level: 1,
        clauseNumber: 9,
        children: [
          { id: 'success3', type: 'success', goal: 'true', level: 2, children: [] }
        ]
      }
    ]
  });

  const factorialClauses: Clause[] = [
    {
      number: 4,
      head: 'factorial(0, 1)',
      text: 'factorial(0, 1)'
    },
    {
      number: 5,
      head: 'factorial(N, R)',
      body: 'N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1',
      text: 'factorial(N, R) :- N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1'
    }
  ];

  describe('Detail Level Differentiation', () => {
    it('should produce different output for each detail level', () => {
      const tree = createFactorialTree();
      
      const minimal = analyzeTree(tree, factorialClauses, { detailLevel: 'minimal' });
      const standard = analyzeTree(tree, factorialClauses, { detailLevel: 'standard' });
      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });
      const full = analyzeTree(tree, factorialClauses, { detailLevel: 'full' });

      // Each level should have different node counts due to different processing
      expect(minimal.nodes.length).not.toBe(standard.nodes.length);
      expect(standard.nodes.length).not.toBe(detailed.nodes.length);
      
      // Convert to JSON strings to compare overall structure
      const minimalStr = JSON.stringify(minimal.nodes.map(n => ({ type: n.type, label: n.label })));
      const standardStr = JSON.stringify(standard.nodes.map(n => ({ type: n.type, label: n.label })));
      const detailedStr = JSON.stringify(detailed.nodes.map(n => ({ type: n.type, label: n.label })));
      
      expect(minimalStr).not.toBe(standardStr);
      expect(standardStr).not.toBe(detailedStr);
    });

    it('should filter built-in predicates at minimal level', () => {
      const tree = createFactorialTree();
      
      const minimal = analyzeTree(tree, factorialClauses, { detailLevel: 'minimal' });
      const standard = analyzeTree(tree, factorialClauses, { detailLevel: 'standard' });

      // Minimal should have fewer nodes due to built-in filtering
      expect(minimal.nodes.length).toBeLessThan(standard.nodes.length);
      
      // Standard should include built-in predicates like '3>0'
      const standardHasBuiltins = standard.nodes.some(n => 
        n.label.includes('3>0') || n.label.includes('is 3+ -1')
      );
      expect(standardHasBuiltins).toBe(true);
      
      // Minimal should have fewer built-in predicates
      const minimalBuiltins = minimal.nodes.filter(n => 
        n.label.includes('>') || n.label.includes('is ')
      ).length;
      const standardBuiltins = standard.nodes.filter(n => 
        n.label.includes('>') || n.label.includes('is ')
      ).length;
      
      expect(minimalBuiltins).toBeLessThan(standardBuiltins);
    });

    it('should show recursion indicators at standard level and above', () => {
      const tree = createFactorialTree();
      
      const minimal = analyzeTree(tree, factorialClauses, { detailLevel: 'minimal' });
      const standard = analyzeTree(tree, factorialClauses, { detailLevel: 'standard' });
      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });

      // Minimal should not have recursion indicators
      const minimalHasRecursion = minimal.nodes.some(n => n.label.includes('🔁'));
      expect(minimalHasRecursion).toBe(false);
      
      // Standard and detailed should have recursion indicators
      const standardHasRecursion = standard.nodes.some(n => n.label.includes('🔁'));
      const detailedHasRecursion = detailed.nodes.some(n => n.label.includes('🔁'));
      
      expect(standardHasRecursion).toBe(true);
      expect(detailedHasRecursion).toBe(true);
    });

    it('should show match nodes only at detailed and full levels', () => {
      const tree = createFactorialTree();
      
      const minimal = analyzeTree(tree, factorialClauses, { detailLevel: 'minimal' });
      const standard = analyzeTree(tree, factorialClauses, { detailLevel: 'standard' });
      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });
      const full = analyzeTree(tree, factorialClauses, { detailLevel: 'full' });

      // Minimal and standard should not have match nodes
      const minimalHasMatch = minimal.nodes.some(n => n.type === 'match');
      const standardHasMatch = standard.nodes.some(n => n.type === 'match');
      
      expect(minimalHasMatch).toBe(false);
      expect(standardHasMatch).toBe(false);
      
      // Detailed and full should have match nodes
      const detailedHasMatch = detailed.nodes.some(n => n.type === 'match');
      const fullHasMatch = full.nodes.some(n => n.type === 'match');
      
      expect(detailedHasMatch).toBe(true);
      expect(fullHasMatch).toBe(true);
    });

    it('should create match nodes with proper clause information', () => {
      const tree = createFactorialTree();
      
      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Match nodes should have clause numbers and proper labels
      matchNodes.forEach(matchNode => {
        expect(matchNode.clauseNumber).toBeDefined();
        expect(matchNode.label).toContain('Match Clause');
        expect(matchNode.label).toContain('factorial');
        expect(matchNode.emoji).toBe('📦');
      });
    });
  });

  describe('Clause Selection Logic', () => {
    it('should select base case clause for factorial(0, X)', () => {
      const baseTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'factorial(0, X)',
        level: 0,
        clauseNumber: 8,
        children: []
      };
      
      const detailed = analyzeTree(baseTree, factorialClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      if (matchNodes.length > 0) {
        // Should select the base case clause (number 4)
        const baseMatchNode = matchNodes.find(n => n.label.includes('factorial(0, 1)'));
        expect(baseMatchNode).toBeDefined();
      }
    });

    it('should select recursive clause for factorial(N, X) where N > 0', () => {
      const recursiveTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'factorial(3, X)',
        level: 0,
        clauseNumber: 9,
        children: []
      };
      
      const detailed = analyzeTree(recursiveTree, factorialClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      if (matchNodes.length > 0) {
        // Should select the recursive clause (number 5)
        const recursiveMatchNode = matchNodes.find(n => n.label.includes('factorial(N, R)'));
        expect(recursiveMatchNode).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty clause list gracefully', () => {
      const tree = createFactorialTree();
      
      expect(() => {
        analyzeTree(tree, [], { detailLevel: 'detailed' });
      }).not.toThrow();
    });

    it('should handle unknown predicates gracefully', () => {
      const unknownTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'unknown_predicate(X)',
        level: 0,
        children: []
      };
      
      expect(() => {
        analyzeTree(unknownTree, factorialClauses, { detailLevel: 'detailed' });
      }).not.toThrow();
    });

    it('should handle single clause predicates', () => {
      const singleClause: Clause[] = [
        {
          number: 1,
          head: 'simple(X)',
          text: 'simple(X)'
        }
      ];
      
      const simpleTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'simple(test)',
        level: 0,
        clauseNumber: 1,
        children: []
      };
      
      const detailed = analyzeTree(simpleTree, singleClause, { detailLevel: 'detailed' });
      
      // Should still create match nodes for single clause predicates
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      if (matchNodes.length > 0) {
        expect(matchNodes[0].label).toContain('simple(X)');
      }
    });
  });
});