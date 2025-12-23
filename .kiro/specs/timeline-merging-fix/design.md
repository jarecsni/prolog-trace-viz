# Design Document: Timeline Merging Fix for Recursive Predicates

## Overview

This document describes the design for fixing the timeline merging bug where CALL/EXIT pairs are incorrectly matched when multiple calls occur at the same recursion level. The current implementation uses recursion level alone as a map key, causing later calls to overwrite earlier calls.

## Problem Analysis

### Current Implementation (Buggy)

```typescript
// In mergeCallExitPairs():
const callStepMap = new Map<number, TimelineStep>();  // level -> CALL step
const exitStepMap = new Map<number, TimelineStep>();  // level -> EXIT step

for (const step of this.steps) {
  if (step.port === 'call') {
    callStepMap.set(step.level, step);  // ← BUG: overwrites previous call at same level!
  }
}
```

### Why This Fails

For the operators example with query `t(1+0+1+1+1, A)`:

```
Step 1 (level 33): CALL t(1+0+1+1+1, _2008)     → callStepMap[33] = Step 1
Step 2 (level 34): CALL t(1+0+1, _1926)         → callStepMap[34] = Step 2
Step 3 (level 35): CALL t(1+1, _1856)           → callStepMap[35] = Step 3
Step 4 (level 35): EXIT t(1+1, 1+1+0)           → matches Step 3 ✓
Step 5 (level 34): CALL t(1+1+0+1, _1624)       → callStepMap[34] = Step 5 (OVERWRITES Step 2!)
Step 6 (level 34): EXIT t(1+1+0+1, 1+1+1+0)     → matches Step 5 ✓ (but should be Step 2's EXIT)
Step 7 (level 33): EXIT t(1+0+1+1+1, ...)       → matches Step 1 ✓
Step 8 (level 34): CALL t(1+1+1+0+1, _1134)     → callStepMap[34] = Step 8 (OVERWRITES Step 5!)
Step 9 (level 34): EXIT t(1+1+1+0+1, ...)       → matches Step 8 ✓
```

Result: Steps 2 and 5 are lost from the timeline because they were overwritten in the map!

## Design Solution

### Core Principle

**Don't use maps at all - iterate through steps sequentially.** The steps are already created in chronological order by `processEvent()`. The bug is in the merging phase where we try to build level-based maps.

Key insights:
1. Steps are already in chronological order (created by `processEvent()` as events arrive)
2. The `returnsTo` field is already correct (set by `processExit()` using the call stack)
3. We just need to iterate through steps in order and merge CALL/EXIT pairs

### Why `returnsTo` is Already Correct

The `processExit()` method uses `callStack.get(event.level)` to set `returnsTo`. The call stack is updated as we process events:
- `processCall()`: adds `callStack.set(event.level, stepNumber)`
- `processExit()`: reads `callStack.get(event.level)` then removes it

Because Prolog execution is stack-based, when we EXIT at level N, we're always exiting the most recent CALL at level N. The call stack correctly tracks this.

### New Algorithm (Simpler!)

```typescript
private mergeCallExitPairs(): void {
  const mergedSteps: TimelineStep[] = [];
  const processedSteps = new Set<number>();  // Track which steps we've merged
  
  // Initialize binding tracker
  let bindingTracker: VariableBindingTracker | undefined;
  if (this.originalQuery) {
    bindingTracker = new VariableBindingTracker(this.originalQuery);
  }
  
  // Build event map for binding tracker
  const stepToEventMap = new Map<number, TraceEvent>();
  for (const event of this.events) {
    if (this.isTracerPredicate(event.predicate)) continue;
    
    // Find step for this event (match by level, goal, port)
    const step = this.steps.find(s => 
      s.level === event.level && 
      s.goal === event.goal && 
      s.port === event.port
    );
    
    if (step) {
      stepToEventMap.set(step.stepNumber, event);
    }
  }
  
  // Process steps in their original chronological order
  for (const step of this.steps) {
    if (processedSteps.has(step.stepNumber)) continue;
    
    if (step.port === 'call') {
      // Process CALL event in binding tracker
      const event = stepToEventMap.get(step.stepNumber);
      if (event && bindingTracker) {
        bindingTracker.processEvent(event);
      }
      
      // Find matching EXIT by looking forward
      const exitStep = this.findMatchingExit(step);
      
      if (exitStep) {
        // Process EXIT event in binding tracker
        const exitEvent = stepToEventMap.get(exitStep.stepNumber);
        if (exitEvent && bindingTracker) {
          bindingTracker.processEvent(exitEvent);
        }
        
        // Merge CALL and EXIT into single step
        const mergedStep: TimelineStep = {
          ...step,
          port: 'merged',
          result: this.extractResult(exitStep.goal),
        };
        
        // Get query variable state
        if (bindingTracker) {
          const queryVarState = bindingTracker.getQueryVarState(step.level);
          if (queryVarState) {
            mergedStep.queryVarState = queryVarState;
          }
        }
        
        mergedSteps.push(mergedStep);
        processedSteps.add(step.stepNumber);
        processedSteps.add(exitStep.stepNumber);
      } else {
        // CALL without EXIT (failed goal)
        mergedSteps.push(step);
        processedSteps.add(step.stepNumber);
      }
    } else if (step.port === 'exit') {
      // EXIT already processed as part of CALL merge, skip
      continue;
    } else if (step.port === 'redo' || step.port === 'fail') {
      // Keep REDO/FAIL steps as-is
      mergedSteps.push(step);
      processedSteps.add(step.stepNumber);
    }
  }
  
  // Renumber steps to be continuous (1, 2, 3, ...)
  mergedSteps.forEach((step, index) => {
    step.stepNumber = index + 1;
  });
  
  this.steps = mergedSteps;
}
```

### Helper Method (Reuse Existing)

The existing `findMatchingExit()` method already does what we need:

```typescript
/**
 * Find the matching EXIT step for a CALL step
 */
private findMatchingExit(callStep: TimelineStep, startIndex: number): TimelineStep | null {
  // Look forward from the CALL to find the matching EXIT
  // The EXIT should be at the same level and return to this CALL
  for (let i = startIndex + 1; i < this.steps.length; i++) {
    const step = this.steps[i];
    
    if (step.port === 'exit' && 
        step.level === callStep.level && 
        step.returnsTo === callStep.stepNumber) {
      return step;
    }
  }
  
  return null;
}
```

We just need to modify it slightly to not require `startIndex` (we can search the whole array):

```typescript
/**
 * Find the matching EXIT step for a CALL step
 */
private findMatchingExitForMerging(callStep: TimelineStep): TimelineStep | undefined {
  // Look through all steps to find the matching EXIT
  // The EXIT should return to this CALL's step number
  return this.steps.find(step => 
    step.port === 'exit' && 
    step.returnsTo === callStep.stepNumber
  );
}
```

## Instantiated Subgoal Display

### Current Display

```
Subgoals:
  [1.1] t(X+1, X1)
  [1.2] t(X1+1, Z)
```

### Enhanced Display

Show both the template and the instantiated form:

```
Subgoals:
  [1.1] t(X+1, X1) → t(1+0+1+1, X1)
  [1.2] t(X1+1, Z) → t(X1+1, Z)  (X1 not yet bound)
```

### Implementation

```typescript
/**
 * Format subgoal with instantiation
 */
private formatSubgoalWithInstantiation(
  subgoalTemplate: string,
  unifications: Array<{ variable: string; value: string }>
): string {
  // Substitute known bindings into the template
  let instantiated = subgoalTemplate;
  
  for (const { variable, value } of unifications) {
    // Replace variable with value (respecting word boundaries)
    const regex = new RegExp(`\\b${variable}\\b`, 'g');
    instantiated = instantiated.replace(regex, value);
  }
  
  // If instantiated differs from template, show both
  if (instantiated !== subgoalTemplate) {
    return `${subgoalTemplate} → ${instantiated}`;
  }
  
  return subgoalTemplate;
}

/**
 * Update subgoal display with instantiation
 */
private updateSubgoalDisplay(): void {
  for (const step of this.steps) {
    if (step.subgoals.length > 0 && step.unifications.length > 0) {
      step.subgoals = step.subgoals.map(subgoal => ({
        label: subgoal.label,
        goal: this.formatSubgoalWithInstantiation(subgoal.goal, step.unifications),
      }));
    }
  }
}
```

Call this method after `mergeCallExitPairs()` and before `updateSubgoalTracking()`.

## Subgoal Label Correctness

### Current Issue

Subgoal labels are assigned incorrectly because steps are processed out of order.

### Solution

The `updateSubgoalTracking()` method already has the right logic, but it needs to work with correctly ordered steps. Once we fix the merging algorithm to preserve chronological order, the subgoal tracking will work correctly.

### Verification

After the fix, for the operators example:

```
Step 1: t(1+0+1+1+1, A)
  Subgoals: [1.1] t(X+1, X1) → t(1+0+1+1, X1)
            [1.2] t(X1+1, Z)

Step 2: t(1+0+1+1, X1)  ◀── Solving subgoal [1.1]
  Subgoals: [2.1] t(X+1, X2) → t(1+0+1, X2)
            [2.2] t(X2+1, X1)

Step 3: t(1+0+1, X2)  ◀── Solving subgoal [2.1]
  Result: X2 = 1+1+0

Step 4: t(1+1+0+1, X1)  ◀── Solving subgoal [2.2]
  Result: X1 = 1+1+1+0

Step 5: t(1+1+1+0+1, Z)  ◀── Solving subgoal [1.2]
  Result: Z = 1+1+1+1+0
```

## Testing Strategy

### Unit Tests

Create `src/timeline.test.ts` with the following test cases:

#### Test 1: Non-Recursive Predicate

```typescript
describe('Timeline merging - non-recursive', () => {
  it('should merge CALL/EXIT pairs in correct order', () => {
    const events: TraceEvent[] = [
      { port: 'call', level: 33, goal: 'fact(a, X)', predicate: 'fact/2' },
      { port: 'exit', level: 33, goal: 'fact(a, 1)', predicate: 'fact/2' },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = builder.build();
    
    expect(timeline).toHaveLength(1);
    expect(timeline[0].port).toBe('merged');
    expect(timeline[0].stepNumber).toBe(1);
    expect(timeline[0].result).toBe('1');
  });
});
```

#### Test 2: Simple Recursive Predicate (append)

```typescript
describe('Timeline merging - recursive', () => {
  it('should preserve chronological order for recursive calls', () => {
    // Events for: append([1,2], [3,4], X)
    const events: TraceEvent[] = [
      { port: 'call', level: 33, goal: 'append([1,2],[3,4],X)', predicate: 'append/3' },
      { port: 'call', level: 34, goal: 'append([2],[3,4],R)', predicate: 'append/3' },
      { port: 'call', level: 35, goal: 'append([],[3,4],R2)', predicate: 'append/3' },
      { port: 'exit', level: 35, goal: 'append([],[3,4],[3,4])', predicate: 'append/3' },
      { port: 'exit', level: 34, goal: 'append([2],[3,4],[2,3,4])', predicate: 'append/3' },
      { port: 'exit', level: 33, goal: 'append([1,2],[3,4],[1,2,3,4])', predicate: 'append/3' },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = builder.build();
    
    expect(timeline).toHaveLength(3);
    expect(timeline[0].stepNumber).toBe(1);
    expect(timeline[1].stepNumber).toBe(2);
    expect(timeline[2].stepNumber).toBe(3);
    expect(timeline[0].goal).toContain('append([1,2]');
    expect(timeline[1].goal).toContain('append([2]');
    expect(timeline[2].goal).toContain('append([]');
  });
});
```

#### Test 3: Multiple Calls at Same Level (operators)

```typescript
describe('Timeline merging - multiple calls at same level', () => {
  it('should not overwrite calls at the same recursion level', () => {
    // Simplified events for: t(1+0+1+1, A)
    const events: TraceEvent[] = [
      { port: 'call', level: 33, goal: 't(1+0+1+1,A)', predicate: 't/2' },
      { port: 'call', level: 34, goal: 't(1+0+1,X1)', predicate: 't/2' },
      { port: 'exit', level: 34, goal: 't(1+0+1,1+1+0)', predicate: 't/2' },
      { port: 'call', level: 34, goal: 't(1+1+0+1,Z)', predicate: 't/2' },  // Same level as step 2!
      { port: 'exit', level: 34, goal: 't(1+1+0+1,1+1+1+0)', predicate: 't/2' },
      { port: 'exit', level: 33, goal: 't(1+0+1+1,1+1+1+0)', predicate: 't/2' },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = builder.build();
    
    // Should have 3 merged steps (not 2!)
    expect(timeline).toHaveLength(3);
    
    // Steps should be in order 1, 2, 3
    expect(timeline[0].stepNumber).toBe(1);
    expect(timeline[1].stepNumber).toBe(2);
    expect(timeline[2].stepNumber).toBe(3);
    
    // Step 2 should be t(1+0+1,X1)
    expect(timeline[1].goal).toContain('t(1+0+1');
    
    // Step 3 should be t(1+1+0+1,Z)
    expect(timeline[2].goal).toContain('t(1+1+0+1');
  });
});
```

#### Test 4: Subgoal Label Assignment

```typescript
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
      { port: 'call', level: 34, goal: 't(1+0+1,X1)', predicate: 't/2' },
      { port: 'exit', level: 34, goal: 't(1+0+1,1+1+0)', predicate: 't/2' },
      { port: 'call', level: 34, goal: 't(1+1+0+1,Z)', predicate: 't/2' },
      { port: 'exit', level: 34, goal: 't(1+1+0+1,1+1+1+0)', predicate: 't/2' },
      { port: 'exit', level: 33, goal: 't(1+0+1+1,1+1+1+0)', predicate: 't/2' },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = builder.build();
    
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
```

#### Test 5: Instantiated Subgoal Display

```typescript
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
      { port: 'exit', level: 33, goal: 't(1+0+1+1,1+1+1+0)', predicate: 't/2' },
    ];
    
    const builder = new TimelineBuilder(events);
    const timeline = builder.build();
    
    // Subgoal [1.1] should show: t(X+1, X1) → t(1+0+1+1, X1)
    expect(timeline[0].subgoals[0].goal).toContain('→');
    expect(timeline[0].subgoals[0].goal).toContain('t(1+0+1+1');
    
    // Subgoal [1.2] should show: t(X1+1, Z) (X1 not yet bound)
    expect(timeline[0].subgoals[1].goal).toContain('t(X1+1');
  });
});
```

### Property-Based Tests

Add property-based tests to verify correctness properties:

```typescript
describe('Timeline merging - properties', () => {
  it('should preserve step count (CALL+EXIT pairs become single merged steps)', () => {
    fc.assert(
      fc.property(
        fc.array(generateTraceEvent()),
        (events) => {
          const builder = new TimelineBuilder(events);
          const timeline = builder.build();
          
          const callCount = events.filter(e => e.port === 'call').length;
          const exitCount = events.filter(e => e.port === 'exit').length;
          const mergedCount = Math.min(callCount, exitCount);
          const failedCalls = callCount - mergedCount;
          
          expect(timeline.length).toBe(mergedCount + failedCalls);
        }
      )
    );
  });
  
  it('should maintain chronological order (step N comes before step N+1)', () => {
    fc.assert(
      fc.property(
        fc.array(generateTraceEvent()),
        (events) => {
          const builder = new TimelineBuilder(events);
          const timeline = builder.build();
          
          for (let i = 1; i < timeline.length; i++) {
            expect(timeline[i].stepNumber).toBeGreaterThan(timeline[i-1].stepNumber);
          }
        }
      )
    );
  });
  
  it('should assign unique step numbers', () => {
    fc.assert(
      fc.property(
        fc.array(generateTraceEvent()),
        (events) => {
          const builder = new TimelineBuilder(events);
          const timeline = builder.build();
          
          const stepNumbers = timeline.map(s => s.stepNumber);
          const uniqueStepNumbers = new Set(stepNumbers);
          
          expect(uniqueStepNumbers.size).toBe(stepNumbers.length);
        }
      )
    );
  });
});
```

## Implementation Plan

1. **Create comprehensive unit tests** (Test-Driven Development)
   - Write all test cases described above
   - Run tests to confirm they fail (red phase)

2. **Implement the fix in `src/timeline.ts`**
   - Replace `mergeCallExitPairs()` with new simpler algorithm
   - Add `findMatchingExitForMerging()` helper method
   - Add `formatSubgoalWithInstantiation()` method
   - Add `updateSubgoalDisplay()` method
   - Call `updateSubgoalDisplay()` after merging, before subgoal tracking

3. **Run tests to verify fix** (green phase)
   - All unit tests should pass
   - Property-based tests should pass

4. **Update timeline formatter** (if needed)
   - Modify `src/timeline-formatter.ts` to display instantiated subgoals
   - Show both template and instantiated form

5. **Regenerate examples**
   - Run `./regenerate_examples.sh`
   - Verify operators example shows correct step ordering (1, 2, 3, ...)
   - Verify subgoal labels are correct

6. **Manual verification**
   - Test with operators example: `t(1+0+1+1+1, A)`
   - Test with append example: `append([1,2], [3,4], X)`
   - Test with factorial example: `factorial(3, X)`

## Success Criteria

- [ ] All unit tests pass
- [ ] Property-based tests pass
- [ ] Operators example shows steps in order: 1, 2, 3, 4, 5 (not 1, 8, 5)
- [ ] Subgoal labels correctly reference parent steps
- [ ] Instantiated subgoals show variable substitutions
- [ ] No steps are lost during merging
- [ ] Timeline preserves chronological execution order

## Notes

- The fix is simpler than initially thought - no need for complex event-to-step matching
- Steps are already in chronological order from `processEvent()`
- The `returnsTo` field is already correct (set by stack-based execution model)
- We just need to iterate through steps sequentially and merge CALL/EXIT pairs
- The key insight: don't build maps, just iterate and match using `returnsTo`
- After merging, renumber steps to be continuous (1, 2, 3, ...) for clarity
- Instantiated subgoal display is an enhancement, not strictly required for the bug fix
