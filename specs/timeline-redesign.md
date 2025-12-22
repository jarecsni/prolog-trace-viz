# Timeline Redesign Specification

## Overview

Redesign the execution timeline to focus on query-level variable tracking and reduce technical noise. The goal is to help users understand how their query variables evolve through recursive execution, particularly the "Russian doll" pattern in list operations.

## Current Problems

1. **CALL/EXIT split creates noise**: Each goal execution shows as two separate steps (CALL + EXIT), making the timeline verbose and harder to follow.

2. **Lost query context**: Internal Prolog variables (`_1396`, `_2008`) are shown instead of the user's original query variables (X, A, Result), making it hard to track what the user actually cares about.

3. **Variable naming inconsistency**: Sometimes shows readable names (X, R, H, T), sometimes internal names (`_1396`), with no clear pattern.

4. **Russian doll pattern not visible**: In recursive list operations like `append([1,2], [3,4], X)`, the construction of `[1|?]` → `[1,2|?]` → `[1,2|[3,4]]` isn't clearly shown.

## Design Goals

### 1. Merge CALL/EXIT into Single Steps

**Current:**
```
Step 3: CALL append([],[3,4],_1224)
  Pattern Match: ...
  Clause: append([], L, L) [line 4] (fact)

Step 4: EXIT append([],[3,4],[3,4])
  Bindings: _1224 = [3,4]
  Returns to: Step 3
```

**Proposed:**
```
Step 3: append([], [3,4], R)
  Clause: append([], L, L) [line 4]
  Unifications: L = [3,4]
  Result: R = [3,4]
```

### 2. Restructure Step Content

Each step should show:
- **Goal**: What Prolog is solving (with readable variable names)
- **Clause**: Which clause matched (with line number)
- **Unifications**: Variable bindings from pattern matching
- **Subgoals**: List of spawned subgoals (for recursive clauses)
- **Result**: What got bound (for facts/completed goals)
- **Query Variable State**: Current value of the original query variable

### 3. Track Query-Level Variables

For query `append([1,2], [3,4], X)`:

```
Step 1: append([1,2], [3,4], X)
  Clause: append([H|T], L, [H|R]) :- append(T, L, R)
  Unifications: H=1, T=[2], L=[3,4]
  Subgoals: append([2], [3,4], R)
  X = [1 | ?]  ← Building the result

Step 2: append([2], [3,4], R)
  Clause: append([H|T], L, [H|R]) :- append(T, L, R)
  Unifications: H=2, T=[], L=[3,4]
  Subgoals: append([], [3,4], R)
  X = [1, 2 | ?]  ← Still building

Step 3: append([], [3,4], R)
  Clause: append([], L, L)
  Unifications: L=[3,4]
  Result: R = [3,4]
  X = [1, 2 | [3,4]]  ← Hole filled!

Step 4: Returning to Step 2
  Result: R = [2, 3, 4]
  X = [1 | [2, 3, 4]]  ← Simplifying

Step 5: Returning to Step 1
  Result: X = [1, 2, 3, 4]  ← Final answer
```

### 4. Variable Naming Strategy

**Priority order:**
1. Use original query variable names (X, A, Result)
2. Use clause variable names from source (H, T, L, R, N, N1)
3. Only use internal vars (`_NNNN`) when unavoidable

**Implementation approach:**
- Track variable substitution chain from query through all steps
- Maintain mapping: query var → intermediate vars → final value
- Show partial structures with `?` for unbound parts

## Technical Challenges

### Challenge 1: Variable Substitution Tracking

Need to build a chain:
- Query: `X`
- Step 1: `X` maps to `_1396` which is `[1|R]` where `R` is `_1304`
- Step 2: `_1304` is `[2|R]` where `R` is `_1224`
- Step 3: `_1224` = `[3,4]`
- Collapse back: `X = [1|[2|[3,4]]] = [1,2,3,4]`

**SOLUTION FOUND:**
The `parent_info.goal` field in trace events contains the partially constructed result! 

Example from append trace:
```
Level 33 CALL: append([1,2],[3,4],_79984)
  parent_info: (test_append - not useful)

Level 34 CALL: append([2],[3,4],_79854)
  parent_info.goal: append([1,2],[3,4],[1|_79854])  ← Shows [1|?] being built!

Level 35 CALL: append([],[3,4],_79774)
  parent_info.goal: append([2],[3,4],[2|_79774])  ← Shows [1,2|?] being built!

Level 35 EXIT: append([],[3,4],[3,4])
  parent_info.goal: append([2],[3,4],[2,3,4])  ← Hole filled: [1,2|[3,4]]

Level 34 EXIT: append([2],[3,4],[2,3,4])
  parent_info.goal: append([1,2],[3,4],[1,2,3,4])  ← Final result!
```

**Implementation approach:**
- Extract the third argument from parent_info.goal (the result being built)
- Track this through the recursion to show the "Russian doll" construction
- Map back to the original query variable name (X, not _79984)

### Challenge 2: Merging CALL/EXIT

Currently timeline builder processes CALL and EXIT as separate events. Need to:
- Match CALL with corresponding EXIT
- Combine information from both
- Handle cases where EXIT never happens (failure)

### Challenge 3: Partial Structure Representation

How to show `[1, 2 | ?]` clearly?
- Use `?` for unbound variables
- Show list construction syntax
- Simplify when possible: `[1|[2|[3,4]]]` → `[1,2,3,4]`

## Implementation Plan

### Phase 1: Investigation ✅ COMPLETE
- [x] Examine trace events from append example
- [x] Understand what variable information is available
- [x] Test if we can track query var through substitutions
- [x] Prototype variable chain tracking

**Findings:**
- Parent info contains partially constructed results
- All necessary data available in trace events
- Variable tracking is feasible via parent_info.goal

### Phase 2: Timeline Restructuring ✅ COMPLETE
- [x] Update TimelineStep interface to merge CALL/EXIT
- [x] Modify timeline builder to pair CALL/EXIT events
- [x] Extract query variable tracking from parent_info
- [x] Redesign step structure (goal, clause, unifications, result)
- [x] Update timeline formatter for new structure
- [x] Fix subgoal tracking for merged format
- [x] Add parent_info extraction to parser

**Completed:**
- Timeline now shows merged steps (3 instead of 6 for append)
- Each step shows: goal, clause, unifications, subgoals, result
- Subgoal labels working correctly
- Basic query variable tracking infrastructure in place
- Committed to feature branch: feature/timeline-redesign

### Phase 3: Variable Tracking (TODO)
- [ ] Refine query variable extraction to show intermediate construction
- [ ] Show partial structures with holes ([1|?] → [1,2|?] → [1,2,3,4])
- [ ] Map internal vars to query variable names
- [ ] Track variable flow through recursion properly

**Current state:**
- Query Variable field shows final results instead of intermediate construction
- Need to extract from CALL event's parent, not EXIT event's parent
- Need better logic to show the "Russian doll" building pattern

### Phase 4: Testing & Refinement (TODO)
- [ ] Test with append example
- [ ] Test with factorial example
- [ ] Test with operators example
- [ ] Refine variable naming strategy
- [ ] Update all example outputs
- [ ] Ensure all tests pass
- [ ] Merge to main branch

## Success Criteria

1. Timeline steps are ~50% fewer (CALL/EXIT merged)
2. User can track their query variable (X, A, etc.) at every step
3. Russian doll pattern is clearly visible in recursive list operations
4. Variable names are consistent and readable
5. All existing tests still pass

## Examples to Test

- `append([1,2], [3,4], X)` - list construction
- `factorial(3, X)` - numeric accumulation
- `member(X, [a,b,c])` - backtracking with variable
- `t(1+0+1+1+1, A)` - operator handling

## Open Questions

1. How to handle backtracking in merged CALL/EXIT format?
2. Should we show intermediate steps during ascent, or just final bindings?
3. How verbose should the "Query Variable State" be?
4. Do we need a flag to toggle between old/new format during transition?
