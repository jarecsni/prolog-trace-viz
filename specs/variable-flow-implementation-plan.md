# Variable Flow Tracking Implementation Plan

## Context

This document provides a complete implementation plan for Task 28 (Variable Flow Tracking) in the Prolog trace visualization system. This task was deferred during Phase 3 because it appeared to require heuristics. However, we've determined it CAN be implemented without heuristics by extending the tracer to capture unification information directly from Prolog's execution state.

## Current State

**What's Working:**
- Source variable names displayed in clause heads (X, Z not _578, _568) ✅
- Pattern match binding extraction (X = 0 not X+1+1 = 0+1+1) ✅
- Subgoal tracking markers (Solving/Completed subgoal [1.1]) ✅
- Tree visualization with clause numbers and actual subgoal content ✅
- All cross-references and step numbering ✅

**What's Missing (Requirement 10):**
- 10.1: Show bindings in EXIT step ✅ (partially - shows bindings but not flow)
- 10.2: Show substituted values in subsequent subgoals ❌
- 10.3: Display variables with current bindings in subgoal calls ❌
- 10.4: Use consistent naming for shared variables ❌
- 10.5: Add notes indicating where values came from ❌
- 10.6: Show clause variables consistently across subgoals ❌
- 10.7: Show which variable was substituted in next subgoal ❌

## The Problem

**Current limitation:** The tracer provides runtime goals with mangled variables (`_1606`, `_1428`), but we need to track how source variables (`N1`, `R1`) flow between steps.

**Example of what's missing:**
```
Current output:
  Step 5: EXIT 2 is 3+ -1
    Returns to: Step 4
    Next: Subgoal [1.3]

Desired output:
  Step 5: EXIT 2 is 3+ -1
    Bindings: N1 = 2
    Returns to: Step 4
    Note: N1 from Step 1 is now bound to 2
    Next: Subgoal [1.3] with N1 substituted
```

## The Solution: Extend the Tracer

We can capture unification information directly from Prolog's execution state using frame attributes available in `prolog_trace_interception/4`.

### Available Frame Attributes

```
prolog_frame_attribute(Frame, goal, Goal)           - Current goal
prolog_frame_attribute(Frame, level, Level)         - Stack depth
prolog_frame_attribute(Frame, clause, ClauseRef)    - Clause reference
prolog_frame_attribute(Frame, parent, ParentFrame)  - Parent frame
prolog_frame_attribute(Frame, argument(N), Arg)     - Nth argument
prolog_frame_attribute(Frame, parent_goal, PGoal)   - Parent's goal
```

### Enhanced Trace Event Format

**Current format:**
```
{
  "port": "call",
  "level": 11,
  "goal": "factorial(2, _1428)",
  "predicate": "factorial/2",
  "clause": {
    "head": "factorial(N, R)",
    "body": "N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1",
    "line": 5
  }
}
```

**Enhanced format:**
```
{
  "port": "call",
  "level": 11,
  "goal": "factorial(2, _1428)",
  "predicate": "factorial/2",
  "clause": {
    "head": "factorial(N, R)",
    "body": "N > 0, N1 is N - 1, factorial(N1, R1), R is N * R1",
    "line": 5,
    "head_unifications": [
      {"clause_var": "N", "value": "2"},
      {"clause_var": "R", "value": "_1428"}
    ]
  },
  "parent_info": {
    "level": 10,
    "goal": "factorial(3, _1606)",
    "solving_subgoal_index": 3
  }
}
```

## Implementation Steps

### Phase 1: Extend tracer.pl

**File:** `tracer.pl`

**Changes needed:**

1. **Capture clause head unifications at CALL port**
   - Extract clause head variables
   - Match them with goal arguments
   - Export as `head_unifications` array

2. **Capture parent frame information**
   - Get parent frame using `prolog_frame_attribute(Frame, parent, ParentFrame)`
   - Get parent goal
   - Determine which subgoal index is being solved

3. **Export enhanced JSON format**
   - Add `head_unifications` field to clause object
   - Add `parent_info` field to event

**Implementation approach:**
```
% At CALL port, extract head unifications
extract_head_unifications(Frame, ClauseRef, Unifications) :-
    prolog_frame_attribute(Frame, goal, Goal),
    clause(ClauseHead, _, ClauseRef),
    Goal =.. [Functor|GoalArgs],
    ClauseHead =.. [Functor|ClauseArgs],
    match_arguments(ClauseArgs, GoalArgs, Unifications).

match_arguments([], [], []).
match_arguments([CArg|CArgs], [GArg|GArgs], [Unif|Unifs]) :-
    term_to_atom(CArg, CVarName),
    term_to_atom(GArg, Value),
    Unif = json([clause_var=CVarName, value=Value]),
    match_arguments(CArgs, GArgs, Unifs).
```

**Testing:**
- Run tracer on factorial example
- Verify JSON output includes `head_unifications`
- Verify parent_info is captured correctly

### Phase 2: Update TypeScript Parser

**File:** `src/parser.ts`

**Changes needed:**

1. **Update TraceEvent interface**
   ```
   interface TraceEvent {
     port: 'call' | 'exit' | 'redo' | 'fail';
     level: number;
     goal: string;
     predicate: string;
     clause?: {
       head: string;
       body: string;
       line: number;
       head_unifications?: Array<{
         clause_var: string;
         value: string;
       }>;
     };
     parent_info?: {
       level: number;
       goal: string;
       solving_subgoal_index: number;
     };
   }
   ```

2. **Parse enhanced JSON format**
   - Handle new `head_unifications` field
   - Handle new `parent_info` field
   - Maintain backward compatibility with old format

**Testing:**
- Unit test parsing of enhanced JSON
- Verify all fields are correctly extracted

### Phase 3: Build Variable Binding Context

**File:** `src/timeline.ts`

**Changes needed:**

1. **Create VariableBindingContext class**
   ```
   class VariableBindingContext {
     private bindings: Map<number, Map<string, string>>;  // step -> var -> value
     private origins: Map<string, number>;                 // var -> step where bound
     
     recordBinding(step: number, clauseVar: string, value: string): void
     getBinding(step: number, clauseVar: string): string | undefined
     getOrigin(clauseVar: string): number | undefined
     findSubstitutions(parentStep: number, childStep: number, subgoalPattern: string): Array<{var: string, value: string, origin: number}>
   }
   ```

2. **Track bindings during timeline building**
   - At CALL: Record head_unifications in context
   - At EXIT: Record final bindings in context
   - Track which step each variable was bound at

3. **Generate flow notes**
   - At EXIT: Add "Note: X1 from Step N is now bound to VALUE"
   - At CALL: Add "Note: N1 from Step 1 was substituted → 2"

**Implementation approach:**
```
// At CALL port
if (event.clause?.head_unifications) {
  for (const unif of event.clause.head_unifications) {
    this.bindingContext.recordBinding(stepNumber, unif.clause_var, unif.value);
  }
}

// At EXIT port
if (event.parent_info) {
  const substitutions = this.bindingContext.findSubstitutions(
    event.parent_info.level,
    event.level,
    subgoalPattern
  );
  
  for (const sub of substitutions) {
    step.notes.push(`Note: ${sub.var} from Step ${sub.origin} was substituted → ${sub.value}`);
  }
}
```

**Testing:**
- Unit test VariableBindingContext class
- Test binding recording and retrieval
- Test substitution detection

### Phase 4: Update Timeline Formatter

**File:** `src/timeline-formatter.ts`

**Changes needed:**

1. **Display variable flow notes in EXIT steps**
   ```
   if (step.variableFlowNotes && step.variableFlowNotes.length > 0) {
     for (const note of step.variableFlowNotes) {
       lines.push(`│  Note: ${note}`);
     }
   }
   ```

2. **Display substitution notes in CALL steps**
   ```
   if (step.substitutionNotes && step.substitutionNotes.length > 0) {
     for (const note of step.substitutionNotes) {
       lines.push(`│  Note: ${note}`);
     }
   }
   ```

3. **Update "Next: Subgoal" to include substitution info**
   ```
   if (step.nextSubgoal) {
     const substitutionInfo = step.nextSubgoalHasSubstitutions ? ' with substitutions' : '';
     lines.push(`│  Next: ${step.nextSubgoal}${substitutionInfo}`);
   }
   ```

**Testing:**
- Visual inspection of formatted output
- Compare against design examples

### Phase 5: Update TimelineStep Interface

**File:** `src/timeline.ts`

**Changes needed:**

1. **Add new fields to TimelineStep**
   ```
   interface TimelineStep {
     // ... existing fields ...
     variableFlowNotes?: string[];        // e.g., "X1 from Step 1 is now bound to 2"
     substitutionNotes?: string[];        // e.g., "N1 from Step 1 was substituted → 2"
     nextSubgoalHasSubstitutions?: boolean;
   }
   ```

### Phase 6: Integration Testing

**Test cases:**

1. **Factorial example (factorial/2)**
   - Verify "N1 from Step 1 is now bound to 2" appears in Step 5 EXIT
   - Verify "N1 from Step 1 was substituted → 2" appears in Step 6 CALL
   - Verify all 26 steps have correct flow notes

2. **3_3_operators example (t/2)**
   - Verify "X1 from Step 1 is now bound to 1+0" appears in Step 3 EXIT
   - Verify "X1 from Step 1 was substituted → 1+0" appears in Step 4 CALL

3. **Append example (append/3)**
   - Verify list variable flow (T, R) is tracked correctly
   - Verify recursive calls show proper substitutions

**Validation:**
- Compare output against design examples in design.md
- Verify all Requirement 10 acceptance criteria are met
- Run all existing tests to ensure no regressions

### Phase 7: Documentation

**Files to update:**

1. **README.md** - Add section on variable flow visualization
2. **design.md** - Update with actual implementation details
3. **requirements.md** - Mark Requirement 10 as complete
4. **tasks.md** - Mark Task 28 as complete

## Key Principles

**No Heuristics:**
- All variable flow information comes from Prolog's execution state
- We use `prolog_frame_attribute` to access actual unification data
- No value matching or pattern inference
- No guessing about variable identity

**Data-Driven:**
- Tracer captures what Prolog knows
- TypeScript consumes and displays that data
- No interpretation or inference in TypeScript layer

**Backward Compatible:**
- Enhanced tracer should still work with old TypeScript code
- New fields are optional
- Graceful degradation if tracer doesn't provide enhanced data

## Potential Challenges

1. **Prolog term serialization** - Converting Prolog terms to JSON strings may lose information
   - Solution: Use `term_to_atom` carefully, preserve structure

2. **Variable naming consistency** - Ensuring clause variables match across steps
   - Solution: Use clause source text as canonical reference

3. **Performance** - Extracting frame attributes may slow down tracing
   - Solution: Profile and optimize if needed, but likely negligible

4. **Complex unifications** - Nested structures may be hard to track
   - Solution: Start with simple cases, extend incrementally

## Success Criteria

**Implementation is complete when:**
1. ✅ Tracer exports `head_unifications` and `parent_info`
2. ✅ Parser correctly handles enhanced JSON format
3. ✅ VariableBindingContext tracks bindings across steps
4. ✅ Timeline formatter displays flow notes
5. ✅ All examples show variable flow notes
6. ✅ All Requirement 10 acceptance criteria pass
7. ✅ No regressions in existing functionality
8. ✅ Documentation updated

## Estimated Effort

- Phase 1 (Tracer): 2-3 hours
- Phase 2 (Parser): 1 hour
- Phase 3 (Context): 3-4 hours
- Phase 4 (Formatter): 1 hour
- Phase 5 (Interface): 30 minutes
- Phase 6 (Testing): 2-3 hours
- Phase 7 (Docs): 1 hour

**Total: 10-14 hours**

## Next Steps

1. Start with Phase 1 - extend tracer.pl
2. Test enhanced JSON output manually
3. Proceed to Phase 2 once tracer is working
4. Build incrementally, testing at each phase
5. Commit after each phase completes

## References

- **Requirements:** `.kiro/specs/prolog-trace-dual-visualization/requirements.md` (Requirement 10)
- **Design:** `.kiro/specs/prolog-trace-dual-visualization/design.md` (Example 1, Example 4)
- **Gap Analysis:** `gap-analysis.md`
- **Current Tracer:** `tracer.pl`
- **Current Parser:** `src/parser.ts`
- **Current Timeline:** `src/timeline.ts`
