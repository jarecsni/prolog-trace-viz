import { describe, it, expect } from 'vitest';
import { analyzeTree } from './analyzer.js';
import { TraceEvent } from './parser.js';

describe('Trace Clause Extraction', () => {
  it('should extract clauses from trace events instead of parsed clauses', () => {
    const traceEvents: TraceEvent[] = [
      {
        port: 'call',
        level: 1,
        goal: 't(0+1+1,_950)',
        predicate: 't/2'
      },
      {
        port: 'exit',
        level: 2,
        goal: 't(0+1,1+0)',
        predicate: 't/2',
        arguments: ['0+1', '1+0'],
        clause: {
          head: 't(0+1,1+0)',
          body: 'true',
          line: 26
        }
      },
      {
        port: 'exit',
        level: 2,
        goal: 't(1+0+1,1+1+0)',
        predicate: 't/2',
        arguments: ['1+0+1', '1+1+0'],
        clause: {
          head: 't(_690+0+1,_690+1+0)',
          body: 'true',
          line: 27
        }
      }
    ];

    const mockTree = {
      id: 'root',
      type: 'query' as const,
      goal: 't(0+1+1,_950)',
      children: [],
      level: 0
    };

    const parsedClauses = [
      { number: 1, head: 'wrong(clause)', text: 'wrong(clause)' },
      { number: 2, head: 'also_wrong(X)', text: 'also_wrong(X)' }
    ];

    const result = analyzeTree(mockTree, parsedClauses, { detailLevel: 'standard' }, traceEvents);

    // Should use trace clauses, not parsed clauses
    expect(result.clausesUsed).toHaveLength(2);
    expect(result.clausesUsed[0].clauseNumber).toBe(26);
    expect(result.clausesUsed[0].clauseText).toBe('t(0+1,1+0)');
    expect(result.clausesUsed[1].clauseNumber).toBe(27);
    expect(result.clausesUsed[1].clauseText).toBe('t(_690+0+1,_690+1+0)');
  });

  it('should handle clauses with bodies correctly', () => {
    const traceEvents: TraceEvent[] = [
      {
        port: 'exit',
        level: 1,
        goal: 'factorial(3,6)',
        predicate: 'factorial/2',
        arguments: ['3', '6'],
        clause: {
          head: 'factorial(N,R)',
          body: 'N>0,N1 is N-1,factorial(N1,R1),R is N*R1',
          line: 15
        }
      },
      {
        port: 'exit',
        level: 2,
        goal: 'factorial(0,1)',
        predicate: 'factorial/2',
        arguments: ['0', '1'],
        clause: {
          head: 'factorial(0,1)',
          body: 'true',
          line: 14
        }
      }
    ];

    const mockTree = {
      id: 'root',
      type: 'query' as const,
      goal: 'factorial(3,6)',
      children: [],
      level: 0
    };

    const result = analyzeTree(mockTree, [], { detailLevel: 'standard' }, traceEvents);

    expect(result.clausesUsed).toHaveLength(2);
    
    // Base case (fact)
    const baseClause = result.clausesUsed.find(c => c.clauseNumber === 14);
    expect(baseClause?.clauseText).toBe('factorial(0,1)');
    
    // Recursive case (rule)
    const recursiveClause = result.clausesUsed.find(c => c.clauseNumber === 15);
    expect(recursiveClause?.clauseText).toBe('factorial(N,R) :- N>0,N1 is N-1,factorial(N1,R1),R is N*R1');
  });

  it('should fallback to parsed clauses when no trace events provided', () => {
    const mockTree = {
      id: 'root',
      type: 'query' as const,
      goal: 'test(X)',
      children: [],
      level: 0
    };

    const parsedClauses = [
      { number: 1, head: 'test(a)', text: 'test(a)' },
      { number: 2, head: 'test(b)', text: 'test(b)' }
    ];

    const result = analyzeTree(mockTree, parsedClauses, { detailLevel: 'standard' }, []);

    // Should use parsed clauses as fallback
    expect(result.clausesUsed).toHaveLength(2);
    expect(result.clausesUsed[0].clauseNumber).toBe(1);
    expect(result.clausesUsed[0].clauseText).toBe('test(a)');
  });

  it('should deduplicate identical clauses from trace events', () => {
    const traceEvents: TraceEvent[] = [
      {
        port: 'exit',
        level: 1,
        goal: 't(0+1,1+0)',
        predicate: 't/2',
        clause: {
          head: 't(0+1,1+0)',
          body: 'true',
          line: 26
        }
      },
      {
        port: 'exit',
        level: 2,
        goal: 't(0+1,1+0)',
        predicate: 't/2',
        clause: {
          head: 't(0+1,1+0)',
          body: 'true',
          line: 26
        }
      }
    ];

    const mockTree = {
      id: 'root',
      type: 'query' as const,
      goal: 't(0+1,1+0)',
      children: [],
      level: 0
    };

    const result = analyzeTree(mockTree, [], { detailLevel: 'standard' }, traceEvents);

    // Should only have one clause despite multiple uses
    expect(result.clausesUsed).toHaveLength(1);
    expect(result.clausesUsed[0].clauseNumber).toBe(26);
  });

  it('should sort extracted clauses by line number', () => {
    const traceEvents: TraceEvent[] = [
      {
        port: 'exit',
        level: 1,
        goal: 't(c)',
        predicate: 't/1',
        clause: {
          head: 't(c)',
          body: 'true',
          line: 30
        }
      },
      {
        port: 'exit',
        level: 2,
        goal: 't(a)',
        predicate: 't/1',
        clause: {
          head: 't(a)',
          body: 'true',
          line: 10
        }
      },
      {
        port: 'exit',
        level: 3,
        goal: 't(b)',
        predicate: 't/1',
        clause: {
          head: 't(b)',
          body: 'true',
          line: 20
        }
      }
    ];

    const mockTree = {
      id: 'root',
      type: 'query' as const,
      goal: 't(X)',
      children: [],
      level: 0
    };

    const result = analyzeTree(mockTree, [], { detailLevel: 'standard' }, traceEvents);

    // Should be sorted by line number
    expect(result.clausesUsed).toHaveLength(3);
    expect(result.clausesUsed[0].clauseNumber).toBe(10);
    expect(result.clausesUsed[1].clauseNumber).toBe(20);
    expect(result.clausesUsed[2].clauseNumber).toBe(30);
  });

  it('should ignore trace events without clause information', () => {
    const traceEvents: TraceEvent[] = [
      {
        port: 'call',
        level: 1,
        goal: 't(X)',
        predicate: 't/1'
      },
      {
        port: 'exit',
        level: 1,
        goal: 't(a)',
        predicate: 't/1',
        clause: {
          head: 't(a)',
          body: 'true',
          line: 10
        }
      },
      {
        port: 'fail',
        level: 1,
        goal: 't(b)',
        predicate: 't/1'
      }
    ];

    const mockTree = {
      id: 'root',
      type: 'query' as const,
      goal: 't(X)',
      children: [],
      level: 0
    };

    const result = analyzeTree(mockTree, [], { detailLevel: 'standard' }, traceEvents);

    // Should only extract from events with clause info
    expect(result.clausesUsed).toHaveLength(1);
    expect(result.clausesUsed[0].clauseNumber).toBe(10);
  });
});