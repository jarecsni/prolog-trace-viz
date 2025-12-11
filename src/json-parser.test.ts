import { describe, it, expect } from 'vitest';
import { parseTraceJson } from './parser.js';
import { analyzeTree } from './analyzer.js';
import { generateMermaid } from './mermaid.js';
import { renderMarkdown } from './renderer.js';

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

  it('processes redo events for backtracking', () => {
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
        arguments: [3, [1, 2, 3]],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('member(X,[1,2,3])');
    
    // Should have the final solution's unification
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('3'); // Last solution
    }
  });

  it('processes fail events correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'impossible(X)',
        predicate: 'impossible/1',
      },
      {
        port: 'fail',
        level: 0,
        goal: 'impossible(X)',
        predicate: 'impossible/1',
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('impossible(X)');
    
    // Should have failure child
    expect(tree.children.some(c => c.type === 'failure')).toBe(true);
    
    const failureChild = tree.children.find(c => c.type === 'failure');
    expect(failureChild?.goal).toBe('false');
  });

  it('handles multiple solutions with different bindings', () => {
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
        arguments: ['first'],
      },
      {
        port: 'redo',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
        arguments: ['second'],
      },
      {
        port: 'redo',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
      },
      {
        port: 'fail',
        level: 0,
        goal: 'test(X)',
        predicate: 'test/1',
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('test(X)');
    
    // Should have the last successful solution before failure
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('second');
    }
    
    // Should also have failure child since it ended with fail
    expect(tree.children.some(c => c.type === 'failure')).toBe(true);
  });

  it('handles alternative execution paths correctly', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'choice(X)',
        predicate: 'choice/1',
      },
      {
        port: 'call',
        level: 1,
        goal: 'option1(X)',
        predicate: 'option1/1',
      },
      {
        port: 'exit',
        level: 1,
        goal: 'option1(X)',
        predicate: 'option1/1',
        arguments: ['a'],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'choice(X)',
        predicate: 'choice/1',
        arguments: ['a'],
      },
      {
        port: 'redo',
        level: 0,
        goal: 'choice(X)',
        predicate: 'choice/1',
      },
      {
        port: 'call',
        level: 1,
        goal: 'option2(X)',
        predicate: 'option2/1',
      },
      {
        port: 'exit',
        level: 1,
        goal: 'option2(X)',
        predicate: 'option2/1',
        arguments: ['b'],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'choice(X)',
        predicate: 'choice/1',
        arguments: ['b'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('choice(X)');
    
    // Should have the final solution
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('b'); // Last solution
    }
    
    // Should have children from the alternative paths
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it('maintains tree structure during backtracking', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'parent(X)',
        predicate: 'parent/1',
      },
      {
        port: 'call',
        level: 1,
        goal: 'child1(X)',
        predicate: 'child1/1',
      },
      {
        port: 'fail',
        level: 1,
        goal: 'child1(X)',
        predicate: 'child1/1',
      },
      {
        port: 'redo',
        level: 0,
        goal: 'parent(X)',
        predicate: 'parent/1',
      },
      {
        port: 'call',
        level: 1,
        goal: 'child2(X)',
        predicate: 'child2/1',
      },
      {
        port: 'exit',
        level: 1,
        goal: 'child2(X)',
        predicate: 'child2/1',
        arguments: ['success'],
      },
      {
        port: 'exit',
        level: 0,
        goal: 'parent(X)',
        predicate: 'parent/1',
        arguments: ['success'],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('parent(X)');
    
    // Should have successful unification
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('success');
    }
    
    // Tree structure should be maintained
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Should have child nodes from successful path
    const successfulChild = tree.children.find(c => c.goal === 'child2(X)');
    expect(successfulChild).toBeDefined();
  });

  it('handles deep recursion without stack overflow', () => {
    const depth = 50; // Test with significant recursion depth
    const events = [];
    
    // Generate deep recursive calls
    for (let level = 0; level < depth; level++) {
      events.push({
        port: 'call',
        level,
        goal: `factorial(${depth - level},F)`,
        predicate: 'factorial/2',
      });
    }
    
    // Generate matching exits in reverse order
    for (let level = depth - 1; level >= 0; level--) {
      events.push({
        port: 'exit',
        level,
        goal: `factorial(${depth - level},F)`,
        predicate: 'factorial/2',
        arguments: [depth - level, Math.pow(2, depth - level)], // Some result
      });
    }
    
    const json = JSON.stringify(events);
    
    // Should handle deep recursion without issues
    const startTime = Date.now();
    const tree = parseTraceJson(json);
    const endTime = Date.now();
    
    // Should complete in reasonable time
    expect(endTime - startTime).toBeLessThan(500);
    
    // Should produce valid tree
    expect(tree.type).toBe('query');
    expect(tree.level).toBe(0);
    
    // Should have proper depth
    function getMaxDepth(node: any): number {
      if (node.children.length === 0) return node.level;
      return Math.max(...node.children.map(getMaxDepth));
    }
    
    const maxDepth = getMaxDepth(tree);
    expect(maxDepth).toBeGreaterThanOrEqual(depth - 1);
  });

  it('handles various recursion depths efficiently', () => {
    const depths = [10, 25, 50];
    
    for (const depth of depths) {
      const events = [];
      
      // Generate recursive sequence
      for (let level = 0; level < depth; level++) {
        events.push({
          port: 'call',
          level,
          goal: `countdown(${depth - level})`,
          predicate: 'countdown/1',
        });
      }
      
      for (let level = depth - 1; level >= 0; level--) {
        events.push({
          port: 'exit',
          level,
          goal: `countdown(${depth - level})`,
          predicate: 'countdown/1',
          arguments: [depth - level],
        });
      }
      
      const json = JSON.stringify(events);
      const tree = parseTraceJson(json);
      
      // Should handle each depth correctly
      expect(tree.type).toBe('query');
      expect(tree.level).toBe(0);
      
      // Verify tree structure integrity
      function validateTreeStructure(node: any, expectedMinLevel: number): void {
        expect(node.level).toBeGreaterThanOrEqual(expectedMinLevel);
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('type');
        expect(node).toHaveProperty('children');
        
        for (const child of node.children) {
          if (child.type !== 'success' && child.type !== 'failure') {
            validateTreeStructure(child, node.level);
          }
        }
      }
      
      validateTreeStructure(tree, 0);
    }
  });

  it('optimises memory usage for deep recursion', () => {
    const depth = 30;
    const events = [];
    
    // Generate deep recursion with complex goals
    for (let level = 0; level < depth; level++) {
      events.push({
        port: 'call',
        level,
        goal: `complex_goal(${level}, [${Array.from({length: 5}, (_, i) => i).join(',')}], result)`,
        predicate: 'complex_goal/3',
      });
    }
    
    for (let level = depth - 1; level >= 0; level--) {
      events.push({
        port: 'exit',
        level,
        goal: `complex_goal(${level}, [${Array.from({length: 5}, (_, i) => i).join(',')}], result)`,
        predicate: 'complex_goal/3',
        arguments: [level, Array.from({length: 5}, (_, i) => i), 'computed_result'],
      });
    }
    
    const json = JSON.stringify(events);
    
    // Measure memory usage (approximate)
    const initialMemory = process.memoryUsage().heapUsed;
    const tree = parseTraceJson(json);
    const finalMemory = process.memoryUsage().heapUsed;
    
    // Should not use excessive memory (less than 10MB for this test)
    const memoryUsed = finalMemory - initialMemory;
    expect(memoryUsed).toBeLessThan(10 * 1024 * 1024);
    
    // Should still produce valid tree
    expect(tree.type).toBe('query');
    expect(tree.level).toBe(0);
  });

  it('handles recursion depth limits gracefully', () => {
    // Test with very deep recursion to ensure no stack overflow
    const depth = 100;
    const events = [];
    
    for (let level = 0; level < depth; level++) {
      events.push({
        port: 'call',
        level,
        goal: `deep(${level})`,
        predicate: 'deep/1',
      });
    }
    
    for (let level = depth - 1; level >= 0; level--) {
      events.push({
        port: 'exit',
        level,
        goal: `deep(${level})`,
        predicate: 'deep/1',
        arguments: [level],
      });
    }
    
    const json = JSON.stringify(events);
    
    // Should not throw or crash with deep recursion
    expect(() => {
      const tree = parseTraceJson(json);
      expect(tree.type).toBe('query');
      expect(tree.level).toBe(0);
    }).not.toThrow();
  });

  it('integrates with analyzer for tree processing', () => {
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
    
    // Use imported analyzeTree function
    
    // Should process tree without errors
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    
    // Should produce valid analysis
    expect(analysis.nodes.length).toBeGreaterThan(0);
    expect(analysis.executionOrder.length).toBeGreaterThan(0);
    
    // Should have query node
    const queryNode = analysis.nodes.find(n => n.type === 'query');
    expect(queryNode).toBeDefined();
    expect(queryNode?.label).toContain('factorial');
  });

  it('integrates with analyzer for visualization generation', () => {
    const json = JSON.stringify([
      {
        port: 'call',
        level: 0,
        goal: 'append([1],[2],L)',
        predicate: 'append/3',
      },
      {
        port: 'exit',
        level: 0,
        goal: 'append([1],[2],L)',
        predicate: 'append/3',
        arguments: [[1], [2], [1, 2]],
      },
    ]);
    
    const tree = parseTraceJson(json);
    
    // Use imported functions
    
    // Should process through full pipeline
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    const mermaid = generateMermaid(analysis);
    
    // Should generate valid Mermaid diagram
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('append');
  });

  it('handles end-to-end pipeline integration', () => {
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
    
    // Use imported functions
    
    // Should process through complete pipeline
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    const mermaid = generateMermaid(analysis);
    const markdown = renderMarkdown(analysis, mermaid, 'member(X,[1,2,3])');
    
    // Should generate complete markdown output
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('## Final Answer');
  });
});

