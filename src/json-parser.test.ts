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

  it('handles type mismatches by throwing', () => {
    const invalidJson = JSON.stringify({
      not: 'an array',
    });
    
    expect(() => parseTraceJson(invalidJson)).toThrow();
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

  it('handles malformed JSON', () => {
    const invalidJson = '{ invalid json }';
    
    expect(() => parseTraceJson(invalidJson)).toThrow();
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
});
