# Design Document: JSON Parser Tree Builder

## Overview

This design implements the tree building algorithm for converting JSON trace events from the custom Prolog tracer into a structured ExecutionNode tree. The tree builder processes call/exit/redo/fail events in sequence and constructs a tree that accurately represents the Prolog execution flow with proper parent-child relationships, unifications, and clause information.

## Architecture

The tree builder follows a stack-based approach that mirrors Prolog's execution model:

```
JSON Events → Event Parser → Stack-Based Tree Builder → ExecutionNode Tree
```

### Key Components

1. **Event Parser**: Validates and parses JSON events into TraceEvent objects
2. **Call Stack Manager**: Maintains active goals by recursion level
3. **Tree Builder**: Constructs ExecutionNode tree from events
4. **Unification Extractor**: Extracts variable bindings from exit events
5. **Clause Mapper**: Maps clause information to nodes

## Components and Interfaces

### Event Parser

**Responsibilities:**
- Parse JSON array into TraceEvent objects
- Validate required fields (port, level, goal, predicate)
- Handle malformed JSON gracefully
- Filter out system predicates if needed

**Interface:**
```typescript
interface TraceEvent {
  port: 'call' | 'exit' | 'redo' | 'fail';
  level: number;
  goal: string;
  arguments?: any[];
  clause?: {
    head: string;
    body: string;
    line: number;
  };
  predicate: string;
}

function parseEvents(json: string): TraceEvent[]
```

### Call Stack Manager

**Responsibilities:**
- Maintain stack of active goals indexed by level
- Handle nested calls and recursion
- Track goal state (active, completed, failed)
- Support backtracking operations

**Interface:**
```typescript
interface StackEntry {
  node: ExecutionNode;
  event: TraceEvent;
  children: ExecutionNode[];
}

class CallStack {
  private stack: Map<number, StackEntry> = new Map();
  
  push(level: number, node: ExecutionNode, event: TraceEvent): void
  pop(level: number): StackEntry | undefined
  peek(level: number): StackEntry | undefined
  isEmpty(): boolean
}
```

### Tree Builder

**Responsibilities:**
- Process events in sequence
- Create ExecutionNode instances
- Build parent-child relationships
- Handle backtracking and multiple solutions

**Algorithm:**
```
1. Initialize empty call stack and root node
2. For each trace event:
   - If CALL: Create new node, push to stack
   - If EXIT: Pop matching node, extract unifications, add to parent
   - If REDO: Mark node for backtracking
   - If FAIL: Mark node as failed, handle cleanup
3. Return root node when stack is empty
```

### Unification Extractor

**Responsibilities:**
- Extract variable bindings from exit events
- Compare call arguments with exit arguments
- Create Unification objects
- Handle unbound variables

**Algorithm:**
```
1. Get call event arguments (before unification)
2. Get exit event arguments (after unification)  
3. Compare argument positions to identify bindings
4. Create Unification objects for each binding
5. Handle special cases (unbound variables, complex terms)
```

## Data Models

### Enhanced ExecutionNode

The existing ExecutionNode interface will be populated with accurate data:

```typescript
interface ExecutionNode {
  id: string;                    // Generated unique ID
  type: 'query' | 'goal' | 'success' | 'failure';
  goal: string;                  // From trace event
  binding?: string;              // Formatted as "X = value"
  unifications?: Unification[];  // Extracted from exit events
  clauseNumber?: number;         // From clause info
  clauseLine?: number;           // From clause info
  children: ExecutionNode[];     // Built from call/exit pairs
  subgoals?: string[];           // Extracted from clause body
  level: number;                 // From trace event
  arguments?: any[];             // From exit events
}
```

### Stack Entry

Internal data structure for call stack management:

```typescript
interface StackEntry {
  node: ExecutionNode;           // The ExecutionNode being built
  callEvent: TraceEvent;         // Original call event
  children: ExecutionNode[];     // Children collected so far
  isCompleted: boolean;          // Whether exit event was processed
  isFailed: boolean;             // Whether fail event was processed
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: JSON parsing completeness
*For any* valid JSON array of trace events, the parser should successfully parse all events into TraceEvent objects with all required fields present.
**Validates: Requirements 1.1, 1.2**

### Property 2: Error resilience
*For any* malformed JSON input, the parser should handle errors gracefully and continue processing valid events without crashing.
**Validates: Requirements 1.3**

### Property 3: Root node structure
*For any* valid trace event sequence, the tree builder should return exactly one root node with type 'query'.
**Validates: Requirements 1.4, 7.1**

### Property 4: Call/exit matching
*For any* call event followed by a matching exit event at the same level and predicate, the tree builder should create a parent-child relationship.
**Validates: Requirements 2.2, 2.4**

### Property 5: Stack management
*For any* sequence of call events, the call stack should grow appropriately, and for matching exit events, the stack should shrink correctly.
**Validates: Requirements 2.1, 2.5**

### Property 6: Unification extraction
*For any* exit event containing arguments, the tree builder should extract unifications and create appropriate Unification objects.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 7: Clause information preservation
*For any* trace event containing clause information, the resulting ExecutionNode should preserve the clause head, body, line number, and clause number.
**Validates: Requirements 4.1, 4.2**

### Property 8: Graceful clause handling
*For any* trace event missing clause information, the tree builder should continue processing without errors.
**Validates: Requirements 4.3**

### Property 9: Backtracking representation
*For any* sequence containing redo/fail events, the tree should represent alternative execution paths correctly.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: Multiple solution handling
*For any* query with multiple solutions, each solution path should be represented as a separate branch in the tree.
**Validates: Requirements 5.4**

### Property 11: Recursion handling
*For any* recursive call sequence, the tree builder should maintain separate stack entries for each recursion level and create distinct ExecutionNode instances.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 12: Deep recursion support
*For any* deeply nested recursive sequence, the tree builder should handle arbitrary recursion depths without stack overflow.
**Validates: Requirements 6.4**

### Property 13: Node type correctness
*For any* trace event, the resulting ExecutionNode should have the appropriate type based on the event sequence (goal, success, failure).
**Validates: Requirements 7.2**

### Property 14: Interface compliance
*For any* generated ExecutionNode tree, all nodes should conform to the ExecutionNode interface with required fields populated.
**Validates: Requirements 7.3**

### Property 15: Analyzer compatibility
*For any* generated ExecutionNode tree, the existing analyzer should process it without errors and generate valid visualizations.
**Validates: Requirements 7.4**

### Property 16: Binding format consistency
*For any* ExecutionNode with bindings, the binding format should match the analyzer's expectations (e.g., "X = 5").
**Validates: Requirements 7.5**

## Error Handling

### JSON Parsing Errors
- **Malformed JSON**: Log error, return empty event array
- **Missing required fields**: Skip invalid events, continue processing
- **Type mismatches**: Coerce types where possible, skip if not

### Tree Building Errors
- **Unmatched exit events**: Log warning, create orphaned node
- **Stack underflow**: Log error, attempt recovery
- **Missing call events**: Create placeholder call event

### Unification Errors
- **Argument count mismatch**: Log warning, extract available unifications
- **Complex term parsing**: Use string representation as fallback
- **Unbound variable detection**: Mark as unbound in unification

## Testing Strategy

### Dual Testing Approach
- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide comprehensive coverage

### Property-Based Testing
We will use **fast-check** for property-based testing with a minimum of 100 iterations per test.

**Key Properties to Test:**
1. **JSON round-trip**: Parse events, build tree, verify structure
2. **Call/exit matching**: Generate balanced call/exit sequences, verify tree structure
3. **Stack invariants**: Verify stack grows/shrinks correctly
4. **Unification extraction**: Generate exit events with arguments, verify unifications
5. **Recursion handling**: Generate recursive call patterns, verify separate nodes

### Unit Testing
Unit tests will cover:
- Specific examples (factorial, append, member traces)
- Edge cases (empty events, malformed JSON, unmatched events)
- Error conditions (stack underflow, missing fields)
- Integration with existing analyzer

### Test Data Generation
- **Valid trace sequences**: Balanced call/exit pairs with proper nesting
- **Backtracking sequences**: Call/redo/fail patterns
- **Recursive sequences**: Nested calls at different levels
- **Malformed data**: Invalid JSON, missing fields, type errors

## Implementation Notes

### Performance Considerations
- Use Map for O(1) stack access by level
- Avoid deep copying of large objects
- Stream processing for very large trace files

### Memory Management
- Clear completed stack entries promptly
- Avoid circular references in tree structure
- Consider weak references for parent pointers

### Debugging Support
- Add verbose logging for tree building steps
- Include event indices in error messages
- Support partial tree building for debugging