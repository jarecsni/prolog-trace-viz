import { describe, it, expect } from 'vitest';
import { formatTimeline, TimelineFormatterOptions } from './timeline-formatter.js';
import { TimelineStep } from './timeline.js';

describe('Timeline Formatter', () => {
  // Helper to create a minimal timeline step
  function createStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
    return {
      stepNumber: 1,
      port: 'merged',
      level: 1,
      goal: 't(1+0+1,_1234)',
      clause: {
        head: 't(X+0+1, X+1+0)',
        body: 'true',
        line: 27,
      },
      unifications: [{ variable: 'X', value: '1' }],
      subgoals: [],
      result: '1+1+0',
      children: [],
      ...overrides,
    };
  }

  describe('showInternalVars option', () => {
    it('uses clause variable Z for output when clause has simple variable', () => {
      // This tests the case where clause head has a simple variable (Z) as output
      const step = createStep({
        goal: 't(1+0+1+1+1,_2008)',
        clause: {
          head: 't(X+1+1, Z)',
          body: 't(X+1, X1), t(X1+1, Z)',
          line: 28,
        },
        result: '1+1+1+1+0',
      });

      const output = formatTimeline([step], { showInternalVars: false });
      
      // Should use Z instead of _2008 in header
      expect(output).toContain('t(1+0+1+1+1,Z)');
      // Result should use Z
      expect(output).toContain('=> Z = 1+1+1+1+0');
    });

    it('shows internal variable names when showInternalVars is true', () => {
      const step = createStep({
        goal: 't(1+0+1+1+1,_2008)',
        clause: {
          head: 't(X+1+1, Z)',
          body: 't(X+1, X1), t(X1+1, Z)',
          line: 28,
        },
        result: '1+1+1+1+0',
      });

      const output = formatTimeline([step], { showInternalVars: true });
      
      // Should show internal variable name
      expect(output).toContain('t(1+0+1+1+1,_2008)');
      // Result should use internal variable name
      expect(output).toContain('=> _2008 = 1+1+1+1+0');
    });

    it('keeps internal var when clause output is a pattern not a variable', () => {
      // For facts like t(X+0+1, X+1+0), the output is a pattern, not a simple variable
      // In this case we can't substitute, so we keep the internal name
      const step = createStep({
        goal: 't(1+0+1,_1234)',
        clause: {
          head: 't(X+0+1, X+1+0)',
          body: 'true',
          line: 27,
        },
        result: '1+1+0',
      });

      const output = formatTimeline([step], { showInternalVars: false });
      
      // Since X+1+0 is not a simple variable, we keep the internal name
      // but the result line should still work
      expect(output).toContain('=> ');
      expect(output).toContain('= 1+1+0');
    });
  });

  describe('subgoal binding context', () => {
    it('shows where clause for bindings from sibling steps', () => {
      const step = createStep({
        stepNumber: 4,
        goal: 't(1+1+0+1,_1624)',
        subgoalLabel: '[2.2]',
        subgoalTemplate: 't(X1+1, Z)',
        subgoalBindings: [{ variable: 'X1', value: '1+1+0', fromStep: 3 }],
        clause: {
          head: 't(X+0+1, X+1+0)',
          body: 'true',
          line: 27,
        },
        result: '1+1+1+0',
      });

      const output = formatTimeline([step]);
      
      // Should show the binding context
      expect(output).toContain('where X1 = 1+1+0 (from Step 3)');
      // Should show template → instantiated form
      expect(output).toContain('t(X1+1, Z) →');
    });
  });

  describe('nested steps', () => {
    it('formats nested children with proper indentation', () => {
      const child = createStep({
        stepNumber: 2,
        goal: 't(1+0+1,_1856)',
        subgoalLabel: '[1.1]',
      });

      const parent = createStep({
        stepNumber: 1,
        goal: 't(1+0+1+1,_1926)',
        children: [child],
        subgoals: [{ label: '[1.1]', goal: 't(X+1, X1) → t(1+0+1, X1)' }],
      });

      const output = formatTimeline([parent]);
      
      // Parent should be at root level
      expect(output).toContain('┌─ Step 1');
      // Child should be indented
      expect(output).toContain('│  ┌─ Step 2 [Goal 1.1]');
    });
  });
});
