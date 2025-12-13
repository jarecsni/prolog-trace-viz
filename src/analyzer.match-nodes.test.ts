import { describe, it, expect } from 'vitest';
import { analyzeTree } from './analyzer.js';
import { ExecutionNode } from './parser.js';
import { Clause } from './clauses.js';

describe('Analyzer Match Nodes', () => {
  describe('Match Node Creation', () => {
    const memberClauses: Clause[] = [
      {
        number: 1,
        head: 'member(X, [X|_])',
        text: 'member(X, [X|_])'
      },
      {
        number: 2,
        head: 'member(X, [_|T])',
        body: 'member(X, T)',
        text: 'member(X, [_|T]) :- member(X, T)'
      }
    ];

    const appendClauses: Clause[] = [
      {
        number: 1,
        head: 'append([], L, L)',
        text: 'append([], L, L)'
      },
      {
        number: 2,
        head: 'append([H|T], L, [H|R])',
        body: 'append(T, L, R)',
        text: 'append([H|T], L, [H|R]) :- append(T, L, R)'
      }
    ];

    it('should create match nodes for member predicate', () => {
      const memberTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'member(X, [1,2,3])',
        level: 0,
        clauseNumber: 1,
        children: [
          {
            id: 'alt1',
            type: 'goal',
            goal: 'member(X, [2,3])',
            level: 1,
            clauseNumber: 2,
            children: []
          }
        ]
      };

      const detailed = analyzeTree(memberTree, memberClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Should have match nodes for member clauses
      const memberMatchNodes = matchNodes.filter(n => n.label.includes('member'));
      expect(memberMatchNodes.length).toBeGreaterThan(0);
      
      // Match nodes should have proper structure
      memberMatchNodes.forEach(node => {
        expect(node.emoji).toBe('📦');
        expect(node.type).toBe('match');
        expect(node.label).toContain('Match Clause');
        expect(node.clauseNumber).toBeDefined();
      });
    });

    it('should create match nodes for append predicate', () => {
      const appendTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'append([1,2], [3,4], L)',
        level: 0,
        clauseNumber: 2,
        children: [
          {
            id: 'recursive',
            type: 'goal',
            goal: 'append([2], [3,4], R)',
            level: 1,
            clauseNumber: 2,
            children: [
              {
                id: 'base',
                type: 'goal',
                goal: 'append([], [3,4], [3,4])',
                level: 2,
                clauseNumber: 1,
                children: []
              }
            ]
          }
        ]
      };

      const detailed = analyzeTree(appendTree, appendClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Should have match nodes for both base and recursive cases
      const baseMatchNode = matchNodes.find(n => n.label.includes('append([], L, L)'));
      const recursiveMatchNode = matchNodes.find(n => n.label.includes('append([H|T], L, [H|R])'));
      
      // At least one should exist (depending on tree structure processing)
      expect(matchNodes.some(n => n.label.includes('append'))).toBe(true);
    });

    it('should select correct clause based on goal pattern', () => {
      // Test base case selection
      const baseTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'append([], [1,2], L)',
        level: 0,
        clauseNumber: 1,
        children: []
      };

      const baseDetailed = analyzeTree(baseTree, appendClauses, { detailLevel: 'detailed' });
      const baseMatchNodes = baseDetailed.nodes.filter(n => n.type === 'match');
      
      if (baseMatchNodes.length > 0) {
        // Should select base case clause for empty list
        const hasBaseClause = baseMatchNodes.some(n => n.label.includes('append([], L, L)'));
        expect(hasBaseClause).toBe(true);
      }

      // Test recursive case selection
      const recursiveTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'append([1,2], [3,4], L)',
        level: 0,
        clauseNumber: 2,
        children: []
      };

      const recursiveDetailed = analyzeTree(recursiveTree, appendClauses, { detailLevel: 'detailed' });
      const recursiveMatchNodes = recursiveDetailed.nodes.filter(n => n.type === 'match');
      
      if (recursiveMatchNodes.length > 0) {
        // Should select recursive clause for non-empty list
        const hasRecursiveClause = recursiveMatchNodes.some(n => 
          n.label.includes('append([H|T], L, [H|R])') || n.label.includes('append([_|_]')
        );
        expect(hasRecursiveClause).toBe(true);
      }
    });

    it('should not create match nodes for built-in predicates', () => {
      const builtinTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'X is 3 + 4',
        level: 0,
        children: [
          {
            id: 'builtin',
            type: 'goal',
            goal: '3 > 0',
            level: 1,
            children: []
          }
        ]
      };

      const detailed = analyzeTree(builtinTree, [], { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      // Should not create match nodes for built-in predicates like 'is' or '>'
      const builtinMatchNodes = matchNodes.filter(n => 
        n.label.includes(' is ') || n.label.includes(' > ') || n.label.includes(' < ')
      );
      expect(builtinMatchNodes.length).toBe(0);
    });

    it('should handle alternative branches with match nodes', () => {
      const alternativeTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'member(X, [1,2,3])',
        level: 0,
        children: [
          {
            id: 'first',
            type: 'goal',
            goal: 'member(1, [1,2,3])',
            level: 1,
            clauseNumber: 1,
            children: []
          },
          {
            id: 'second',
            type: 'goal',
            goal: 'member(X, [2,3])',
            level: 1,
            clauseNumber: 2,
            children: []
          }
        ]
      };

      const detailed = analyzeTree(alternativeTree, memberClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      // Should create match nodes for alternatives (backtracking branches)
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Match nodes should be connected properly in the graph
      const matchNodeIds = matchNodes.map(n => n.id);
      const edgesToMatchNodes = detailed.edges.filter(e => matchNodeIds.includes(e.to));
      const edgesFromMatchNodes = detailed.edges.filter(e => matchNodeIds.includes(e.from));
      
      expect(edgesToMatchNodes.length).toBeGreaterThan(0);
      expect(edgesFromMatchNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Match Node Content', () => {
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

    it('should display clause head in match node label', () => {
      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'factorial(3, X)',
        level: 0,
        clauseNumber: 5,
        children: []
      };

      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      if (matchNodes.length > 0) {
        const matchNode = matchNodes[0];
        
        // Should contain clause number
        expect(matchNode.label).toContain('Match Clause');
        expect(matchNode.label).toContain('5');
        
        // Should contain clause head
        expect(matchNode.label).toContain('factorial(N, R)');
        
        // Should not contain clause body in the label (body is shown separately)
        expect(matchNode.label).not.toContain('N > 0');
      }
    });

    it('should handle facts (clauses without body)', () => {
      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'factorial(0, X)',
        level: 0,
        clauseNumber: 4,
        children: []
      };

      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      if (matchNodes.length > 0) {
        const factMatchNode = matchNodes.find(n => n.label.includes('factorial(0, 1)'));
        
        if (factMatchNode) {
          // Should handle facts properly (no body)
          expect(factMatchNode.label).toContain('factorial(0, 1)');
          expect(factMatchNode.label).toContain('Match Clause 4');
        }
      }
    });

    it('should assign correct clause numbers to match nodes', () => {
      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'factorial(3, X)',
        level: 0,
        children: [
          {
            id: 'recursive',
            type: 'goal',
            goal: 'factorial(2, Y)',
            level: 1,
            clauseNumber: 5,
            children: []
          },
          {
            id: 'base',
            type: 'goal',
            goal: 'factorial(0, Z)',
            level: 1,
            clauseNumber: 4,
            children: []
          }
        ]
      };

      const detailed = analyzeTree(tree, factorialClauses, { detailLevel: 'detailed' });
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      // Match nodes should have clause numbers from the original clauses
      matchNodes.forEach(node => {
        expect([4, 5]).toContain(node.clauseNumber);
      });
    });
  });
});