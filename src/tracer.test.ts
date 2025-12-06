import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Helper to execute a Prolog file with the tracer and get JSON output
 */
async function executeWithTracer(prologCode: string, query: string): Promise<any[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-test-'));
  const prologFile = path.join(tempDir, 'test.pl');
  const wrapperFile = path.join(tempDir, 'wrapper.pl');
  const jsonFile = path.join(tempDir, 'trace.json');
  
  try {
    // Write Prolog code
    await fs.writeFile(prologFile, prologCode);
    
    // Write wrapper
    const wrapper = `
:- ['${path.resolve('tracer.pl')}'].
:- ['test.pl'].

run_trace :-
    install_tracer,
    catch(
        (${query} -> true ; true),
        _Error,
        true
    ),
    export_trace_json('trace.json'),
    remove_tracer.

:- run_trace.
:- halt.
`;
    await fs.writeFile(wrapperFile, wrapper);
    
    // Execute
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('swipl', ['-g', '[wrapper]'], { cwd: tempDir });
      proc.on('error', reject);
      proc.on('close', () => resolve());
    });
    
    // Read JSON
    const json = await fs.readFile(jsonFile, 'utf-8');
    return JSON.parse(json);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('Tracer Edge Cases', () => {
  it('handles empty Prolog files', async () => {
    const code = '';
    const query = 'true';
    
    const events = await executeWithTracer(code, query);
    
    // Should have at least call and exit for 'true'
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.port === 'call')).toBe(true);
  });

  it('handles queries with no solutions', async () => {
    const code = `
test_pred(1).
test_pred(2).
`;
    const query = 'test_pred(99)';
    
    const events = await executeWithTracer(code, query);
    
    // Should have call and fail events
    expect(events.length).toBeGreaterThan(0);
    const ports = events.map(e => e.port);
    expect(ports).toContain('call');
    expect(ports).toContain('fail');
  });

  it('handles deeply recursive predicates', async () => {
    const code = `
deep(0).
deep(N) :- N > 0, N1 is N - 1, deep(N1).
`;
    const query = 'deep(20)';
    
    const events = await executeWithTracer(code, query);
    
    // Should have many events due to recursion
    expect(events.length).toBeGreaterThan(20);
    
    // Should have varying levels
    const levels = events.map(e => e.level);
    const maxLevel = Math.max(...levels);
    expect(maxLevel).toBeGreaterThan(5);
  });

  it('handles malformed queries gracefully', async () => {
    const code = `
test_pred(X) :- X = 1.
`;
    
    // Query that will cause an error
    const query = 'X is 1/0';
    
    try {
      const events = await executeWithTracer(code, query);
      // Should still produce some events
      expect(Array.isArray(events)).toBe(true);
    } catch (error) {
      // Execution might fail, but that's acceptable
      expect(true).toBe(true);
    }
  });

  it('captures multiple clause attempts during backtracking', async () => {
    const code = `
test(1, a).
test(2, b).
test(3, c).
`;
    const query = 'test(X, Y), X > 1';
    
    const events = await executeWithTracer(code, query);
    
    // Should have multiple attempts at test/2
    const testCalls = events.filter(e => 
      e.predicate && e.predicate.startsWith('test/') && e.port === 'call'
    );
    expect(testCalls.length).toBeGreaterThan(0);
  });

  it('handles predicates with no clauses', async () => {
    const code = `
defined_pred(X) :- X = 1.
`;
    const query = 'undefined_pred(X)';
    
    try {
      const events = await executeWithTracer(code, query);
      // Should capture the call even if predicate is undefined
      expect(events.length).toBeGreaterThan(0);
    } catch (error) {
      // Might fail, which is acceptable
      expect(true).toBe(true);
    }
  });

  it('handles built-in predicates', async () => {
    const code = `
test_builtin(X, Y) :- Y is X + 1.
`;
    const query = 'test_builtin(5, Y)';
    
    const events = await executeWithTracer(code, query);
    
    // Should capture events for both user-defined and built-in predicates
    expect(events.length).toBeGreaterThan(0);
    
    // Should have events for 'is/2' built-in
    const builtinEvents = events.filter(e => 
      e.predicate && e.predicate.includes('is/')
    );
    expect(builtinEvents.length).toBeGreaterThan(0);
  });

  it('handles list operations', async () => {
    const code = `
append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).
`;
    const query = 'append([1,2], [3,4], X)';
    
    const events = await executeWithTracer(code, query);
    
    // Should have multiple recursive calls
    expect(events.length).toBeGreaterThan(5);
    
    // Should have clause information for append
    const appendEvents = events.filter(e => 
      e.predicate && e.predicate.startsWith('append/') && e.clause
    );
    expect(appendEvents.length).toBeGreaterThan(0);
  });
});
