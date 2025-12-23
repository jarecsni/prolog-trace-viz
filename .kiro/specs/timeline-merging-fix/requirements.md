# Requirements Document: Timeline Merging Fix for Recursive Predicates

## Introduction

The timeline builder currently has a critical bug where CALL/EXIT pairs are not correctly merged when multiple calls occur at the same recursion level. This causes steps to appear out of order and with incorrect step numbers, making traces impossible to follow for recursive predicates.

## Glossary

- **Timeline**: A flat, sequential list of execution steps showing the order in which goals are executed
- **CALL/EXIT Pair**: A matched pair of trace events where a CALL event represents entering a goal and EXIT represents successfully leaving it
- **Recursion Level**: The depth of the call stack (level 0 = top-level query, level 1 = first call, etc.)
- **Step Number**: Sequential numbering of timeline steps (1, 2, 3, ...) in execution order
- **Merged Step**: A single timeline step combining information from both CALL and EXIT events
- **Subgoal Label**: A reference like [1.1] or [2.3] indicating which parent step's subgoal is being solved

## Requirements

### Requirement 1: Correct Timeline Ordering

**User Story:** As a user tracing Prolog execution, I want timeline steps to appear in the order they were executed, so that I can follow the execution flow chronologically.

#### Acceptance Criteria

1. WHEN processing trace events, THE Timeline_Builder SHALL preserve the chronological order of execution
2. WHEN multiple CALL events occur at the same recursion level, THE Timeline_Builder SHALL maintain separate step entries for each call
3. WHEN displaying the timeline, THE Timeline_Builder SHALL number steps sequentially (1, 2, 3, ...) in execution order
4. FOR ALL recursive predicates, the timeline SHALL show steps in depth-first execution order

### Requirement 2: Unique CALL/EXIT Pair Tracking

**User Story:** As a developer debugging the timeline builder, I want each CALL event to be uniquely matched with its corresponding EXIT event, so that recursive calls at the same level don't overwrite each other.

#### Acceptance Criteria

1. THE Timeline_Builder SHALL NOT use recursion level alone as a unique identifier for CALL/EXIT pairs
2. WHEN multiple CALL events occur at the same level, THE Timeline_Builder SHALL track each call separately
3. WHEN matching CALL and EXIT events, THE Timeline_Builder SHALL use a combination of level and original step number
4. FOR ALL CALL events, there SHALL be at most one corresponding EXIT event in the merged timeline

### Requirement 3: Correct Subgoal Label Assignment

**User Story:** As a user following subgoal execution, I want subgoal labels like [1.1] to correctly identify which parent step's subgoal is being solved, so that I can trace the relationship between parent and child goals.

#### Acceptance Criteria

1. WHEN a step is solving a subgoal, THE Timeline_Builder SHALL assign the correct subgoal label based on the parent step
2. WHEN displaying subgoal labels, THE Timeline_Builder SHALL use the format [parent_step.subgoal_index]
3. FOR ALL subgoal labels, the parent step number SHALL refer to an earlier step in the timeline
4. WHEN a parent has multiple subgoals, THE Timeline_Builder SHALL track which subgoal is currently being solved

### Requirement 4: Instantiated Subgoal Display

**User Story:** As a user reading the timeline, I want to see what the actual subgoal calls will be after variable substitution, so that I can understand what goals will actually execute.

#### Acceptance Criteria

1. WHEN displaying subgoals in a step, THE Timeline_Builder SHALL show both the template from the clause and the instantiated form
2. WHEN variables are bound at the time of subgoal display, THE Timeline_Builder SHALL substitute those bindings into the subgoal
3. WHEN variables are not yet bound, THE Timeline_Builder SHALL indicate this clearly (e.g., "X1 not yet bound")
4. THE Timeline_Builder SHALL use the format: `[1.1] template → instantiated` for subgoal display

### Requirement 5: Non-Recursive Predicate Support

**User Story:** As a user tracing non-recursive predicates, I want the timeline to work correctly for simple, non-recursive code, so that the fix doesn't break existing functionality.

#### Acceptance Criteria

1. WHEN processing non-recursive predicates, THE Timeline_Builder SHALL produce correct step ordering
2. WHEN processing non-recursive predicates, THE Timeline_Builder SHALL correctly merge CALL/EXIT pairs
3. FOR ALL non-recursive predicates, the timeline SHALL show steps in execution order
4. THE Timeline_Builder SHALL handle both recursive and non-recursive predicates correctly

### Requirement 6: Comprehensive Test Coverage

**User Story:** As a developer maintaining the timeline builder, I want comprehensive unit tests for both recursive and non-recursive cases, so that regressions are caught early.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests for non-recursive predicate timeline merging
2. THE test suite SHALL include unit tests for recursive predicate timeline merging
3. THE test suite SHALL include unit tests for multiple calls at the same recursion level
4. THE test suite SHALL include unit tests for correct subgoal label assignment
5. THE test suite SHALL include unit tests for instantiated subgoal display
6. FOR ALL timeline merging logic changes, corresponding unit tests SHALL be added before implementation

### Requirement 7: Operator Expression Handling

**User Story:** As a user tracing predicates with operator expressions (like `1+0+1+1+1`), I want to see the actual term structure that Prolog is using, so that I understand how operator associativity affects execution.

#### Acceptance Criteria

1. WHEN displaying goals with operator expressions, THE Timeline_Builder SHALL show the goal as Prolog represents it internally
2. WHEN operator associativity creates different term structures, THE Timeline_Builder SHALL display these accurately
3. THE Timeline_Builder SHALL NOT attempt to "normalize" or "fix" operator expressions
4. WHERE users need to understand term structure, THE Timeline_Builder SHALL optionally display canonical form (e.g., `+(+(1,0),1)`)

## Test Cases

### Test Case 1: Simple Non-Recursive Predicate

```prolog
fact(a, 1).
fact(b, 2).
```

Query: `fact(a, X)`

Expected timeline:
- Step 1: `fact(a, X)` matches `fact(a, 1)`, result: `X = 1`

### Test Case 2: Simple Recursive Predicate (append)

```prolog
append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).
```

Query: `append([1,2], [3,4], X)`

Expected timeline:
- Step 1: `append([1,2], [3,4], X)` with subgoals [1.1]
- Step 2: `append([2], [3,4], R)` solving [1.1], with subgoals [2.1]
- Step 3: `append([], [3,4], R2)` solving [2.1], result: `R2 = [3,4]`

### Test Case 3: Multiple Calls at Same Level (operators)

```prolog
t(0+1, 1+0).
t(X+0+1, X+1+0).
t(X+1+1, Z) :- t(X+1, X1), t(X1+1, Z).
```

Query: `t(1+0+1+1, A)`

Expected timeline:
- Step 1: `t(1+0+1+1, A)` matches clause 3 with `X = 1+0`, subgoals [1.1], [1.2]
- Step 2: `t(1+0+1, X1)` solving [1.1], matches clause 2, result: `X1 = 1+1+0`
- Step 3: `t(1+1+0+1, Z)` solving [1.2], matches clause 2, result: `Z = 1+1+1+0`

### Test Case 4: Deep Recursion

```prolog
factorial(0, 1).
factorial(N, F) :- N > 0, N1 is N - 1, factorial(N1, F1), F is N * F1.
```

Query: `factorial(3, X)`

Expected timeline:
- Step 1: `factorial(3, X)` with subgoals
- Step 2: `factorial(2, F1)` solving subgoal
- Step 3: `factorial(1, F2)` solving subgoal
- Step 4: `factorial(0, F3)` solving subgoal, result: `F3 = 1`

All steps should be in order 1, 2, 3, 4 (not 1, 4, 2, 3 or any other scrambled order).

## Notes

- The current bug manifests when `callStepMap` and `exitStepMap` use level as the key, causing later calls at the same level to overwrite earlier ones
- The fix requires tracking CALL/EXIT pairs by a unique identifier that doesn't collide across multiple calls at the same level
- Instantiated subgoal display is a separate enhancement but should be included in this fix to improve usability
- Operator expressions like `1+0+1+1+1` are correctly represented by Prolog's tracer - we should display them as-is, not try to "fix" them
