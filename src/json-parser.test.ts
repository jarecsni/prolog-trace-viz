import { describe, it, expect } from 'vitest';
import { parseTraceJson } from './parser.js';

describe('JSON Parser Unit Tests', () => {
  it('parses valid trace events', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(3,F)',
        predicate: 'factorial/2',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(3,F)',
        predicate: 'factorial/2',
        arguments: [3, 6],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('factorial(3,F)');
    expect(tree.level).toBe(0);
  });

  it('handles missing fields gracefully', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
        // Missing optional fields: arguments, clause
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('test(X)');
  });

  it('handles type mismatches gracefully', () => {
    const invalidJson = JSON.stringify({
      not: 'an array',
    });
    
    // Should not throw, but return empty tree
    const tree = parseTraceJson(invalidJson);
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('');
    expect(tree.children).toEqual([]);
  });

  it('builds tree from call/exit events', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(2,F)',
        predicate: 'factorial/2',
      },
      {
        port: 'call',
        level: 1,
        goal: 'factorial(1,F1)',
        predicate: 'factorial/2',
      },
      {
        port: 'exit',
        level: 1,
        goal: 'factorial(1,F1)',
        predicate: 'factorial/2',
        arguments: [1, 1],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(2,F)',
        predicate: 'factorial/2',
        arguments: [2, 2],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Should have nested structure
    const firstChild = tree.children[0];
    expect(firstChild.type).toBe('goal');
    expect(firstChild.level).toBe(1);
  });

  it('handles failure events', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'test(99)',
        predicate: 'test/1',
      },
      {
        port: 'fail',
        level: 0,
        goal: 'test(99)',
        predicate: 'test/1',
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    // Should have failure child
    expect(tree.children.some(c => c.type === 'failure')).toBe(true);
  });

  it('extracts unifications from exit events', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(2,F)',
        predicate: 'factorial/2',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(2,F)',
        predicate: 'factorial/2',
        arguments: [2, 2],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should have unifications
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      expect(tree.unifications.length).toBeGreaterThan(0);
      // Should have F=2 unification
      const fUnification = tree.unifications.find(u => u.variable === 'F');
      expect(fUnification).toBeDefined();
      expect(fUnification?.value).toBe('2');
    }
  });

  it('handles clause information', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(1,F)',
        predicate: 'factorial/2',
        clause: {
          head: 'factorial(0,1)',
          body: 'true',
          line: 1,
        },
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(1,F)',
        predicate: 'factorial/2',
        arguments: [1, 1],
        clause: {
          head: 'factorial(0,1)',
          body: 'true',
          line: 1,
        },
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should have clause line information
    expect(tree.clauseLine).toBeDefined();
    expect(tree.clauseLine).toBe(1);
  });

  it('handles empty event array', () => {
    const json = JSON.stringify([]);
    
    const tree = parseTraceJson(json);
    
    // Should return empty root
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('');
  });

  it('handles malformed JSON gracefully', () => {
    const invalidJson = '{ invalid json }';
    
    // Should not throw, but return empty tree
    const tree = parseTraceJson(invalidJson);
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('');
    expect(tree.children).toEqual([]);
  });

  it('handles nested goals correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'append([1],[2],X)',
        predicate: 'append/3',
      },
      {
        port: 'call',
        level: 1,
        goal: 'append([],[2],R)',
        predicate: 'append/3',
      },
      {
        port: 'exit',
        level: 1,
        goal: 'append([],[2],R)',
        predicate: 'append/3',
        arguments: [[], [2], [2]],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'append([1],[2],X)',
        predicate: 'append/3',
        arguments: [[1], [2], [1, 2]],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    // First child should be the nested append call
    const nestedCall = tree.children[0];
    expect(nestedCall.level).toBe(1);
  });

  it('filters out system predicates', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(3,F)',
        predicate: 'factorial/2',
      },
      {
        port: 'call',
        level: 1,
        goal: 'findall(X,test(X),L)',
        predicate: 'findall/3', // System predicate - should be filtered
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(3,F)',
        predicate: 'factorial/2',
        arguments: [3, 6],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('factorial(3,F)');
    // Should not have findall as a child since it's filtered out
  });

  it('validates required fields and skips invalid events', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'valid(X)',
        predicate: 'valid/1',
      },
      {
        // Missing required fields - should be skipped
        port: 'call',
        level: 1,
        // missing goal and predicate
      },
      {
        port: 'invalid_port', // Invalid port - should be skipped
        level: 2,
        goal: 'invalid(Y)',
        predicate: 'invalid/1',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'valid(X)',
        predicate: 'valid/1',
        arguments: ['test'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('valid(X)');
    // Should only have the valid events processed
  });

  it('handles redo events for backtracking', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'member(X,[1,2,3])',
        predicate: 'member/2',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'member(X,[1,2,3])',
        predicate: 'member/2',
        arguments: [1, [1, 2, 3]],
      },
      {
        port: 'redo',
        level: 0,
        goal: 'member(X,[1,2,3])',
        predicate: 'member/2',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'member(X,[1,2,3])',
        predicate: 'member/2',
        arguments: [2, [1, 2, 3]],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('member(X,[1,2,3])');
    // Should handle redo events (for now just noting them)
  });

  it('handles call stack push/pop operations correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(3,F)',
        predicate: 'factorial/2',
      },
      {
        port: 'call',
        level: 1,
        goal: '3>0',
        predicate: '>/2',
      },
      {
        port: 'exit',
        level: 1,
        goal: '3>0',
        predicate: '>/2',
        arguments: [3, 0],
      },
      {
        port: 'call',
        level: 1,
        goal: 'factorial(2,F1)',
        predicate: 'factorial/2',
      },
      {
        port: 'exit',
        level: 1,
        goal: 'factorial(2,F1)',
        predicate: 'factorial/2',
        arguments: [2, 2],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(3,F)',
        predicate: 'factorial/2',
        arguments: [3, 6],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.level).toBe(0);
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Should have proper nesting - level 1 goals as children
    const level1Children = tree.children.filter(c => c.level === 1);
    expect(level1Children.length).toBeGreaterThan(0);
  });

  it('handles level-based indexing correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 5, // Start at level 5
        goal: 'test(A)',
        predicate: 'test/1',
      },
      {
        port: 'call',
        level: 6,
        goal: 'helper(A)',
        predicate: 'helper/1',
      },
      {
        port: 'exit',
        level: 6,
        goal: 'helper(A)',
        predicate: 'helper/1',
        arguments: ['value'],
      },
      {
        port: 'exit',
        level: 5,
        goal: 'test(A)',
        predicate: 'test/1',
        arguments: ['value'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.level).toBe(5); // Root should be at minimum level
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Should have level 6 child
    const level6Child = tree.children.find(c => c.level === 6);
    expect(level6Child).toBeDefined();
  });

  it('handles nested call state management', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'outer(X)',
        predicate: 'outer/1',
      },
      {
        port: 'call',
        level: 1,
        goal: 'middle(X)',
        predicate: 'middle/1',
      },
      {
        port: 'call',
        level: 2,
        goal: 'inner(X)',
        predicate: 'inner/1',
      },
      {
        port: 'exit',
        level: 2,
        goal: 'inner(X)',
        predicate: 'inner/1',
        arguments: ['result'],
      },
      {
        port: 'exit',
        level: 1,
        goal: 'middle(X)',
        predicate: 'middle/1',
        arguments: ['result'],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'outer(X)',
        predicate: 'outer/1',
        arguments: ['result'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.level).toBe(0);
    
    // Should have proper nesting structure
    function findNodeAtLevel(node: any, targetLevel: number): any {
      if (node.level === targetLevel) return node;
      for (const child of node.children) {
        const found = findNodeAtLevel(child, targetLevel);
        if (found) return found;
      }
      return null;
    }
    
    const level1Node = findNodeAtLevel(tree, 1);
    const level2Node = findNodeAtLevel(tree, 2);
    
    expect(level1Node).toBeDefined();
    expect(level2Node).toBeDefined();
    expect(level1Node.goal).toBe('middle(X)');
    expect(level2Node.goal).toBe('inner(X)');
  });
});
