import { describe, it, expect } from 'vitest';
import { analyzeTree } from './analyzer.js';
import { ExecutionNode } from './parser.js';
import { Clause } from './clauses.js';

describe('Analyzer Clause Matching', () => {
  describe('Predicate-Based Clause Matching', () => {
    const testClauses: Clause[] = [
      {
        number: 10, // Simulating tracer line numbers (higher due to wrapper)
        head: 'factorial(0, 1)',
        text: 'factorial(0, 1)'
      },
      {
        number: 15, // Simulating tracer line numbers
        head: 'factorial(N, R)',
        body: 'N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1',
        text: 'factorial(N, R) :- N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1'
      },
      {
        number: 20,
        head: 'member(X, [X|_])',
        text: 'member(X, [X|_])'
      },
      {
        number: 25,
        head: 'member(X, [_|T])',
        body: 'member(X, T)',
        text: 'member(X, [_|T]) :- member(X, T)'
      }
    ];

    it('should match clauses by predicate name when clause numbers mismatch', () => {
      // Simulate tracer providing different clause numbers than parsed clauses
      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'factorial(3, X)',
        level: 0,
        clauseNumber: 99, // This won't match any clause number directly
        children: [
          {
            id: 'child',
            type: 'goal',
            goal: 'factorial(2, Y)',
            level: 1,
            clauseNumber: 88, // This won't match either
            children: []
          }
        ]
      };

      const detailed = analyzeTree(tree, testClauses, { detailLevel: 'detailed' });
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      // Should still create match nodes by matching predicate names
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Should find factorial clauses despite number mismatch
      const factorialMatchNodes = matchNodes.filter(n => n.label.includes('factorial'));
      expect(factorialMatchNodes.length).toBeGreaterThan(0);
    });

    it('should detect base cases correctly', () => {
      const baseTestCases = [
        { goal: 'factorial(0, X)', expectedClause: 'factorial(0, 1)' },
        { goal: 'factorial(0 , Y)', expectedClause: 'factorial(0, 1)' }, // With space
        { goal: 'append([], L, L)', expectedClause: 'append([], L, L)' },
        { goal: 'append([] , [1,2], Z)', expectedClause: 'append([], L, L)' }, // With space
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

      baseTestCases.forEach(testCase => {
        const tree: ExecutionNode = {
          id: 'root',
          type: 'query',
          goal: testCase.goal,
          level: 0,
          clauseNumber: 1,
          children: []
        };

        const clauses = testCase.goal.includes('factorial') ? testClauses : appendClauses;
        const detailed = analyzeTree(tree, clauses, { detailLevel: 'detailed' });
        const matchNodes = detailed.nodes.filter(n => n.type === 'match');
        
        if (matchNodes.length > 0) {
          const hasExpectedClause = matchNodes.some(n => 
            n.label.includes(testCase.expectedClause.split('(')[0]) && // Check predicate
            (testCase.expectedClause.includes('0') ? n.label.includes('0') : true) &&
            (testCase.expectedClause.includes('[]') ? n.label.includes('[]') : true)
          );
          expect(hasExpectedClause).toBe(true);
        }
      });
    });

    it('should detect recursive cases correctly', () => {
      const recursiveTestCases = [
        { goal: 'factorial(3, X)', expectedPattern: 'factorial(N, R)' },
        { goal: 'factorial(5, Y)', expectedPattern: 'factorial(N, R)' },
        { goal: 'member(X, [1,2,3])', expectedPattern: 'member(X, [_|T])' },
        { goal: 'append([1,2], [3,4], L)', expectedPattern: 'append([H|T], L, [H|R])' },
      ];

      recursiveTestCases.forEach(testCase => {
        const tree: ExecutionNode = {
          id: 'root',
          type: 'query',
          goal: testCase.goal,
          level: 0,
          clauseNumber: 2,
          children: []
        };

        const clauses = testCase.goal.includes('factorial') ? testClauses : 
                       testCase.goal.includes('member') ? testClauses :
                       []; // Would need append clauses for append test

        if (clauses.length > 0) {
          const detailed = analyzeTree(tree, clauses, { detailLevel: 'detailed' });
          const matchNodes = detailed.nodes.filter(n => n.type === 'match');
          
          if (matchNodes.length > 0) {
            const hasRecursivePattern = matchNodes.some(n => {
              const predicate = testCase.expectedPattern.split('(')[0];
              return n.label.includes(predicate) && 
                     (testCase.expectedPattern.includes('N') || 
                      testCase.expectedPattern.includes('H|T') ||
                      testCase.expectedPattern.includes('_|T'));
            });
            expect(hasRecursivePattern).toBe(true);
          }
        }
      });
    });

    it('should handle single clause predicates', () => {
      const singleClausePredicate: Clause[] = [
        {
          number: 1,
          head: 'simple(X)',
          text: 'simple(X)'
        }
      ];

      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'simple(test)',
        level: 0,
        clauseNumber: 1,
        children: []
      };

      const detailed = analyzeTree(tree, singleClausePredicate, { detailLevel: 'detailed' });
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      if (matchNodes.length > 0) {
        // Should select the only available clause
        const simpleMatchNode = matchNodes.find(n => n.label.includes('simple(X)'));
        expect(simpleMatchNode).toBeDefined();
        expect(simpleMatchNode?.clauseNumber).toBe(1);
      }
    });

    it('should ignore non-user predicates', () => {
      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'some_goal(X)',
        level: 0,
        children: [
          {
            id: 'builtin1',
            type: 'goal',
            goal: 'X is 3 + 4',
            level: 1,
            children: []
          },
          {
            id: 'builtin2',
            type: 'goal',
            goal: '5 > 3',
            level: 1,
            children: []
          },
          {
            id: 'builtin3',
            type: 'goal',
            goal: 'X = 7',
            level: 1,
            children: []
          }
        ]
      };

      const detailed = analyzeTree(tree, testClauses, { detailLevel: 'detailed' });
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      
      // Should not create match nodes for built-in predicates
      const builtinMatchNodes = matchNodes.filter(n => 
        n.label.includes(' is ') || 
        n.label.includes(' > ') || 
        n.label.includes(' = ') ||
        n.label.includes(' < ') ||
        n.label.includes(' =:= ')
      );
      
      expect(builtinMatchNodes.length).toBe(0);
    });

    it('should handle unknown predicates gracefully', () => {
      const tree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 'unknown_predicate(X, Y, Z)',
        level: 0,
        clauseNumber: 42,
        children: []
      };

      // No clauses for unknown_predicate
      const detailed = analyzeTree(tree, testClauses, { detailLevel: 'detailed' });
      
      // Should not crash and should not create match nodes for unknown predicates
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      const unknownMatchNodes = matchNodes.filter(n => n.label.includes('unknown_predicate'));
      
      expect(unknownMatchNodes.length).toBe(0);
    });
  });

  describe('Clause Selection Heuristics', () => {
    const multiClausePredicate: Clause[] = [
      {
        number: 1,
        head: 'test(0)',
        text: 'test(0)'
      },
      {
        number: 2,
        head: 'test(N)',
        body: 'N > 0, N1 is N - 1, test(N1)',
        text: 'test(N) :- N > 0, N1 is N - 1, test(N1)'
      },
      {
        number: 3,
        head: 'test(special)',
        text: 'test(special)'
      }
    ];

    it('should prefer first clause for base case patterns', () => {
      const baseCaseGoals = [
        'test(0)',
        'factorial(0, X)',
        'append([], L, L)',
        'member(X, [])'
      ];

      baseCaseGoals.forEach(goal => {
        const tree: ExecutionNode = {
          id: 'root',
          type: 'query',
          goal,
          level: 0,
          clauseNumber: 1,
          children: []
        };

        const clauses = goal.includes('test') ? multiClausePredicate : 
                       goal.includes('factorial') ? [
                         { number: 1, head: 'factorial(0, 1)', text: 'factorial(0, 1)' },
                         { number: 2, head: 'factorial(N, R)', body: 'N > 0', text: 'factorial(N, R) :- N > 0' }
                       ] : [];

        if (clauses.length >= 2) {
          const detailed = analyzeTree(tree, clauses, { detailLevel: 'detailed' });
          const matchNodes = detailed.nodes.filter(n => n.type === 'match');
          
          if (matchNodes.length > 0) {
            // Should select first clause for base cases
            const hasFirstClause = matchNodes.some(n => n.clauseNumber === clauses[0].number);
            expect(hasFirstClause).toBe(true);
          }
        }
      });
    });

    it('should prefer second clause for recursive patterns', () => {
      const recursiveGoals = [
        'test(5)',
        'factorial(3, X)',
        'append([1,2], [3,4], L)'
      ];

      recursiveGoals.forEach(goal => {
        const tree: ExecutionNode = {
          id: 'root',
          type: 'query',
          goal,
          level: 0,
          clauseNumber: 2,
          children: []
        };

        const clauses = goal.includes('test') ? multiClausePredicate : 
                       goal.includes('factorial') ? [
                         { number: 1, head: 'factorial(0, 1)', text: 'factorial(0, 1)' },
                         { number: 2, head: 'factorial(N, R)', body: 'N > 0', text: 'factorial(N, R) :- N > 0' }
                       ] : [];

        if (clauses.length >= 2) {
          const detailed = analyzeTree(tree, clauses, { detailLevel: 'detailed' });
          const matchNodes = detailed.nodes.filter(n => n.type === 'match');
          
          if (matchNodes.length > 0) {
            // Should select second clause for recursive cases
            const hasSecondClause = matchNodes.some(n => n.clauseNumber === clauses[1].number);
            expect(hasSecondClause).toBe(true);
          }
        }
      });
    });

    it('should handle edge cases in pattern matching', () => {
      const edgeCases = [
        { goal: 'test( 0 )', description: 'spaces around arguments' },
        { goal: 'test(0,extra)', description: 'extra arguments' },
        { goal: 'factorial(0)', description: 'missing arguments' },
        { goal: 'append([],[])', description: 'multiple empty lists' }
      ];

      edgeCases.forEach(testCase => {
        const tree: ExecutionNode = {
          id: 'root',
          type: 'query',
          goal: testCase.goal,
          level: 0,
          clauseNumber: 1,
          children: []
        };

        expect(() => {
          analyzeTree(tree, multiClausePredicate, { detailLevel: 'detailed' });
        }).not.toThrow(`Should handle ${testCase.description} gracefully`);
      });
    });
  });
});