import { describe, it, expect } from 'vitest';
import { parseTraceJson } from './parser.js';
import { analyzeTree } from './analyzer.js';
import { generateMermaid } from './mermaid.js';

describe('Clause Alignment Integration Tests', () => {
  it('should maintain clause number consistency throughout the pipeline', () => {
    // Real trace data with clause information
    const traceJson = JSON.stringify([
      {
        "port": "call",
        "level": 1,
        "goal": "t(0+1+1,_950)",
        "predicate": "t/2"
      },
      {
        "port": "call",
        "level": 2,
        "goal": "t(0+1,_918)",
        "predicate": "t/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "t(0+1,1+0)",
        "predicate": "t/2",
        "arguments": ["0+1", "1+0"],
        "clause": {
          "head": "t(0+1,1+0)",
          "body": "true",
          "line": 26
        }
      },
      {
        "port": "call",
        "level": 2,
        "goal": "t(1+0+1,_792)",
        "predicate": "t/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "t(1+0+1,1+1+0)",
        "predicate": "t/2",
        "arguments": ["1+0+1", "1+1+0"],
        "clause": {
          "head": "t(_690+0+1,_690+1+0)",
          "body": "true",
          "line": 27
        }
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "t(0+1+1,1+1+0)",
        "predicate": "t/2",
        "arguments": ["0+1+1", "1+1+0"],
        "clause": {
          "head": "t(_548+1+1,_538)",
          "body": "t(_548+1,_562),t(_562+1,_538)",
          "line": 28
        }
      }
    ]);

    // Parse the trace
    const tree = parseTraceJson(traceJson);
    const rawEvents = JSON.parse(traceJson);

    // Analyze with trace events
    const analysis = analyzeTree(tree, [], { detailLevel: 'detailed' }, rawEvents);

    // Generate Mermaid diagram
    const mermaid = generateMermaid(analysis);

    // Verify clause extraction - should extract clauses from trace events
    expect(analysis.clausesUsed.length).toBeGreaterThan(0);
    
    // Check that extracted clauses have the expected structure
    analysis.clausesUsed.forEach(clause => {
      expect(clause.clauseNumber).toBeTypeOf('number');
      expect(clause.clauseText).toBeTypeOf('string');
      expect(clause.clauseText.length).toBeGreaterThan(0);
    });

    // Verify match nodes reference valid clause numbers
    const matchNodes = analysis.nodes.filter(n => n.type === 'match');
    if (matchNodes.length > 0) {
      matchNodes.forEach(matchNode => {
        expect(matchNode.clauseNumber).toBeTypeOf('number');
        expect(matchNode.label).toContain('Match Clause');
      });
    }

    // Verify Mermaid diagram contains clause references for extracted clauses
    const clauseNumbers = analysis.clausesUsed.map(c => c.clauseNumber);
    if (clauseNumbers.length > 0) {
      // At least one clause should appear in the diagram
      const hasClauseReference = clauseNumbers.some(num => 
        mermaid.includes(`Match Clause ${num}`) || mermaid.includes(`clause ${num}`)
      );
      expect(hasClauseReference).toBe(true);
    }
  });

  it('should handle complex recursive predicates with proper clause alignment', () => {
    const traceJson = JSON.stringify([
      {
        "port": "call",
        "level": 1,
        "goal": "factorial(3,_result)",
        "predicate": "factorial/2"
      },
      {
        "port": "call",
        "level": 2,
        "goal": "factorial(0,_r1)",
        "predicate": "factorial/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "factorial(0,1)",
        "predicate": "factorial/2",
        "arguments": ["0", "1"],
        "clause": {
          "head": "factorial(0,1)",
          "body": "true",
          "line": 5
        }
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "factorial(3,6)",
        "predicate": "factorial/2",
        "arguments": ["3", "6"],
        "clause": {
          "head": "factorial(N,R)",
          "body": "N>0,N1 is N-1,factorial(N1,R1),R is N*R1",
          "line": 6
        }
      }
    ]);

    const tree = parseTraceJson(traceJson);
    const rawEvents = JSON.parse(traceJson);
    const analysis = analyzeTree(tree, [], { detailLevel: 'full' }, rawEvents);

    // Should extract clauses from trace events
    expect(analysis.clausesUsed.length).toBeGreaterThan(0);
    
    // Verify clause extraction structure
    analysis.clausesUsed.forEach(clause => {
      expect(clause.clauseNumber).toBeTypeOf('number');
      expect(clause.clauseText).toBeTypeOf('string');
      expect([5, 6]).toContain(clause.clauseNumber);
    });

    // Match nodes should reference valid clause numbers
    const matchNodes = analysis.nodes.filter(n => n.type === 'match');
    matchNodes.forEach(matchNode => {
      expect(matchNode.clauseNumber).toBeDefined();
      expect([5, 6]).toContain(matchNode.clauseNumber);
      expect(matchNode.label).toContain('Match Clause');
    });
  });

  it('should handle edge case with no clause information gracefully', () => {
    const traceJson = JSON.stringify([
      {
        "port": "call",
        "level": 1,
        "goal": "builtin_predicate(X)",
        "predicate": "builtin_predicate/1"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "builtin_predicate(success)",
        "predicate": "builtin_predicate/1"
        // No clause information for built-in predicates
      }
    ]);

    const tree = parseTraceJson(traceJson);
    const rawEvents = JSON.parse(traceJson);
    
    // Provide fallback parsed clauses
    const parsedClauses = [
      { number: 1, head: 'user_predicate(X)', text: 'user_predicate(X)' }
    ];

    const analysis = analyzeTree(tree, parsedClauses, { detailLevel: 'standard' }, rawEvents);

    // Should fall back to parsed clauses when no trace clauses available
    expect(analysis.clausesUsed).toHaveLength(1);
    expect(analysis.clausesUsed[0].clauseNumber).toBe(1);
    expect(analysis.clausesUsed[0].clauseText).toBe('user_predicate(X)');
  });

  it('should maintain clause consistency across different detail levels', () => {
    const traceJson = JSON.stringify([
      {
        "port": "exit",
        "level": 1,
        "goal": "member(a,[a,b,c])",
        "predicate": "member/2",
        "clause": {
          "head": "member(H,[H|_])",
          "body": "true",
          "line": 10
        }
      }
    ]);

    const tree = parseTraceJson(traceJson);
    const rawEvents = JSON.parse(traceJson);

    // Test all detail levels
    const detailLevels = ['minimal', 'standard', 'detailed', 'full'] as const;
    
    detailLevels.forEach(level => {
      const analysis = analyzeTree(tree, [], { detailLevel: level }, rawEvents);
      
      // Clause extraction should be consistent regardless of detail level
      expect(analysis.clausesUsed).toHaveLength(1);
      expect(analysis.clausesUsed[0].clauseNumber).toBe(10);
      expect(analysis.clausesUsed[0].clauseText).toBe('member(H,[H|_])');
    });
  });

  it('should handle malformed trace events without crashing', () => {
    const traceJson = JSON.stringify([
      {
        "port": "call",
        "level": 1,
        "goal": "test(a)",
        "predicate": "test/1"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "test(a)",
        "predicate": "test/1",
        "clause": {
          "head": "test(a)",
          // Missing body and line - should be skipped
        }
      },
      {
        "port": "call",
        "level": 1,
        "goal": "test(b)",
        "predicate": "test/1"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "test(b)",
        "predicate": "test/1",
        "clause": {
          "head": "test(b)",
          "body": "true",
          "line": 15
        }
      }
    ]);

    const tree = parseTraceJson(traceJson);
    const rawEvents = JSON.parse(traceJson);

    expect(() => {
      const analysis = analyzeTree(tree, [], { detailLevel: 'standard' }, rawEvents);
      // Should handle malformed clauses gracefully
      expect(analysis.clausesUsed.length).toBeGreaterThanOrEqual(1);
      
      // At least one clause should have proper line number
      const wellFormedClauses = analysis.clausesUsed.filter(c => c.clauseNumber === 15);
      expect(wellFormedClauses).toHaveLength(1);
      expect(wellFormedClauses[0].clauseText).toBe('test(b)');
    }).not.toThrow();
  });
});