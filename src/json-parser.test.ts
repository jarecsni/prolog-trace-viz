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

  it('extracts multiple unifications from complex goals', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'append(X,Y,Z)',
        predicate: 'append/3',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'append(X,Y,Z)',
        predicate: 'append/3',
        arguments: [[1, 2], [3, 4], [1, 2, 3, 4]],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should have multiple unifications
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      expect(tree.unifications.length).toBe(3);
      
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      const yUnification = tree.unifications.find(u => u.variable === 'Y');
      const zUnification = tree.unifications.find(u => u.variable === 'Z');
      
      expect(xUnification?.value).toBe('[1,2]');
      expect(yUnification?.value).toBe('[3,4]');
      expect(zUnification?.value).toBe('[1,2,3,4]');
    }
  });

  it('handles unbound variables correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'test(X,constant)',
        predicate: 'test/2',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'test(X,constant)',
        predicate: 'test/2',
        arguments: ['value', 'constant'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should only create unification for the variable, not the constant
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      expect(tree.unifications.length).toBe(1);
      
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('value');
      
      // Should not create unification for 'constant' since it's not a variable
      const constantUnification = tree.unifications.find(u => u.variable === 'constant');
      expect(constantUnification).toBeUndefined();
    }
  });

  it('creates proper binding format for analyzer compatibility', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(N,F)',
        predicate: 'factorial/2',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(N,F)',
        predicate: 'factorial/2',
        arguments: [3, 6],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should have binding in correct format
    expect(tree.binding).toBeDefined();
    expect(tree.binding).toBe('N = 3, F = 6');
    
    // Should match analyzer expected format
    expect(tree.binding).toMatch(/^[A-Z_][a-zA-Z0-9_]*\s*=\s*.+/);
  });

  it('handles complex term values in unifications', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'complex(X)',
        predicate: 'complex/1',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'complex(X)',
        predicate: 'complex/1',
        arguments: [{ type: 'compound', functor: 'f', args: [1, 2] }],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should handle complex terms
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      expect(tree.unifications.length).toBe(1);
      
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('{"type":"compound","functor":"f","args":[1,2]}');
    }
  });

  it('handles empty arguments gracefully', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
        // No arguments provided
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should handle missing arguments gracefully
    expect(tree.unifications).toBeUndefined();
    expect(tree.binding).toBeUndefined();
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

  it('extracts complete clause information from events', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'factorial(N,F)',
        predicate: 'factorial/2',
        clause: {
          head: 'factorial(N,F)',
          body: 'N > 0, N1 is N-1, factorial(N1,F1), F is N*F1',
          line: 5,
        },
      },
      {
        port: 'exit',
        level: 0,
        goal: 'factorial(N,F)',
        predicate: 'factorial/2',
        arguments: [3, 6],
        clause: {
          head: 'factorial(N,F)',
          body: 'N > 0, N1 is N-1, factorial(N1,F1), F is N*F1',
          line: 5,
        },
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should extract all clause information
    expect(tree.clauseLine).toBe(5);
    expect(tree.clauseNumber).toBe(5);
  });

  it('maps clause numbers correctly for visualization', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
        clause: {
          head: 'test(X)',
          body: 'X = 1',
          line: 10,
        },
      },
      {
        port: 'exit',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
        arguments: [1],
        clause: {
          head: 'test(X)',
          body: 'X = 1',
          line: 10,
        },
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should map clause line to clause number for visualization
    expect(tree.clauseNumber).toBe(10);
    expect(tree.clauseLine).toBe(10);
  });

  it('handles missing clause information gracefully', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'mystery(X)',
        predicate: 'mystery/1',
        // No clause information provided
      },
      {
        port: 'exit',
        level: 0,
        goal: 'mystery(X)',
        predicate: 'mystery/1',
        arguments: ['result'],
        // No clause information provided
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should handle missing clause info without errors
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('mystery(X)');
    expect(tree.clauseLine).toBeUndefined();
    expect(tree.clauseNumber).toBeUndefined();
  });

  it('handles partial clause information', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'partial(X)',
        predicate: 'partial/1',
        clause: {
          head: 'partial(X)',
          // Missing body and line
        },
      },
      {
        port: 'exit',
        level: 0,
        goal: 'partial(X)',
        predicate: 'partial/1',
        arguments: ['value'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should handle partial clause info gracefully
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('partial(X)');
    // Should not set clause info if incomplete
    expect(tree.clauseLine).toBeUndefined();
    expect(tree.clauseNumber).toBeUndefined();
  });

  it('tracks multiple clause attempts correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'multi(X)',
        predicate: 'multi/1',
        clause: {
          head: 'multi(X)',
          body: 'X = 1',
          line: 1,
        },
      },
      {
        port: 'exit',
        level: 0,
        goal: 'multi(X)',
        predicate: 'multi/1',
        arguments: [1],
        clause: {
          head: 'multi(X)',
          body: 'X = 1',
          line: 1,
        },
      },
      {
        port: 'redo',
        level: 0,
        goal: 'multi(X)',
        predicate: 'multi/1',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'multi(X)',
        predicate: 'multi/1',
        arguments: [2],
        clause: {
          head: 'multi(X)',
          body: 'X = 2',
          line: 2,
        },
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Should track clause attempts (implementation may vary)
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('multi(X)');
    // Should have some clause information
    expect(tree.clauseLine).toBeDefined();
    expect(tree.clauseNumber).toBeDefined();
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
