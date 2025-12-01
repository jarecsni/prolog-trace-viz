# Design Document: Prolog Trace Visualizer

## Overview

The Prolog Trace Visualizer (`prolog-trace-viz`) is a command-line tool that transforms Prolog execution traces into beautiful, educational Mermaid diagrams. The tool bridges the gap between sldnfdraw's LaTeX output and human-readable visualizations by:

1. Wrapping user Prolog files with sldnfdraw boilerplate
2. Invoking SWI-Prolog to generate LaTeX execution trees
3. Parsing the LaTeX structure into an internal representation
4. Analyzing the execution tree for pending goals, bindings, and flow
5. Generating color-coded Mermaid diagrams with step-by-step annotations
6. Producing complete markdown documentation

The tool is implemented in TypeScript/Node.js for cross-platform compatibility and ease of distribution via npm.

## Architecture

The tool follows a linear pipeline architecture with distinct processing stages:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           prolog-trace-viz                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │   CLI    │───▶│  Wrapper  │───▶│ Executor │───▶│   LaTeX Parser   │  │
│  │  Module  │    │ Generator │    │          │    │                  │  │
│  └──────────┘    └───────────┘    └──────────┘    └──────────────────┘  │
│       │                                                    │             │
│       │                                                    ▼             │
│       │                                           ┌──────────────────┐  │
│       │                                           │  Tree Analyzer   │  │
│       │                                           └──────────────────┘  │
│       │                                                    │             │
│       │                                                    ▼             │
│       │         ┌───────────┐    ┌──────────┐    ┌──────────────────┐  │
│       │         │  Output   │◀───│ Markdown │◀───│ Mermaid Generator│  │
│       │         │  Writer   │    │ Renderer │    │                  │  │
│       │         └───────────┘    └──────────┘    └──────────────────┘  │
│       │                │                                                 │
│       ▼                ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Error Handler                               │    │
│  │  (Centralized error formatting and user-friendly messages)       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. CLI parses arguments and validates input
2. Wrapper Generator creates temporary sldnfdraw-compatible Prolog file
3. Executor invokes SWI-Prolog and captures LaTeX output
4. LaTeX Parser extracts tree structure from bundle/chunk syntax
5. Tree Analyzer identifies pending goals, bindings, and execution order
6. Mermaid Generator produces diagram syntax with proper styling
7. Markdown Renderer assembles the complete output document
8. Output Writer sends to file or stdout

Error Handler intercepts failures at any stage and produces consistent, helpful error messages.

## Components and Interfaces

### 1. CLI Module (`src/cli.ts`)

Handles command-line argument parsing and orchestrates the pipeline.

```typescript
interface CLIOptions {
  prologFile: string;
  query: string;
  output?: string;
  depth?: number;
  verbose: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): CLIOptions | CLIError;
function run(options: CLIOptions): Promise<void>;
```

### 2. Wrapper Generator (`src/wrapper.ts`)

Creates temporary sldnfdraw wrapper files.

```typescript
interface WrapperConfig {
  prologContent: string;
  query: string;
  depth?: number;
}

function generateWrapper(config: WrapperConfig): string;
function createTempWrapper(config: WrapperConfig): Promise<TempFile>;
```

### 3. Prolog Executor (`src/executor.ts`)

Invokes SWI-Prolog and captures output.

```typescript
interface ExecutionResult {
  latex: string;
  exitCode: number;
  stderr: string;
}

function executeSldnfdraw(wrapperPath: string): Promise<ExecutionResult>;
function checkDependencies(): Promise<DependencyStatus>;
```

### 4. LaTeX Parser (`src/parser.ts`)

Parses sldnfdraw LaTeX output into a tree structure.

```typescript
interface ExecutionNode {
  type: 'query' | 'goal' | 'success' | 'failure';
  goal: string;
  binding?: string;
  children: ExecutionNode[];
  subgoals?: string[];  // For tabular blocks
}

function parseLatex(latex: string): ExecutionNode;
function extractBundles(latex: string): Bundle[];
function extractChunks(bundle: string): Chunk[];
```

### 5. Tree Analyzer (`src/analyzer.ts`)

Analyzes the execution tree for visualization.

```typescript
interface AnalysisResult {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  pendingGoals: Map<string, PendingGoal>;
  executionOrder: string[];
  clausesUsed: ClauseUsage[];
}

interface VisualizationNode {
  id: string;
  type: 'query' | 'solving' | 'pending' | 'solved' | 'success';
  label: string;
  level: number;
}

interface VisualizationEdge {
  from: string;
  to: string;
  type: 'active' | 'queue' | 'activate';
  label: string;
  stepNumber: number;
}

function analyzeTree(root: ExecutionNode): AnalysisResult;
function deduplicatePendingGoals(nodes: ExecutionNode[]): Map<string, PendingGoal>;
function assignLevelVariables(node: ExecutionNode, level: number): void;
```

### 6. Mermaid Generator (`src/mermaid.ts`)

Generates Mermaid diagram syntax.

```typescript
interface MermaidDiagram {
  nodes: string[];
  edges: string[];
  styles: string[];
  linkStyles: string[];
}

function generateMermaid(analysis: AnalysisResult): string;
function formatNode(node: VisualizationNode): string;
function formatEdge(edge: VisualizationEdge): string;
function generateStyles(nodes: VisualizationNode[]): string[];
```

### 7. Markdown Renderer (`src/renderer.ts`)

Produces the final markdown document.

```typescript
interface RenderContext {
  query: string;
  diagram: string;
  executionSteps: ExecutionStep[];
  finalAnswer: string;
  clausesUsed: ClauseUsage[];
}

function renderMarkdown(context: RenderContext): string;
function renderLegend(): string;
function renderExecutionSteps(steps: ExecutionStep[]): string;
```

### 8. Error Handler (`src/errors.ts`)

Centralized error handling with user-friendly messages.

```typescript
enum ErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PROLOG_NOT_INSTALLED = 'PROLOG_NOT_INSTALLED',
  SLDNFDRAW_NOT_INSTALLED = 'SLDNFDRAW_NOT_INSTALLED',
  INVALID_QUERY = 'INVALID_QUERY',
  PARSE_ERROR = 'PARSE_ERROR',
  IO_ERROR = 'IO_ERROR',
  INVALID_ARGS = 'INVALID_ARGS',
}

interface ToolError {
  code: ErrorCode;
  message: string;
  details?: string;
  suggestion?: string;
}

function createError(code: ErrorCode, details?: string): ToolError;
function formatError(error: ToolError): string;
```

## Data Models

### Execution Tree Model

```typescript
// Raw parsed structure from LaTeX
interface Bundle {
  goal: string;
  chunks: Chunk[];
}

interface Chunk {
  binding?: string;
  content: string | Bundle | Tabular;
}

interface Tabular {
  subgoals: string[];
}

// Normalized tree structure
interface ExecutionNode {
  id: string;
  type: 'query' | 'goal' | 'success' | 'failure';
  goal: string;
  binding?: string;
  clauseNumber?: number;
  children: ExecutionNode[];
  subgoals?: string[];
  level: number;
}
```

### Visualization Model

```typescript
interface VisualizationNode {
  id: string;
  type: 'query' | 'solving' | 'pending' | 'solved' | 'success';
  label: string;
  emoji: string;  // 🎯, 🔄, ⏸️, ✅, 🎉
  level: number;
}

interface VisualizationEdge {
  id: string;
  from: string;
  to: string;
  type: 'active' | 'queue' | 'activate';
  label: string;
  stepNumber: number;
}

interface PendingGoal {
  id: string;
  goal: string;
  queuedAt: string;  // Node ID where queued
  activatedAt?: string;  // Node ID where activated
}

interface ClauseUsage {
  clauseNumber: number;
  clauseText: string;
  usageCount: number;
  usedAtSteps: number[];
}

interface ExecutionStep {
  stepNumber: number;
  description: string;
  goal: string;
  clauseMatched?: string;
  bindings?: Record<string, string>;
  newGoals?: string[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified:

### Property 1: Argument validation rejects invalid inputs
*For any* argument array that is missing required arguments (prolog file or query), the argument parser SHALL return an error and the error message SHALL contain usage information.
**Validates: Requirements 1.2, 1.10**

### Property 2: Wrapper file contains all input content
*For any* Prolog file content and query string, the generated wrapper file SHALL contain the Prolog content within `:-begin_program.` and `:-end_program.` markers AND the query within `:-begin_query.` and `:-end_query.` markers.
**Validates: Requirements 2.2, 2.3**

### Property 3: LaTeX parsing round-trip preserves structure
*For any* valid execution tree, serializing it to LaTeX format and parsing it back SHALL produce an equivalent tree structure (same goals, same hierarchy, same bindings).
**Validates: Requirements 3.1**

### Property 4: Pending goal identification is complete
*For any* execution tree containing pending goals, the analyzer SHALL identify all goals that are queued but not immediately solved.
**Validates: Requirements 4.1**

### Property 5: Pending goal deduplication preserves first occurrence
*For any* execution tree where the same pending goal appears at multiple nesting levels, the analyzer SHALL track only the first occurrence and subsequent occurrences SHALL reference the original.
**Validates: Requirements 4.2**

### Property 6: Clause tracking preserves clause information
*For any* execution tree node that matched a clause, the analysis result SHALL include the clause number in the corresponding visualization node.
**Validates: Requirements 4.3**

### Property 7: Level-based variable naming produces unique names
*For any* execution tree with recursive calls, variables at different recursion levels SHALL have unique names following the pattern `{VarName}_L{level}`.
**Validates: Requirements 4.4**

### Property 8: Execution order is deterministic and sequential
*For any* execution tree, the determined execution order SHALL be consistent across multiple analyses of the same tree AND SHALL follow left-to-right, depth-first traversal.
**Validates: Requirements 4.5**

### Property 9: Activation relationships are recorded
*For any* pending goal that becomes active, the analysis result SHALL contain an edge of type 'activate' connecting the pending node to the solving node.
**Validates: Requirements 4.6**

### Property 10: Diagram contains all required node types
*For any* non-trivial execution tree, the generated Mermaid diagram SHALL contain at least one query node, and for successful executions SHALL contain a success node.
**Validates: Requirements 5.1**

### Property 11: Diagram styling matches node semantics
*For any* generated Mermaid diagram, query nodes SHALL have blue styling, solving nodes SHALL have yellow styling, pending nodes SHALL have gray styling, and solved/success nodes SHALL have green styling.
**Validates: Requirements 5.2, 5.3, 5.7**

### Property 12: Step numbers are sequential and use circled format
*For any* generated Mermaid diagram with N edges, the step numbers SHALL be the sequence ①②③...ⓝ with no gaps or duplicates.
**Validates: Requirements 5.4**

### Property 13: Arrow labels contain clause and binding information
*For any* edge in the generated diagram that represents a clause match, the edge label SHALL contain the clause identifier and any variable bindings.
**Validates: Requirements 5.6**

### Property 14: Markdown output contains all required sections
*For any* generated markdown output, the document SHALL contain: a title with the query, a code block with the original query, a mermaid code fence, a legend section, an execution steps section, a final answer section, and a clauses used section.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

## Error Handling

### Error Categories

1. **Input Errors**: Invalid arguments, missing files, malformed queries
2. **Dependency Errors**: Missing SWI-Prolog, missing sldnfdraw pack
3. **Processing Errors**: LaTeX parsing failures, analysis errors
4. **Output Errors**: File write failures, permission issues

### Error Response Strategy

All errors follow a consistent format:

```
Error: [ERROR_CODE] Brief description
Details: Specific information about what went wrong
Suggestion: How to fix the issue
```

Example:
```
Error: [SLDNFDRAW_NOT_INSTALLED] The sldnfdraw pack is not installed
Details: SWI-Prolog could not find the sldnfdraw library
Suggestion: Install it by running: swipl -g "pack_install(sldnfdraw)" -t halt
```

### Graceful Degradation

- If verbose output fails, continue with normal output
- If temp file cleanup fails, log warning but don't fail the operation
- If optional diagram features fail, produce simplified diagram

## Testing Strategy

### Property-Based Testing Library

The project will use **fast-check** for property-based testing in TypeScript. fast-check provides:
- Arbitrary generators for complex data structures
- Shrinking for minimal failing examples
- Integration with Jest/Vitest

### Unit Tests

Unit tests will cover:
- CLI argument parsing edge cases (empty args, unknown flags)
- Individual LaTeX parsing functions (bundle extraction, chunk parsing)
- Mermaid syntax generation for specific node/edge types
- Error message formatting

### Property-Based Tests

Each correctness property will be implemented as a property-based test:

```typescript
// Example: Property 3 - LaTeX parsing round-trip
// **Feature: prolog-trace-visualizer, Property 3: LaTeX parsing round-trip preserves structure**
test.prop([arbitraryExecutionTree()], (tree) => {
  const latex = serializeToLatex(tree);
  const parsed = parseLatex(latex);
  return isEquivalentTree(tree, parsed);
});
```

Property tests will run a minimum of 100 iterations each.

### Test File Organization

```
src/
├── cli.ts
├── cli.test.ts           # Unit tests for CLI
├── parser.ts
├── parser.test.ts        # Unit tests for parser
├── parser.property.test.ts  # Property tests for parser
├── analyzer.ts
├── analyzer.test.ts
├── analyzer.property.test.ts
├── mermaid.ts
├── mermaid.test.ts
├── mermaid.property.test.ts
├── renderer.ts
├── renderer.test.ts
└── renderer.property.test.ts
```

### Test Generators

Custom generators for property tests:

```typescript
// Generate arbitrary execution trees
const arbitraryExecutionTree = (): Arbitrary<ExecutionNode> =>
  fc.letrec(tie => ({
    leaf: fc.record({
      id: fc.uuid(),
      type: fc.constant('success' as const),
      goal: fc.string(),
      children: fc.constant([]),
      level: fc.nat({ max: 10 }),
    }),
    node: fc.record({
      id: fc.uuid(),
      type: fc.constantFrom('query', 'goal'),
      goal: arbitraryPrologGoal(),
      binding: fc.option(arbitraryBinding()),
      children: fc.array(tie('tree'), { maxLength: 3 }),
      level: fc.nat({ max: 10 }),
    }),
    tree: fc.oneof(tie('leaf'), tie('node')),
  })).tree;

// Generate arbitrary Prolog goals
const arbitraryPrologGoal = (): Arbitrary<string> =>
  fc.oneof(
    fc.constantFrom('true', 'fail'),
    fc.tuple(fc.stringOf(fc.char(), { minLength: 1 }), fc.array(fc.string()))
      .map(([name, args]) => args.length ? `${name}(${args.join(', ')})` : name)
  );
```

### Integration Tests

Integration tests will verify the full pipeline with real Prolog files:
- Simple fact queries
- Recursive predicate traces
- Multiple solution traces
- Error condition handling
