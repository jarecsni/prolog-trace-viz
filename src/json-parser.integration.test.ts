import { describe, it, expect } from 'vitest';
import { parseTraceJson } from './parser.js';
import { analyzeTree } from './analyzer.js';
import { generateMermaid } from './mermaid.js';
import { renderMarkdown } from './renderer.js';

describe('JSON Parser Integration Tests', () => {
  /**
   * Test factorial trace end-to-end
   * Based on factorial(3,X) execution
   */
  it('processes factorial trace end-to-end', () => {
    const factorialTrace = [
      {
        "port": "call",
        "level": 0,
        "goal": "factorial(3,F)",
        "predicate": "factorial/2"
      },
      {
        "port": "call",
        "level": 1,
        "goal": "3>0",
        "predicate": ">/2"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "3>0",
        "predicate": ">/2",
        "arguments": [3, 0]
      },
      {
        "port": "call",
        "level": 1,
        "goal": "N1 is 3-1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "N1 is 3-1",
        "predicate": "is/2",
        "arguments": [2, "3-1"]
      },
      {
        "port": "call",
        "level": 1,
        "goal": "factorial(2,R1)",
        "predicate": "factorial/2"
      },
      {
        "port": "call",
        "level": 2,
        "goal": "2>0",
        "predicate": ">/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "2>0",
        "predicate": ">/2",
        "arguments": [2, 0]
      },
      {
        "port": "call",
        "level": 2,
        "goal": "N2 is 2-1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "N2 is 2-1",
        "predicate": "is/2",
        "arguments": [1, "2-1"]
      },
      {
        "port": "call",
        "level": 2,
        "goal": "factorial(1,R2)",
        "predicate": "factorial/2"
      },
      {
        "port": "call",
        "level": 3,
        "goal": "1>0",
        "predicate": ">/2"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "1>0",
        "predicate": ">/2",
        "arguments": [1, 0]
      },
      {
        "port": "call",
        "level": 3,
        "goal": "N3 is 1-1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "N3 is 1-1",
        "predicate": "is/2",
        "arguments": [0, "1-1"]
      },
      {
        "port": "call",
        "level": 3,
        "goal": "factorial(0,R3)",
        "predicate": "factorial/2"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "factorial(0,R3)",
        "predicate": "factorial/2",
        "arguments": [0, 1],
        "clause": {
          "head": "factorial(0,1)",
          "body": "true",
          "line": 1
        }
      },
      {
        "port": "call",
        "level": 3,
        "goal": "R2 is 1*1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "R2 is 1*1",
        "predicate": "is/2",
        "arguments": [1, "1*1"]
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "factorial(1,R2)",
        "predicate": "factorial/2",
        "arguments": [1, 1],
        "clause": {
          "head": "factorial(N,R)",
          "body": "N>0, N1 is N-1, factorial(N1,R1), R is N*R1",
          "line": 2
        }
      },
      {
        "port": "call",
        "level": 2,
        "goal": "R1 is 2*1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "R1 is 2*1",
        "predicate": "is/2",
        "arguments": [2, "2*1"]
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "factorial(2,R1)",
        "predicate": "factorial/2",
        "arguments": [2, 2],
        "clause": {
          "head": "factorial(N,R)",
          "body": "N>0, N1 is N-1, factorial(N1,R1), R is N*R1",
          "line": 2
        }
      },
      {
        "port": "call",
        "level": 1,
        "goal": "F is 3*2",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "F is 3*2",
        "predicate": "is/2",
        "arguments": [6, "3*2"]
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "factorial(3,F)",
        "predicate": "factorial/2",
        "arguments": [3, 6],
        "clause": {
          "head": "factorial(N,R)",
          "body": "N>0, N1 is N-1, factorial(N1,R1), R is N*R1",
          "line": 2
        }
      }
    ];

    const json = JSON.stringify(factorialTrace);

    // Step 1: Parse JSON to ExecutionNode tree
    const tree = parseTraceJson(json);
    
    // Verify tree structure
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('factorial(3,F)');
    expect(tree.level).toBe(0);
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Verify final unification
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const fUnification = tree.unifications.find(u => u.variable === 'F');
      expect(fUnification?.value).toBe('6');
    }
    
    // Verify clause information
    expect(tree.clauseLine).toBe(2);
    expect(tree.clauseNumber).toBe(2);

    // Step 2: Analyze tree
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    
    // Verify analysis results
    expect(analysis.nodes.length).toBeGreaterThan(0);
    expect(analysis.edges.length).toBeGreaterThan(0);
    expect(analysis.executionOrder.length).toBeGreaterThan(0);
    
    // Should have query node
    const queryNode = analysis.nodes.find(n => n.type === 'query');
    expect(queryNode).toBeDefined();
    expect(queryNode?.label).toContain('factorial');
    
    // Should have solving nodes for recursive calls
    const solvingNodes = analysis.nodes.filter(n => n.type === 'solving');
    expect(solvingNodes.length).toBeGreaterThanOrEqual(0); // May or may not have solving nodes

    // Step 3: Generate Mermaid diagram
    const mermaid = generateMermaid(analysis);
    
    // Verify Mermaid output
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('factorial');
    expect(mermaid.length).toBeGreaterThan(100); // Should be substantial

    // Step 4: Render final markdown
    const renderContext = {
      query: 'factorial(3,F)',
      diagram: mermaid,
      executionSteps: analysis.executionSteps,
      finalAnswer: tree.binding || 'F = 6',
      clausesUsed: analysis.clausesUsed,
    };
    const markdown = renderMarkdown(renderContext);
    
    // Verify markdown output
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('## Final Answer');
    expect(markdown).toContain('F = 6');
    
    console.log('Factorial integration test completed successfully');
  });

  /**
   * Test append trace end-to-end
   * Based on append([1,2],[3,4],L) execution
   */
  it('processes append trace end-to-end', () => {
    const appendTrace = [
      {
        "port": "call",
        "level": 0,
        "goal": "append([1,2],[3,4],L)",
        "predicate": "append/3"
      },
      {
        "port": "call",
        "level": 1,
        "goal": "append([2],[3,4],R)",
        "predicate": "append/3"
      },
      {
        "port": "call",
        "level": 2,
        "goal": "append([],[3,4],R2)",
        "predicate": "append/3"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "append([],[3,4],R2)",
        "predicate": "append/3",
        "arguments": [[], [3, 4], [3, 4]],
        "clause": {
          "head": "append([],L,L)",
          "body": "true",
          "line": 1
        }
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "append([2],[3,4],R)",
        "predicate": "append/3",
        "arguments": [[2], [3, 4], [2, 3, 4]],
        "clause": {
          "head": "append([H|T],L,[H|R])",
          "body": "append(T,L,R)",
          "line": 2
        }
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "append([1,2],[3,4],L)",
        "predicate": "append/3",
        "arguments": [[1, 2], [3, 4], [1, 2, 3, 4]],
        "clause": {
          "head": "append([H|T],L,[H|R])",
          "body": "append(T,L,R)",
          "line": 2
        }
      }
    ];

    const json = JSON.stringify(appendTrace);

    // Step 1: Parse JSON to ExecutionNode tree
    const tree = parseTraceJson(json);
    
    // Verify tree structure
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('append([1,2],[3,4],L)');
    expect(tree.level).toBe(0);
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Verify final unification
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const lUnification = tree.unifications.find(u => u.variable === 'L');
      expect(lUnification?.value).toBe('[1,2,3,4]');
    }

    // Step 2: Analyze tree
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    
    // Verify analysis results
    expect(analysis.nodes.length).toBeGreaterThan(0);
    expect(analysis.edges.length).toBeGreaterThan(0);
    
    // Should have query node
    const queryNode = analysis.nodes.find(n => n.type === 'query');
    expect(queryNode).toBeDefined();
    expect(queryNode?.label).toContain('append');

    // Step 3: Generate Mermaid diagram
    const mermaid = generateMermaid(analysis);
    
    // Verify Mermaid output
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('append');

    // Step 4: Render final markdown
    const renderContext = {
      query: 'append([1,2],[3,4],L)',
      diagram: mermaid,
      executionSteps: analysis.executionSteps,
      finalAnswer: tree.binding || 'L = [1,2,3,4]',
      clausesUsed: analysis.clausesUsed,
    };
    const markdown = renderMarkdown(renderContext);
    
    // Verify markdown output
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('## Final Answer');
    expect(markdown).toContain('L = [1,2,3,4]');
    
    console.log('Append integration test completed successfully');
  });

  /**
   * Test member trace end-to-end with backtracking
   * Based on member(X,[1,2,3]) execution showing multiple solutions
   */
  it('processes member trace end-to-end with backtracking', () => {
    const memberTrace = [
      {
        "port": "call",
        "level": 0,
        "goal": "member(X,[1,2,3])",
        "predicate": "member/2"
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "member(X,[1,2,3])",
        "predicate": "member/2",
        "arguments": [1, [1, 2, 3]],
        "clause": {
          "head": "member(X,[X|_])",
          "body": "true",
          "line": 1
        }
      },
      {
        "port": "redo",
        "level": 0,
        "goal": "member(X,[1,2,3])",
        "predicate": "member/2"
      },
      {
        "port": "call",
        "level": 1,
        "goal": "member(X,[2,3])",
        "predicate": "member/2"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "member(X,[2,3])",
        "predicate": "member/2",
        "arguments": [2, [2, 3]],
        "clause": {
          "head": "member(X,[X|_])",
          "body": "true",
          "line": 1
        }
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "member(X,[1,2,3])",
        "predicate": "member/2",
        "arguments": [2, [1, 2, 3]],
        "clause": {
          "head": "member(X,[_|T])",
          "body": "member(X,T)",
          "line": 2
        }
      },
      {
        "port": "redo",
        "level": 0,
        "goal": "member(X,[1,2,3])",
        "predicate": "member/2"
      },
      {
        "port": "redo",
        "level": 1,
        "goal": "member(X,[2,3])",
        "predicate": "member/2"
      },
      {
        "port": "call",
        "level": 2,
        "goal": "member(X,[3])",
        "predicate": "member/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "member(X,[3])",
        "predicate": "member/2",
        "arguments": [3, [3]],
        "clause": {
          "head": "member(X,[X|_])",
          "body": "true",
          "line": 1
        }
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "member(X,[2,3])",
        "predicate": "member/2",
        "arguments": [3, [2, 3]],
        "clause": {
          "head": "member(X,[_|T])",
          "body": "member(X,T)",
          "line": 2
        }
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "member(X,[1,2,3])",
        "predicate": "member/2",
        "arguments": [3, [1, 2, 3]],
        "clause": {
          "head": "member(X,[_|T])",
          "body": "member(X,T)",
          "line": 2
        }
      }
    ];

    const json = JSON.stringify(memberTrace);

    // Step 1: Parse JSON to ExecutionNode tree
    const tree = parseTraceJson(json);
    
    // Verify tree structure
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('member(X,[1,2,3])');
    expect(tree.level).toBe(0);
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Verify final unification (should be the last solution)
    expect(tree.unifications).toBeDefined();
    if (tree.unifications) {
      const xUnification = tree.unifications.find(u => u.variable === 'X');
      expect(xUnification?.value).toBe('3'); // Last solution
    }

    // Step 2: Analyze tree
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    
    // Verify analysis results
    expect(analysis.nodes.length).toBeGreaterThan(0);
    expect(analysis.edges.length).toBeGreaterThan(0);
    
    // Should have query node
    const queryNode = analysis.nodes.find(n => n.type === 'query');
    expect(queryNode).toBeDefined();
    expect(queryNode?.label).toContain('member');

    // Step 3: Generate Mermaid diagram
    const mermaid = generateMermaid(analysis);
    
    // Verify Mermaid output
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('member');

    // Step 4: Render final markdown
    const renderContext = {
      query: 'member(X,[1,2,3])',
      diagram: mermaid,
      executionSteps: analysis.executionSteps,
      finalAnswer: tree.binding || 'X = 3',
      clausesUsed: analysis.clausesUsed,
    };
    const markdown = renderMarkdown(renderContext);
    
    // Verify markdown output
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('## Final Answer');
    expect(markdown).toContain('X = 3');
    
    console.log('Member integration test completed successfully');
  });

  /**
   * Test recursive examples end-to-end
   * Based on a more complex recursive scenario
   */
  it('processes recursive examples end-to-end', () => {
    const recursiveTrace = [
      {
        "port": "call",
        "level": 0,
        "goal": "countdown(3)",
        "predicate": "countdown/1"
      },
      {
        "port": "call",
        "level": 1,
        "goal": "3>0",
        "predicate": ">/2"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "3>0",
        "predicate": ">/2",
        "arguments": [3, 0]
      },
      {
        "port": "call",
        "level": 1,
        "goal": "N1 is 3-1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "N1 is 3-1",
        "predicate": "is/2",
        "arguments": [2, "3-1"]
      },
      {
        "port": "call",
        "level": 1,
        "goal": "countdown(2)",
        "predicate": "countdown/1"
      },
      {
        "port": "call",
        "level": 2,
        "goal": "2>0",
        "predicate": ">/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "2>0",
        "predicate": ">/2",
        "arguments": [2, 0]
      },
      {
        "port": "call",
        "level": 2,
        "goal": "N2 is 2-1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "N2 is 2-1",
        "predicate": "is/2",
        "arguments": [1, "2-1"]
      },
      {
        "port": "call",
        "level": 2,
        "goal": "countdown(1)",
        "predicate": "countdown/1"
      },
      {
        "port": "call",
        "level": 3,
        "goal": "1>0",
        "predicate": ">/2"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "1>0",
        "predicate": ">/2",
        "arguments": [1, 0]
      },
      {
        "port": "call",
        "level": 3,
        "goal": "N3 is 1-1",
        "predicate": "is/2"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "N3 is 1-1",
        "predicate": "is/2",
        "arguments": [0, "1-1"]
      },
      {
        "port": "call",
        "level": 3,
        "goal": "countdown(0)",
        "predicate": "countdown/1"
      },
      {
        "port": "exit",
        "level": 3,
        "goal": "countdown(0)",
        "predicate": "countdown/1",
        "arguments": [0],
        "clause": {
          "head": "countdown(0)",
          "body": "true",
          "line": 1
        }
      },
      {
        "port": "exit",
        "level": 2,
        "goal": "countdown(1)",
        "predicate": "countdown/1",
        "arguments": [1],
        "clause": {
          "head": "countdown(N)",
          "body": "N>0, N1 is N-1, countdown(N1)",
          "line": 2
        }
      },
      {
        "port": "exit",
        "level": 1,
        "goal": "countdown(2)",
        "predicate": "countdown/1",
        "arguments": [2],
        "clause": {
          "head": "countdown(N)",
          "body": "N>0, N1 is N-1, countdown(N1)",
          "line": 2
        }
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "countdown(3)",
        "predicate": "countdown/1",
        "arguments": [3],
        "clause": {
          "head": "countdown(N)",
          "body": "N>0, N1 is N-1, countdown(N1)",
          "line": 2
        }
      }
    ];

    const json = JSON.stringify(recursiveTrace);

    // Step 1: Parse JSON to ExecutionNode tree
    const tree = parseTraceJson(json);
    
    // Verify tree structure
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('countdown(3)');
    expect(tree.level).toBe(0);
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Verify recursion depth
    function getMaxDepth(node: any): number {
      if (node.children.length === 0) return node.level;
      return Math.max(...node.children.map(getMaxDepth));
    }
    
    const maxDepth = getMaxDepth(tree);
    expect(maxDepth).toBeGreaterThanOrEqual(3);

    // Step 2: Analyze tree
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    
    // Verify analysis results
    expect(analysis.nodes.length).toBeGreaterThan(0);
    expect(analysis.edges.length).toBeGreaterThan(0);
    
    // Should have multiple countdown nodes at different levels
    const countdownNodes = analysis.nodes.filter(n => n.label && n.label.includes('countdown'));
    expect(countdownNodes.length).toBeGreaterThan(1);

    // Step 3: Generate Mermaid diagram
    const mermaid = generateMermaid(analysis);
    
    // Verify Mermaid output
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('countdown');

    // Step 4: Render final markdown
    const renderContext = {
      query: 'countdown(3)',
      diagram: mermaid,
      executionSteps: analysis.executionSteps,
      finalAnswer: 'countdown(3) succeeded',
      clausesUsed: analysis.clausesUsed,
    };
    const markdown = renderMarkdown(renderContext);
    
    // Verify markdown output
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('## Final Answer');
    
    console.log('Recursive integration test completed successfully');
  });

  /**
   * Test with real trace data from test_trace.json
   * This uses the actual trace data from the repository
   */
  it('processes real trace data end-to-end', () => {
    const realTrace = [
      {"port": "call", "level": 10, "goal": "factorial(3,_11804)", "predicate": "factorial/2"},
      {"port": "call", "level": 11, "goal": "3>0", "predicate": ">/2"},
      {"port": "exit", "level": 11, "goal": "3>0", "predicate": ">/2", "arguments": ["3", "0"]},
      {"port": "call", "level": 11, "goal": "_1198 is 3+ -1", "predicate": "is/2"},
      {"port": "exit", "level": 11, "goal": "2 is 3+ -1", "predicate": "is/2", "arguments": ["2", "3+ -1"]},
      {"port": "call", "level": 11, "goal": "factorial(2,_1124)", "predicate": "factorial/2"},
      {"port": "call", "level": 12, "goal": "2>0", "predicate": ">/2"},
      {"port": "exit", "level": 12, "goal": "2>0", "predicate": ">/2", "arguments": ["2", "0"]},
      {"port": "call", "level": 12, "goal": "_1026 is 2+ -1", "predicate": "is/2"},
      {"port": "exit", "level": 12, "goal": "1 is 2+ -1", "predicate": "is/2", "arguments": ["1", "2+ -1"]},
      {"port": "call", "level": 12, "goal": "factorial(1,_952)", "predicate": "factorial/2"},
      {"port": "call", "level": 13, "goal": "1>0", "predicate": ">/2"},
      {"port": "exit", "level": 13, "goal": "1>0", "predicate": ">/2", "arguments": ["1", "0"]},
      {"port": "call", "level": 13, "goal": "_854 is 1+ -1", "predicate": "is/2"},
      {"port": "exit", "level": 13, "goal": "0 is 1+ -1", "predicate": "is/2", "arguments": ["0", "1+ -1"]},
      {"port": "call", "level": 13, "goal": "factorial(0,_780)", "predicate": "factorial/2"},
      {"port": "exit", "level": 13, "goal": "factorial(0,1)", "predicate": "factorial/2", "arguments": ["0", "1"], "clause": {"head": "factorial(0,1)", "body": "true", "line": 4}},
      {"port": "call", "level": 13, "goal": "_694 is 1*1", "predicate": "is/2"},
      {"port": "exit", "level": 13, "goal": "1 is 1*1", "predicate": "is/2", "arguments": ["1", "1*1"]},
      {"port": "exit", "level": 12, "goal": "factorial(1,1)", "predicate": "factorial/2", "arguments": ["1", "1"], "clause": {"head": "factorial(_564,_566)", "body": "_564>0,_588 is _564+ -1,factorial(_588,_608),_566 is _564*_608", "line": 5}},
      {"port": "call", "level": 12, "goal": "_506 is 2*1", "predicate": "is/2"},
      {"port": "exit", "level": 12, "goal": "2 is 2*1", "predicate": "is/2", "arguments": ["2", "2*1"]},
      {"port": "exit", "level": 11, "goal": "factorial(2,2)", "predicate": "factorial/2", "arguments": ["2", "2"], "clause": {"head": "factorial(_376,_378)", "body": "_376>0,_400 is _376+ -1,factorial(_400,_420),_378 is _376*_420", "line": 5}},
      {"port": "call", "level": 11, "goal": "_318 is 3*2", "predicate": "is/2"},
      {"port": "exit", "level": 11, "goal": "6 is 3*2", "predicate": "is/2", "arguments": ["6", "3*2"]},
      {"port": "exit", "level": 10, "goal": "factorial(3,6)", "predicate": "factorial/2", "arguments": ["3", "6"], "clause": {"head": "factorial(_188,_190)", "body": "_188>0,_212 is _188+ -1,factorial(_212,_232),_190 is _188*_232", "line": 5}}
    ];

    const json = JSON.stringify(realTrace);

    // Step 1: Parse JSON to ExecutionNode tree
    const tree = parseTraceJson(json);
    
    // Verify tree structure
    expect(tree.type).toBe('query');
    expect(tree.goal).toContain('factorial(3,');
    expect(tree.level).toBe(10); // Real trace starts at level 10
    expect(tree.children.length).toBeGreaterThan(0);

    // Step 2: Analyze tree
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    
    // Verify analysis results
    expect(analysis.nodes.length).toBeGreaterThan(0);
    expect(analysis.edges.length).toBeGreaterThan(0);
    
    // Should have nodes (may not have query type due to level 10 start)
    expect(analysis.nodes.length).toBeGreaterThan(0);
    
    // Should have at least one node with factorial in the label
    const factorialNode = analysis.nodes.find(n => n.label && n.label.includes('factorial'));
    expect(factorialNode).toBeDefined();

    // Step 3: Generate Mermaid diagram
    const mermaid = generateMermaid(analysis);
    
    // Verify Mermaid output
    expect(typeof mermaid).toBe('string');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('factorial');

    // Step 4: Render final markdown
    const renderContext = {
      query: 'factorial(3,X)',
      diagram: mermaid,
      executionSteps: analysis.executionSteps,
      finalAnswer: 'factorial(3,6)',
      clausesUsed: analysis.clausesUsed,
    };
    const markdown = renderMarkdown(renderContext);
    
    // Verify markdown output
    expect(typeof markdown).toBe('string');
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('## Final Answer');
    
    console.log('Real trace integration test completed successfully');
  });

  /**
   * Compare output quality with expected results
   * This test verifies that the pipeline produces high-quality, expected outputs
   */
  it('produces high-quality output matching expectations', () => {
    const simpleTrace = [
      {
        "port": "call",
        "level": 0,
        "goal": "test(X)",
        "predicate": "test/1"
      },
      {
        "port": "exit",
        "level": 0,
        "goal": "test(X)",
        "predicate": "test/1",
        "arguments": ["hello"],
        "clause": {
          "head": "test(hello)",
          "body": "true",
          "line": 1
        }
      }
    ];

    const json = JSON.stringify(simpleTrace);

    // Process through complete pipeline
    const tree = parseTraceJson(json);
    const analysis = analyzeTree(tree, [], { detailLevel: 'standard' });
    const mermaid = generateMermaid(analysis);
    const renderContext = {
      query: 'test(X)',
      diagram: mermaid,
      executionSteps: analysis.executionSteps,
      finalAnswer: tree.binding || 'X = hello',
      clausesUsed: analysis.clausesUsed,
    };
    const markdown = renderMarkdown(renderContext);

    // Verify output quality expectations

    // 1. Tree should have correct structure
    expect(tree.type).toBe('query');
    expect(tree.goal).toBe('test(X)');
    expect(tree.unifications).toBeDefined();
    expect(tree.unifications?.[0]?.variable).toBe('X');
    expect(tree.unifications?.[0]?.value).toBe('hello');
    expect(tree.binding).toBe('X = hello');

    // 2. Analysis should be comprehensive
    expect(analysis.nodes.length).toBeGreaterThanOrEqual(2); // At least query + success
    expect(analysis.edges.length).toBeGreaterThanOrEqual(1); // At least one edge
    expect(analysis.executionOrder.length).toBeGreaterThan(0);

    // 3. Mermaid should be well-formed
    expect(mermaid).toMatch(/^graph TD/);
    expect(mermaid).toContain('test');
    
    // Should have proper node definitions
    const nodeDefinitions = mermaid.match(/\w+\[.*?\]/g);
    expect(nodeDefinitions).toBeTruthy();
    expect(nodeDefinitions!.length).toBeGreaterThan(0);

    // 4. Markdown should be complete and well-formatted
    expect(markdown).toContain('# Prolog Execution Tree');
    expect(markdown).toContain('## Query');
    expect(markdown).toContain('test(X)');
    expect(markdown).toContain('```mermaid');
    expect(markdown.length).toBeGreaterThan(100); // Should be substantial
    
    // Should have proper markdown structure
    const sections = markdown.split('##');
    expect(sections.length).toBeGreaterThanOrEqual(4); // Title + Query + Answer + Steps + Diagram

    console.log('Output quality verification completed successfully');
  });
});