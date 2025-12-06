# Design Document: Custom Tracer Integration

## Overview

This design replaces the current sldnfdraw-based tracing mechanism with a custom Prolog tracer built on SWI-Prolog's `prolog_trace_interception/4` hook. The custom tracer will capture detailed execution information including actual unification substitutions, which sldnfdraw cannot provide.

The key architectural change is moving from an instrumentation-based approach (where we modify user code with `trace_call/3` markers) to a hook-based approach (where we intercept execution events at runtime without code modification). This provides:

1. **Accurate unifications**: Direct access to variable bindings via `prolog_frame_attribute/3`
2. **Cleaner integration**: No code instrumentation needed
3. **Better reliability**: Clause numbers come from Prolog's internal tracking, not pattern matching
4. **Structured output**: JSON-based trace format instead of LaTeX parsing

## Architecture

### Current Architecture (sldnfdraw-based)

```
User Prolog File
    ↓
Instrument with trace_call/3 markers
    ↓
Generate wrapper with sldnfdraw
    ↓
Execute sldnfdraw → LaTeX output
    ↓
Parse LaTeX → Execution tree
    ↓
Analyze tree → Visualization data
    ↓
Generate Mermaid diagram
    ↓
Render Markdown output
```

### New Architecture (custom tracer)

```
User Prolog File
    ↓
Parse clauses (no instrumentation)
    ↓
Generate wrapper with custom tracer
    ↓
Execute with trace hook → JSON output
    ↓
Parse JSON → Execution tree
    ↓
Analyze tree → Visualization data
    ↓
Generate Mermaid diagram
    ↓
Render Markdown output
```

### Component Changes

| Component | Current Role | New Role | Change Type |
|-----------|-------------|----------|-------------|
| `clauses.ts` | Parse + instrument code | Parse code only | Simplified |
| `wrapper.ts` | Generate sldnfdraw wrapper | Generate tracer wrapper | Modified |
| `executor.ts` | Execute sldnfdraw | Execute custom tracer | Modified |
| `parser.ts` | Parse LaTeX bundles | Parse JSON trace events | Replaced |
| `analyzer.ts` | Analyze execution tree | Analyze execution tree | Unchanged |
| `mermaid.ts` | Generate diagram | Generate diagram | Unchanged |
| `renderer.ts` | Render markdown | Render markdown | Unchanged |

## Components and Interfaces

### 1. Custom Tracer (Prolog)

**File**: `tracer.pl` (new file)

**Responsibilities**:
- Install `prolog_trace_interception/4` hook
- Capture execution events (call, exit, redo, fail ports)
- Extract frame information (goal, level, arguments, clause)
- Record events in structured format
- Export trace as JSON

**Key Predicates**:

```
% Install the tracer hook
install_tracer/0

% Capture trace events
user:prolog_trace_interception(+Port, +Frame, +Choice, -Action)

% Extract frame information
capture_trace_event(+Port, +Frame)
extract_frame_arguments(+Frame, +Arity, -Arguments)

% Export trace data
export_trace_json(+File)

% Cleanup
clear_trace/0
remove_tracer/0
```

**Event Structure**:

```
event(
  port: atom,           % call | exit | redo | fail
  level: integer,       % recursion depth
  goal: compound,       % the goal being executed
  arguments: list,      % actual argument values (at exit)
  clause: term,         % clause(Head, Body, LineNumber) or no_clause
  predicate: atom       % predicate indicator (name/arity)
)
```

### 2. Wrapper Generator

**File**: `src/wrapper.ts` (modified)

**Changes**:
- Remove `instrumentPrologCode()` call
- Load `tracer.pl` instead of sldnfdraw
- Call `install_tracer/0` before query
- Execute query with tracing active
- Call `export_trace_json/1` after query
- Call `remove_tracer/0` for cleanup

**New Wrapper Template**:

```
:- ['tracer.pl'].
:- ['<user_file>'].

run_trace :-
    install_tracer,
    catch(
        (<query>, export_trace_json('<output>.json')),
        Error,
        (format('Error: ~w~n', [Error]), export_trace_json('<output>.json'))
    ),
    remove_tracer.

:- run_trace.
:- halt.
```

### 3. Executor

**File**: `src/executor.ts` (modified)

**Changes**:
- Remove sldnfdraw dependency check
- Execute wrapper with `swipl` directly
- Read JSON output file instead of LaTeX
- Return JSON string instead of LaTeX string

**Interface**:

```
interface ExecutionResult {
  json: string;        // Changed from 'latex'
  exitCode: number;
  stderr: string;
}

async function executeTracer(wrapperPath: string): Promise<ExecutionResult>
```

### 4. Parser

**File**: `src/parser.ts` (replaced)

**Changes**:
- Replace LaTeX parsing with JSON parsing
- Convert JSON events to execution tree
- Build tree structure from port events (call/exit/redo/fail)
- Extract actual unifications from exit events

**New Interface**:

```
interface TraceEvent {
  port: 'call' | 'exit' | 'redo' | 'fail';
  level: number;
  goal: string;
  arguments?: any[];      // Present at exit port
  clause?: {
    head: string;
    body: string;
    line: number;
  };
  predicate: string;
}

function parseTraceJson(json: string): ExecutionNode
```

**Tree Building Algorithm**:

1. Parse JSON array of events
2. Create stack to track active goals by level
3. For each event:
   - **call**: Push new node onto stack at this level
   - **exit**: Pop node from stack, record arguments, add as child to parent
   - **redo**: Mark node for backtracking
   - **fail**: Mark node as failed, pop from stack
4. Return root node

### 5. Analyzer

**File**: `src/analyzer.ts` (minimal changes)

**Changes**:
- Receive execution tree with accurate unifications already present
- Remove unification inference logic (no longer needed)
- Clause numbers come directly from trace events
- Rest of analysis logic remains the same

**Key Improvement**:
The analyzer no longer needs to guess unifications by pattern matching. The parser provides actual variable bindings from the trace.

## Data Models

### ExecutionNode (updated)

```
interface ExecutionNode {
  id: string;
  type: 'query' | 'goal' | 'success' | 'failure';
  goal: string;
  binding?: string;              // Now accurate from trace
  unifications?: Unification[];  // New: explicit unifications
  clauseNumber?: number;         // From trace, not inferred
  clauseLine?: number;           // New: source line number
  children: ExecutionNode[];
  subgoals?: string[];
  level: number;
  arguments?: any[];             // New: actual argument values
}

interface Unification {
  variable: string;
  value: string;
}
```

### TraceEvent (new)

```
interface TraceEvent {
  port: 'call' | 'exit' | 'redo' | 'fail';
  level: number;
  goal: string;
  arguments?: any[];
  clause?: ClauseInfo;
  predicate: string;
}

interface ClauseInfo {
  head: string;
  body: string;
  line: number;
}
```

### Wrapper Configuration (updated)

```
interface WrapperConfig {
  prologContent: string;    // User's Prolog code (not instrumented)
  query: string;
  depth?: number;           // May not be needed with custom tracer
  tracerPath: string;       // Path to tracer.pl
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unification accuracy

*For any* goal that unifies with a clause head, the displayed substitutions should show clause variables bound to their actual values (e.g., "X = 0" not "0+1 = X+1"), and all variables involved in the unification should be displayed.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Unbound variable indication

*For any* execution where variables remain unbound, those variables should be clearly marked as unbound in the output.

**Validates: Requirements 1.3**

### Property 3: Event completeness

*For any* trace event captured, it should contain a valid port type (call/exit/redo/fail), a recursion level >= 0, and a non-empty goal string.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Exit event arguments

*For any* exit port event, the event should contain the actual argument values after unification.

**Validates: Requirements 2.4**

### Property 5: Clause information presence

*For any* trace event involving a user-defined predicate, the event should contain clause information (head, body, line number).

**Validates: Requirements 2.5**

### Property 6: JSON output validity (round-trip)

*For any* trace execution, the output should be valid JSON that can be parsed back into an equivalent data structure.

**Validates: Requirements 2.6**

### Property 7: Tracer lifecycle correctness

*For any* Prolog file, loading it should install the tracer hook, and after tracing completes, removing the tracer should leave no trace-related predicates or facts in the system.

**Validates: Requirements 3.1, 3.4, 5.4**

### Property 8: Code preservation

*For any* Prolog file, the content loaded by the tracer should be identical to the original file content (no instrumentation markers added).

**Validates: Requirements 3.2**

### Property 9: Behavioral equivalence

*For any* query, the result computed with tracing active should be identical to the result computed without tracing.

**Validates: Requirements 3.3**

### Property 10: Dependency independence

*For any* execution, the system should not invoke sldnfdraw or require it to be installed.

**Validates: Requirements 4.1, 4.2**

### Property 11: Parser format compatibility

*For any* trace output, the parser should successfully parse JSON input (not LaTeX) and produce ExecutionNode structures.

**Validates: Requirements 4.3**

### Property 12: Analyzer interface compatibility

*For any* parsed trace, the analyzer should receive ExecutionNode structures with the expected fields (id, type, goal, binding, clauseNumber, children, level).

**Validates: Requirements 4.4, 6.1**

### Property 13: Error resilience

*For any* error during event capture, the tracer should catch the error, continue execution, and record a partial event with available data.

**Validates: Requirements 5.1, 5.2**

### Property 14: Tree structure preservation

*For any* execution, the generated tree should have the same structural properties as the sldnfdraw-based version (root query node, child goal nodes, success/failure leaves).

**Validates: Requirements 6.2**

### Property 15: Clause number consistency

*For any* clause number appearing in the trace, it should correspond to a valid clause in the displayed clause list (1 <= clauseNumber <= totalClauses).

**Validates: Requirements 6.3**

### Property 16: Renderer compatibility

*For any* analyzed trace, the existing renderer and Mermaid generator should produce valid markdown and Mermaid diagram output without modification.

**Validates: Requirements 6.4**

### Property 17: Subgoal edge generation

*For any* goal with subgoals, there should be edges connecting the parent to each subgoal, and edges connecting subgoals in left-to-right order.

**Validates: Requirements 7.1, 7.3, 8.2, 8.3**

### Property 18: Success and failure edges

*For any* goal that succeeds, there should be an edge indicating the return path; for any goal that fails, there should be a failure indication.

**Validates: Requirements 7.2**

### Property 19: Backtracking edges

*For any* backtracking event, there should be an edge from the failed clause attempt to the alternative clause, labeled with the alternative clause number.

**Validates: Requirements 7.4, 9.2**

### Property 20: Step numbering

*For any* visualization, all edges should have unique, sequential step numbers indicating temporal execution order.

**Validates: Requirements 7.5**

### Property 21: Subgoal node creation

*For any* clause body with N subgoals, there should be N separate nodes in the visualization (one per subgoal).

**Validates: Requirements 8.1**

### Property 22: Subgoal completion propagation

*For any* clause where all subgoals succeed, there should be an edge from the last subgoal indicating the parent goal succeeds.

**Validates: Requirements 8.4**

### Property 23: Subgoal failure short-circuit

*For any* clause where a subgoal fails, subsequent subgoals in that clause should not have nodes in the visualization.

**Validates: Requirements 8.5**

### Property 24: Clause attempt ordering

*For any* goal with multiple matching clauses, the first clause attempt should be clause 1, and each clause attempt should be labeled with its clause number.

**Validates: Requirements 9.1, 9.3**

### Property 25: Goal failure indication

*For any* goal where all clauses have been tried and failed, there should be a clear failure node or marker in the visualization.

**Validates: Requirements 9.4**

### Property 26: Success short-circuit

*For any* goal where a clause succeeds, subsequent clauses should not be attempted (no nodes for them) unless backtracking occurs later.

**Validates: Requirements 9.5**

## Error Handling

### Tracer Errors

The custom tracer must handle errors gracefully to avoid crashing the Prolog session:

1. **Frame attribute extraction failures**: If `prolog_frame_attribute/3` fails, record a partial event with available data
2. **Clause lookup failures**: If clause information cannot be retrieved, record `no_clause`
3. **JSON export failures**: If file writing fails, report error but don't crash
4. **Hook installation failures**: If the hook cannot be installed, report clear error message and exit

### Parser Errors

The JSON parser must handle malformed input:

1. **Invalid JSON**: Report parse error with line/column information
2. **Missing required fields**: Use default values or skip malformed events
3. **Type mismatches**: Coerce types where possible, skip events if not

### Execution Errors

The executor must handle Prolog execution failures:

1. **Query failures**: Distinguish between query failing (no solution) and execution error
2. **Timeout**: Support optional timeout for long-running queries
3. **File not found**: Report clear error if Prolog file doesn't exist

## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide comprehensive coverage: unit tests catch concrete bugs, property tests verify general correctness

### Property-Based Testing

We will use **fast-check** (for TypeScript) and **Prolog's built-in testing** for property-based testing.

**Configuration**:
- Each property-based test should run a minimum of 100 iterations
- Each test must be tagged with a comment referencing the correctness property: `**Feature: custom-tracer-integration, Property N: [property text]**`
- Each correctness property must be implemented by a single property-based test

**Key Properties to Test**:

1. **Unification accuracy** (Property 1): Generate random Prolog programs with various clause patterns, verify substitutions match actual bindings
2. **JSON round-trip** (Property 6): Generate random trace events, serialize to JSON, parse back, verify equivalence
3. **Behavioral equivalence** (Property 9): Generate random queries, compare results with/without tracing
4. **Code preservation** (Property 8): Generate random Prolog files, verify loaded content matches original
5. **Clause number consistency** (Property 15): Generate random traces, verify all clause numbers are valid indices

### Unit Testing

Unit tests will cover:

- Specific examples demonstrating correct behavior (e.g., factorial trace, append trace)
- Integration points between components (wrapper → executor → parser → analyzer)
- Edge cases (empty files, queries with no solutions, deeply recursive predicates)
- Error conditions (malformed JSON, missing files, hook installation failures)

### Test Organization

```
src/
  tracer.test.ts          # Unit tests for tracer wrapper generation
  executor.test.ts        # Unit tests for tracer execution
  parser.test.ts          # Unit tests for JSON parsing
  parser.property.test.ts # Property tests for parser (round-trip, etc.)
  analyzer.test.ts        # Unit tests for tree analysis
  integration.test.ts     # End-to-end integration tests
```

## Implementation Notes

### Prolog Version Compatibility

The custom tracer requires SWI-Prolog 7.0 or later for `prolog_trace_interception/4` support. We should:

1. Check SWI-Prolog version at startup
2. Report clear error if version is too old
3. Document minimum version requirement in README

### Performance Considerations

Tracing adds overhead to execution. For large traces:

1. Consider streaming JSON output instead of building in memory
2. Add optional depth limit to prevent excessive trace size
3. Support filtering to trace only specific predicates

### Debugging Support

To help debug tracer issues:

1. Add verbose mode that shows raw trace events
2. Support saving intermediate JSON for inspection
3. Include tracer version in output for reproducibility

