# Nested Timeline Redesign

## Problem Statement

The current timeline format shows steps sequentially with a flat structure. This creates two issues:

1. **Premature query variable display**: Step 1 shows `A = 1+1+1+1+0` before the subgoals that compute this value are shown
2. **Lost hierarchy**: The parent-child relationship between calls is only indicated by `◀── Solving subgoal [X.Y]` markers, which requires mental reconstruction

## Proposed Solution

Restructure the timeline to nest child steps inside their parent steps, visually representing the call stack depth.

## Current Format

```
┌─ Step 1: t(1+0+1+1+1,_2008)
│  Clause: t(X+1+1, Z) [line 28]
│  Subgoals: [1.1] t(X+1, X1), [1.2] t(X1+1, Z)
│  Result: 1+1+1+1+0
│  Query Variable: A = 1+1+1+1+0
└─

┌─ Step 2: t(1+0+1+1,_1926)
│  ◀── Solving subgoal [1.1]
│  Clause: t(X+1+1, Z) [line 28]
│  ...
└─
```

## Proposed Format

```
┌─ Step 1: t(1+0+1+1+1,_2008)
│  Clause: t(X+1+1, Z) [line 28]
│  Unifications: X = 1+0+1, Z = _2008
│  Subgoals: [1.1] t(X+1, X1), [1.2] t(X1+1, Z)
│  
│  ┌─ Step 2: t(1+0+1+1,_1926)  ◀── [1.1]
│  │  Clause: t(X+1+1, Z) [line 28]
│  │  Unifications: X = 1+0, Z = _1926
│  │  Subgoals: [2.1] t(X+1, X1), [2.2] t(X1+1, Z)
│  │  
│  │  ┌─ Step 3: t(1+0+1,_1856)  ◀── [2.1]
│  │  │  Fact: t(X+0+1, X+1+0) [line 27]
│  │  │  Unifications: X = 1
│  │  │  Result: 1+1+0
│  │  └─
│  │  
│  │  ┌─ Step 4: t(1+1+0+1,_1624)  ◀── [2.2]
│  │  │  Fact: t(X+0+1, X+1+0) [line 27]
│  │  │  Unifications: X = 1+1
│  │  │  Result: 1+1+1+0
│  │  └─
│  │  
│  │  Result: 1+1+1+0
│  └─
│  
│  ┌─ Step 5: t(1+1+1+0+1,_1134)  ◀── [1.2]
│  │  Fact: t(X+0+1, X+1+0) [line 27]
│  │  Unifications: X = 1+1+1
│  │  Result: 1+1+1+1+0
│  └─
│  
│  Result: 1+1+1+1+0
│  Query Variable: A = 1+1+1+1+0
└─
```

## Key Benefits

1. **Correct timing of query variable display**: Only shown when the outermost step completes
2. **Visual call stack**: Indentation shows depth naturally
3. **Clear parent-child relationships**: Children are literally inside their parents
4. **Matches mental model**: Reflects how Prolog actually executes (depth-first)

## Implementation Approach

### Data Structure Changes

The `TimelineStep` interface may need to include children:

```typescript
interface TimelineStep {
  stepNumber: number;
  goal: string;
  clauseInfo: ClauseInfo;
  unifications: Unification[];
  subgoals: Subgoal[];
  result: string;
  children: TimelineStep[];  // NEW: nested child steps
  parentSubgoalRef?: string; // e.g., "[1.1]" - which subgoal this solves
}
```

### Timeline Builder Changes

Instead of building a flat array, build a tree:

1. Track the call stack (array of step references)
2. On CALL: create new step, push to current parent's children (or root if no parent)
3. On EXIT: pop from stack, set result
4. Return root-level steps only

### Formatter Changes

The `timeline-formatter.ts` needs recursive rendering:

```typescript
function formatStep(step: TimelineStep, depth: number): string {
  const indent = '│  '.repeat(depth);
  let output = '';
  
  // Render step header, clause, unifications, subgoals
  output += `${indent}┌─ Step ${step.stepNumber}: ${step.goal}\n`;
  // ... other fields ...
  
  // Render children recursively
  for (const child of step.children) {
    output += formatStep(child, depth + 1);
  }
  
  // Render result (after children)
  output += `${indent}│  Result: ${step.result}\n`;
  output += `${indent}└─\n`;
  
  return output;
}
```

## Edge Cases

### Failures and Backtracking

- Failed attempts should still be shown nested
- Backtracking creates siblings at the same level
- May need visual distinction for failed vs successful branches

### Very Deep Recursion

- At some depth (e.g., 10+), indentation becomes unwieldy
- Options:
  - Collapse deeply nested steps with `[... N more levels ...]`
  - Add a `--max-depth` CLI option
  - Use a more compact format at depth

### Multiple Solutions

- Each solution attempt is a separate tree
- Keep existing "Showing first solution only" behaviour initially

## Migration Path

1. **Phase 1**: Implement nested timeline structure
2. **Phase 2**: Add `--no-diagram` CLI flag (diagram becomes optional)
3. **Phase 3**: Consider deprecating diagram entirely

## Files to Modify

- `src/timeline.ts` - Build tree structure instead of flat array
- `src/timeline-formatter.ts` - Recursive rendering with indentation
- `src/variable-tracker.ts` - May need adjustment for when bindings are shown
- `src/markdown-generator.ts` - Pass nested structure to formatter

## Testing Strategy

- Update existing timeline tests for nested structure
- Add tests for deep recursion handling
- Add tests for failure/backtracking scenarios
- Regenerate all examples after implementation
