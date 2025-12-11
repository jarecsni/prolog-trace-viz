# Requirements Document

## Introduction

This feature implements the tree building algorithm for the JSON parser to convert trace events from the custom Prolog tracer into a structured execution tree. The tree builder will process call/exit/redo/fail events and construct an ExecutionNode tree that accurately represents the Prolog execution flow.

## Glossary

- **Trace Event**: A JSON object representing a single execution event (call, exit, redo, fail)
- **Port**: The type of trace event (call, exit, redo, fail) in Prolog's 4-port model
- **Level**: The recursion depth of a goal in the execution stack
- **ExecutionNode**: A tree node representing a goal's execution with children, bindings, and metadata
- **Call Stack**: A data structure tracking active goals by their recursion level
- **Unification**: Variable bindings extracted from exit events showing how variables were unified

## Requirements

### Requirement 1

**User Story:** As a developer, I want the JSON parser to build an accurate execution tree from trace events, so that the analyzer can generate proper visualizations.

#### Acceptance Criteria

1. WHEN the parser receives a JSON array of trace events THEN the system SHALL parse each event into a TraceEvent object
2. WHEN parsing trace events THEN the system SHALL validate that required fields (port, level, goal, predicate) are present
3. WHEN a trace event has malformed JSON THEN the system SHALL handle the error gracefully and continue processing
4. WHEN all events are parsed THEN the system SHALL return a single ExecutionNode representing the root query

### Requirement 2

**User Story:** As a developer, I want call and exit events to be matched correctly, so that the execution tree shows proper parent-child relationships.

#### Acceptance Criteria

1. WHEN a call event is processed THEN the system SHALL create a new ExecutionNode and push it onto the call stack at the appropriate level
2. WHEN an exit event is processed THEN the system SHALL find the matching call event at the same level and predicate
3. WHEN an exit event matches a call event THEN the system SHALL extract arguments and unifications from the exit event
4. WHEN an exit event is processed THEN the system SHALL pop the completed node from the stack and add it as a child to its parent
5. WHEN the call stack becomes empty THEN the system SHALL have completed building the execution tree

### Requirement 3

**User Story:** As a developer, I want unification information to be extracted accurately from exit events, so that the visualization shows correct variable bindings.

#### Acceptance Criteria

1. WHEN an exit event contains arguments THEN the system SHALL extract the actual argument values after unification
2. WHEN an exit event shows variable bindings THEN the system SHALL create Unification objects with variable names and values
3. WHEN a goal has multiple variables THEN the system SHALL extract all unifications for that goal
4. WHEN a variable remains unbound THEN the system SHALL indicate this in the unification information

### Requirement 4

**User Story:** As a developer, I want clause information to be preserved in the execution tree, so that the analyzer can show which clauses were used.

#### Acceptance Criteria

1. WHEN a trace event contains clause information THEN the system SHALL extract the clause head, body, and line number
2. WHEN a clause is matched THEN the system SHALL store the clause number in the ExecutionNode
3. WHEN clause information is missing THEN the system SHALL handle this gracefully without failing
4. WHEN multiple clauses are tried THEN the system SHALL track each clause attempt separately

### Requirement 5

**User Story:** As a developer, I want backtracking events (redo/fail) to be handled correctly, so that the execution tree shows alternative execution paths.

#### Acceptance Criteria

1. WHEN a redo event is processed THEN the system SHALL mark the corresponding node for backtracking
2. WHEN a fail event is processed THEN the system SHALL mark the corresponding node as failed
3. WHEN backtracking occurs THEN the system SHALL maintain the tree structure showing alternative paths
4. WHEN multiple solutions exist THEN the system SHALL represent each solution path in the tree

### Requirement 6

**User Story:** As a developer, I want the tree builder to handle recursive calls correctly, so that deeply nested executions are represented accurately.

#### Acceptance Criteria

1. WHEN recursive calls occur THEN the system SHALL maintain separate stack entries for each recursion level
2. WHEN the same predicate is called at different levels THEN the system SHALL create separate ExecutionNode instances
3. WHEN recursive calls complete THEN the system SHALL properly unwind the call stack
4. WHEN deeply nested recursion occurs THEN the system SHALL handle arbitrary recursion depths

### Requirement 7

**User Story:** As a developer, I want the execution tree to be compatible with the existing analyzer, so that visualizations work without modification.

#### Acceptance Criteria

1. WHEN the tree is built THEN the root node SHALL have type 'query' and represent the original query
2. WHEN child nodes are created THEN they SHALL have appropriate types ('goal', 'success', 'failure')
3. WHEN the tree is complete THEN it SHALL conform to the ExecutionNode interface
4. WHEN the analyzer processes the tree THEN it SHALL generate visualizations without errors
5. WHEN bindings are present THEN they SHALL be in the format expected by the analyzer (e.g., "X = 5")