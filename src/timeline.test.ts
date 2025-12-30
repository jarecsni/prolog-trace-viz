/**
 * Timeline Builder Tests
 * Tests for CALL/EXIT merging, especially for recursive predicates
 */

import { describe, it, expect } from 'vitest';
import { TimelineBuilder, TraceEvent, flattenTimeline } from './timeline.js';

describe('Timeline merging - non-recursive', () => {
  it('should merge CALL/EXIT pairs in correct order', () => {
    const events: TraceEvent[] = [
      { 
        port: 'call', 
        level: 33, 
        goal: 'fact(a, X)', 
        predicate: 'fact/2',
        clause: { head: 'fact(a, 1)', body: 'true', line: 1 }
      },
      { 
        port: 'exit', 
        level: 33, 
        goal: 'fact(a, 1)', 
        predicate: 'fact/2',
        clause: { head: 'fact(a, 1)', body: 'true', line: 1 }
      },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = flattenTimeline(builder.build());
    
    expect(timeline).toHaveLength(1);
    expect(timeline[0].port).toBe('merged');
    expect(timeline[0].stepNumber).toBe(1);
    expect(timeline[0].result).toBe('1');
  });
});

describe('Timeline merging - recursive', () => {
  it('should preserve chronological order for recursive calls', () => {
    // Events for: append([1,2], [3,4], X)
    const events: TraceEvent[] = [
      { 
        port: 'call', 
        level: 33, 
        goal: 'append([1,2],[3,4],X)', 
        predicate: 'append/3',
        clause: { head: 'append([H|T], L, [H|R])', body: 'append(T, L, R)', line: 2 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 'append([2],[3,4],R)', 
        predicate: 'append/3',
        clause: { head: 'append([H|T], L, [H|R])', body: 'append(T, L, R)', line: 2 }
      },
      { 
        port: 'call', 
        level: 35, 
        goal: 'append([],[3,4],R2)', 
        predicate: 'append/3',
        clause: { head: 'append([], L, L)', body: 'true', line: 1 }
      },
      { 
        port: 'exit', 
        level: 35, 
        goal: 'append([],[3,4],[3,4])', 
        predicate: 'append/3',
        clause: { head: 'append([], L, L)', body: 'true', line: 1 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 'append([2],[3,4],[2,3,4])', 
        predicate: 'append/3',
        clause: { head: 'append([H|T], L, [H|R])', body: 'append(T, L, R)', line: 2 }
      },
      { 
        port: 'exit', 
        level: 33, 
        goal: 'append([1,2],[3,4],[1,2,3,4])', 
        predicate: 'append/3',
        clause: { head: 'append([H|T], L, [H|R])', body: 'append(T, L, R)', line: 2 }
      },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = flattenTimeline(builder.build());
    
    expect(timeline).toHaveLength(3);
    expect(timeline[0].stepNumber).toBe(1);
    expect(timeline[1].stepNumber).toBe(2);
    expect(timeline[2].stepNumber).toBe(3);
    expect(timeline[0].goal).toContain('append([1,2]');
    expect(timeline[1].goal).toContain('append([2]');
    expect(timeline[2].goal).toContain('append([]');
  });
});

describe('Timeline merging - multiple calls at same level', () => {
  it('should not lose steps when multiple calls occur at the same recursion level', () => {
    // Simplified events for: t(1+0+1+1, A)
    // This is the bug case - two calls at level 34
    const events: TraceEvent[] = [
      { 
        port: 'call', 
        level: 33, 
        goal: 't(1+0+1+1,A)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1, Z)', body: 't(X+1, X1), t(X1+1, Z)', line: 28 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 't(1+0+1,X1)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 't(1+0+1,1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 't(1+1+0+1,Z)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 't(1+1+0+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 33, 
        goal: 't(1+0+1+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1, Z)', body: 't(X+1, X1), t(X1+1, Z)', line: 28 }
      },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = flattenTimeline(builder.build());
    
    // Should have 3 merged steps (not 2!)
    expect(timeline).toHaveLength(3);
    
    // Steps should be numbered continuously 1, 2, 3
    expect(timeline[0].stepNumber).toBe(1);
    expect(timeline[1].stepNumber).toBe(2);
    expect(timeline[2].stepNumber).toBe(3);
    
    // Step 1 should be t(1+0+1+1,A)
    expect(timeline[0].goal).toBe('t(1+0+1+1,A)');
    
    // Step 2 should be t(1+0+1,X1)
    expect(timeline[1].goal).toBe('t(1+0+1,X1)');
    
    // Step 3 should be t(1+1+0+1,Z)
    expect(timeline[2].goal).toBe('t(1+1+0+1,Z)');
  });
});

describe('Subgoal label assignment', () => {
  it('should assign correct subgoal labels', () => {
    const events: TraceEvent[] = [
      { 
        port: 'call', 
        level: 33, 
        goal: 't(1+0+1+1,A)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1,Z)', body: 't(X+1,X1), t(X1+1,Z)', line: 28 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 't(1+0+1,X1)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 't(1+0+1,1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 't(1+1+0+1,Z)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 't(1+1+0+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 33, 
        goal: 't(1+0+1+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1,Z)', body: 't(X+1,X1), t(X1+1,Z)', line: 28 }
      },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = flattenTimeline(builder.build());
    
    // Step 1 should have subgoals [1.1] and [1.2]
    expect(timeline[0].subgoals).toHaveLength(2);
    expect(timeline[0].subgoals[0].label).toBe('[1.1]');
    expect(timeline[0].subgoals[1].label).toBe('[1.2]');
    
    // Step 2 should be solving [1.1]
    expect(timeline[1].subgoalLabel).toBe('[1.1]');
    
    // Step 3 should be solving [1.2]
    expect(timeline[2].subgoalLabel).toBe('[1.2]');
  });
});

describe('Instantiated subgoal display', () => {
  it('should show instantiated subgoals with variable substitution', () => {
    const events: TraceEvent[] = [
      { 
        port: 'call', 
        level: 33, 
        goal: 't(1+0+1+1,A)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1,Z)', body: 't(X+1,X1), t(X1+1,Z)', line: 28 }
      },
      { 
        port: 'exit', 
        level: 33, 
        goal: 't(1+0+1+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1,Z)', body: 't(X+1,X1), t(X1+1,Z)', line: 28 }
      },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = flattenTimeline(builder.build());
    
    // Subgoal [1.1] should show instantiation with arrow
    expect(timeline[0].subgoals[0].goal).toContain('→');
    // The pattern matching extracts X = 1+0 (due to operator associativity)
    // So t(X+1,X1) becomes t(1+0+1,X1)
    expect(timeline[0].subgoals[0].goal).toContain('1+0+1');
    
    // Subgoal [1.2] should show: t(X1+1, Z) → t(X1+1, A) (Z is bound to A)
    expect(timeline[0].subgoals[1].goal).toContain('→');
    expect(timeline[0].subgoals[1].goal).toContain('t(X1+1,A)');
  });
});

describe('Nested timeline structure', () => {
  it('should nest children inside parent steps', () => {
    const events: TraceEvent[] = [
      { 
        port: 'call', 
        level: 33, 
        goal: 't(1+0+1+1,A)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1, Z)', body: 't(X+1, X1), t(X1+1, Z)', line: 28 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 't(1+0+1,X1)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 't(1+0+1,1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'call', 
        level: 34, 
        goal: 't(1+1+0+1,Z)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 34, 
        goal: 't(1+1+0+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+0+1, X+1+0)', body: 'true', line: 27 }
      },
      { 
        port: 'exit', 
        level: 33, 
        goal: 't(1+0+1+1,1+1+1+0)', 
        predicate: 't/2',
        clause: { head: 't(X+1+1, Z)', body: 't(X+1, X1), t(X1+1, Z)', line: 28 }
      },
    ];
    
    const builder = new TimelineBuilder(events);
    const nestedTimeline = builder.build();
    
    // Root level should have 1 step
    expect(nestedTimeline).toHaveLength(1);
    
    // Root step should have 2 children
    expect(nestedTimeline[0].children).toHaveLength(2);
    
    // Children should be the two subgoal calls
    expect(nestedTimeline[0].children[0].goal).toBe('t(1+0+1,X1)');
    expect(nestedTimeline[0].children[1].goal).toBe('t(1+1+0+1,Z)');
  });
});
