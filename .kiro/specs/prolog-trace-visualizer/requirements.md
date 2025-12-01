# Requirements Document

## Introduction

This document specifies the requirements for `prolog-trace-viz`, a command-line utility that generates enhanced visual trace diagrams for Prolog query execution. The tool automates the process of creating beautiful, educational Mermaid diagrams from Prolog execution traces, making it easier to understand how Prolog solves queries through backtracking and unification.

## Glossary

- **Prolog**: A logic programming language based on formal logic
- **Query**: A question posed to a Prolog program (e.g., `t(1+0+1, X)`)
- **Goal**: A predicate that Prolog attempts to prove or solve
- **Clause**: A Prolog rule or fact that can match a goal
- **Unification**: The process of matching a goal with a clause head and binding variables
- **Pending Goal**: A goal that has been queued but not yet actively solved
- **sldnfdraw**: A SWI-Prolog package that generates LaTeX representations of execution trees
- **Mermaid**: A markdown-based diagramming language that renders in browsers and IDEs
- **Execution Tree**: A tree structure showing all steps Prolog takes to solve a query

## Requirements

### Requirement 1: Command-Line Interface

**User Story:** As a Prolog learner, I want to run a simple command with my Prolog file and query, so that I can quickly generate a trace visualization without manual setup.

#### Acceptance Criteria

1. WHEN the user invokes the tool with a Prolog file path and query string THEN the system SHALL generate a trace visualization
2. WHEN the user provides invalid arguments THEN the system SHALL display helpful error messages with usage examples
3. WHEN the user invokes with `--help` or `-h` THEN the system SHALL display comprehensive usage documentation
4. WHEN the user invokes with `--version` or `-v` THEN the system SHALL display the tool version
5. WHEN the user specifies an output file with `--output` or `-o` THEN the system SHALL write the visualization to that file
6. WHEN no output file is specified THEN the system SHALL write to stdout
7. WHEN the user specifies `--verbose` THEN the system SHALL display detailed processing information
8. WHEN the user specifies `--quiet` THEN the system SHALL suppress all non-error output except the final result
9. WHEN the user specifies `--depth N` THEN the system SHALL pass the depth limit to sldnfdraw
10. WHEN required arguments are missing THEN the system SHALL display usage information and exit with a non-zero status

### Requirement 2: sldnfdraw Integration

**User Story:** As a developer, I want the tool to automatically interface with sldnfdraw, so that I don't need to manually create wrapper files or run Prolog commands.

#### Acceptance Criteria

1. WHEN the tool receives a Prolog file and query THEN the system SHALL create a temporary sldnfdraw wrapper file with proper structure
2. WHEN the wrapper file is created THEN the system SHALL include the user's Prolog clauses in the `begin_program` section
3. WHEN the wrapper file is created THEN the system SHALL include the user's query in the `begin_query` section
4. WHEN the tool invokes sldnfdraw THEN the system SHALL execute SWI-Prolog with the wrapper file
5. WHEN sldnfdraw completes THEN the system SHALL capture the generated LaTeX output
6. WHEN the tool finishes processing THEN the system SHALL clean up temporary files

### Requirement 3: LaTeX Parsing

**User Story:** As a developer, I want the tool to parse sldnfdraw's LaTeX output, so that I can extract the execution tree structure programmatically.

#### Acceptance Criteria

1. WHEN the tool receives LaTeX output THEN the system SHALL parse `\begin{bundle}` and `\end{bundle}` blocks to identify goals
2. WHEN parsing bundles THEN the system SHALL extract goal text from bundle declarations
3. WHEN the tool encounters `\chunk` commands THEN the system SHALL extract variable bindings from chunk parameters
4. WHEN the tool encounters `\begin{tabular}` blocks THEN the system SHALL identify multiple sequential subgoals
5. WHEN the tool encounters nested bundles THEN the system SHALL maintain the hierarchical structure
6. WHEN parsing completes THEN the system SHALL produce a structured representation of the execution tree

### Requirement 4: Execution Tree Analysis

**User Story:** As a developer, I want the tool to analyze the execution tree structure, so that it can identify pending goals, variable bindings, and execution flow.

#### Acceptance Criteria

1. WHEN analyzing the execution tree THEN the system SHALL identify all unique pending goals
2. WHEN the same pending goal appears at multiple nesting levels THEN the system SHALL deduplicate and track only the first occurrence
3. WHEN analyzing goals THEN the system SHALL track which clause matched each goal
4. WHEN analyzing recursive calls THEN the system SHALL assign unique variable names using level-based naming (X1_L1, X1_L2, etc.)
5. WHEN analyzing execution flow THEN the system SHALL determine the sequential order of goal solving
6. WHEN a pending goal becomes active THEN the system SHALL record the activation relationship

### Requirement 5: Mermaid Diagram Generation

**User Story:** As a Prolog learner, I want the tool to generate a clear, color-coded Mermaid diagram, so that I can visually understand the execution flow.

#### Acceptance Criteria

1. WHEN generating the diagram THEN the system SHALL create nodes for the initial query, solving goals, pending goals, solved goals, and success
2. WHEN creating nodes THEN the system SHALL apply the correct color scheme: blue for query, yellow for solving, gray for pending, green for solved/success
3. WHEN creating arrows THEN the system SHALL use solid arrows for active execution, dashed arrows for queueing, and double arrows for activation
4. WHEN numbering steps THEN the system SHALL use circled numbers (①②③) in sequential order
5. WHEN a goal completes and a pending goal activates THEN the system SHALL number the completion arrow before the activation arrow
6. WHEN generating arrow labels THEN the system SHALL include clause information and variable bindings
7. WHEN the diagram is complete THEN the system SHALL include proper styling directives for all node types

### Requirement 6: Markdown Output Generation

**User Story:** As a Prolog learner, I want the tool to generate a complete markdown document, so that I have both the visual diagram and detailed execution steps.

#### Acceptance Criteria

1. WHEN generating output THEN the system SHALL create a markdown document with a title including the query
2. WHEN generating output THEN the system SHALL include the original query in a code block
3. WHEN generating output THEN the system SHALL include the Mermaid diagram with proper fencing
4. WHEN generating output THEN the system SHALL include a legend explaining the visual elements
5. WHEN generating output THEN the system SHALL include step-by-step execution breakdown
6. WHEN generating output THEN the system SHALL include the final answer
7. WHEN generating output THEN the system SHALL include a summary of which clauses were used

### Requirement 7: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I can fix issues quickly.

#### Acceptance Criteria

1. WHEN the Prolog file does not exist THEN the system SHALL report a file not found error with the attempted path
2. WHEN SWI-Prolog is not installed THEN the system SHALL report that SWI-Prolog is required
3. WHEN sldnfdraw is not installed THEN the system SHALL report that the sldnfdraw pack is required with installation instructions
4. WHEN the query syntax is invalid THEN the system SHALL report the syntax error from Prolog
5. WHEN LaTeX parsing fails THEN the system SHALL report the parsing error with context
6. WHEN file writing fails THEN the system SHALL report the I/O error with details

### Requirement 8: Example and Documentation

**User Story:** As a new user, I want clear examples and documentation, so that I can start using the tool immediately.

#### Acceptance Criteria

1. WHEN the tool is installed THEN the system SHALL include a README with installation instructions
2. WHEN the README is viewed THEN the system SHALL include usage examples with sample Prolog files
3. WHEN the README is viewed THEN the system SHALL include example output showing the generated visualization
4. WHEN the tool is invoked with --help THEN the system SHALL display usage information
5. WHEN the repository includes examples THEN the system SHALL provide at least one complete example with input and output
