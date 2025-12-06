# Requirements Document

## Introduction

This feature replaces the current sldnfdraw-based tracing mechanism with a custom Prolog tracer that uses SWI-Prolog's `prolog_trace_interception/4` hook. The custom tracer will capture detailed execution information including actual unification substitutions, which sldnfdraw does not provide.

## Glossary

- **Tracer**: A mechanism that monitors Prolog execution and captures information about goal calls, unifications, and clause matching
- **Port**: An execution phase in Prolog's 4-port model (call, exit, redo, fail) or 5-port model (adds unify)
- **Frame**: A reference to a local stack frame in Prolog's execution, containing information about a goal's execution
- **Unification**: The process of making two Prolog terms equal by finding variable substitutions
- **Clause**: A Prolog rule or fact that can match a goal
- **sldnfdraw**: The current external library used for tracing, which outputs LaTeX visualization

## Requirements

### Requirement 1

**User Story:** As a Prolog student, I want to see accurate unification information in execution traces, so that I can understand how variables are bound during query execution.

#### Acceptance Criteria

1. WHEN a goal unifies with a clause head THEN the system SHALL display the actual variable substitutions (e.g., X=0, Z=1+1+0)
2. WHEN displaying unifications THEN the system SHALL show clause variables unified to their values, not goal terms matched to clause patterns
3. WHEN a variable remains unbound THEN the system SHALL indicate this clearly in the output
4. WHEN multiple variables are unified THEN the system SHALL display all substitutions for that unification step

### Requirement 2

**User Story:** As a developer, I want the tracer to capture execution data in a structured format, so that I can reliably parse and visualize the trace.

#### Acceptance Criteria

1. WHEN the tracer captures an execution event THEN the system SHALL record the port type (call, exit, redo, fail)
2. WHEN the tracer captures an execution event THEN the system SHALL record the recursion level
3. WHEN the tracer captures an execution event THEN the system SHALL record the goal being executed
4. WHEN the tracer captures an exit event THEN the system SHALL record the actual argument values after unification
5. WHEN the tracer captures an event THEN the system SHALL record which clause was matched (if applicable)
6. WHEN the tracer completes THEN the system SHALL output the trace data in a structured format (JSON or similar)

### Requirement 3

**User Story:** As a user, I want the custom tracer to work with my existing Prolog files, so that I don't need to modify my code to use the visualization tool.

#### Acceptance Criteria

1. WHEN the system loads a Prolog file THEN the tracer SHALL be automatically installed via the trace interception hook
2. WHEN the system executes a query THEN the tracer SHALL capture events without requiring code instrumentation
3. WHEN the tracer is active THEN user predicates SHALL execute normally without behavioral changes
4. WHEN the system completes tracing THEN the tracer SHALL be cleanly removed to avoid affecting subsequent queries

### Requirement 4

**User Story:** As a developer, I want to replace sldnfdraw with the custom tracer, so that the tool no longer depends on external LaTeX-based tracing.

#### Acceptance Criteria

1. WHEN the system generates a trace THEN the custom tracer SHALL be used instead of sldnfdraw
2. WHEN the custom tracer is used THEN the system SHALL NOT require sldnfdraw to be installed
3. WHEN the custom tracer produces output THEN the existing parser SHALL be replaced with a parser for the new format
4. WHEN the system analyzes a trace THEN the analyzer SHALL receive structured data from the custom tracer
5. WHEN the system generates visualizations THEN the output quality SHALL be equal to or better than the sldnfdraw-based version

### Requirement 5

**User Story:** As a user, I want the tool to handle errors gracefully, so that tracer failures don't crash my Prolog session.

#### Acceptance Criteria

1. WHEN the tracer encounters an error during event capture THEN the system SHALL catch the error and continue execution
2. WHEN the tracer fails to extract frame information THEN the system SHALL record a partial event with available data
3. WHEN the system cannot install the tracer hook THEN the system SHALL report a clear error message to the user
4. WHEN the tracer is removed THEN the system SHALL ensure all trace hooks are properly cleaned up

### Requirement 6

**User Story:** As a developer, I want the tracer to integrate with the existing tool architecture, so that minimal changes are needed to other components.

#### Acceptance Criteria

1. WHEN the tracer produces output THEN the format SHALL be compatible with the existing analyzer interface
2. WHEN the system executes a query THEN the tracer SHALL produce an execution tree structure similar to the current format
3. WHEN the analyzer processes trace data THEN the analyzer SHALL receive clause numbers that match the displayed clause list
4. WHEN the system generates output THEN the existing renderer and Mermaid generator SHALL work without modification

### Requirement 7

**User Story:** As a student, I want clear visual arrows showing execution flow, so that I can follow the step-by-step progression through the trace.

#### Acceptance Criteria

1. WHEN a goal calls a subgoal THEN the visualization SHALL show an arrow from the parent goal to the subgoal
2. WHEN a goal exits successfully THEN the visualization SHALL show an arrow indicating the return path
3. WHEN a clause has multiple subgoals THEN the visualization SHALL show arrows indicating left-to-right evaluation order
4. WHEN backtracking occurs THEN the visualization SHALL show arrows indicating the alternative path taken
5. WHEN arrows are displayed THEN each arrow SHALL be labeled with step numbers to indicate temporal order

### Requirement 8

**User Story:** As a student, I want to see how compound goals are decomposed into subgoals, so that I can understand the execution order of conjunctions.

#### Acceptance Criteria

1. WHEN a clause body contains multiple subgoals THEN the system SHALL display each subgoal as a separate node
2. WHEN subgoals are displayed THEN the system SHALL show arrows indicating they are solved left-to-right
3. WHEN a subgoal completes THEN the system SHALL show an arrow to the next subgoal in the sequence
4. WHEN all subgoals complete THEN the system SHALL show an arrow indicating the parent goal succeeds
5. WHEN a subgoal fails THEN the system SHALL clearly indicate that subsequent subgoals are not attempted

### Requirement 9

**User Story:** As a student, I want the trace to show which clause was tried and in what order, so that I can understand Prolog's clause selection and backtracking behavior.

#### Acceptance Criteria

1. WHEN multiple clauses match a goal THEN the system SHALL show which clause was tried first
2. WHEN a clause fails and backtracking occurs THEN the system SHALL show an arrow to the next clause attempt
3. WHEN displaying clause attempts THEN the system SHALL label each attempt with the clause number
4. WHEN all clauses have been tried THEN the system SHALL clearly indicate that the goal failed
5. WHEN a clause succeeds THEN the system SHALL show that no further clauses are attempted (unless backtracking occurs later)
