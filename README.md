# prolog-trace-viz

Generate beautiful, educational visualisations from Prolog execution traces.

## Features

- Custom Prolog tracer using SWI-Prolog's trace interception hook
- Captures accurate unification information directly from execution
- **Dual visualisation format**: execution timeline + call tree diagram
- **Pattern matching display**: Shows how goals unify with clause heads
- **Subgoal tracking**: Labels and tracks subgoals with [N.M] notation
- Generates colour-coded Mermaid diagrams
- Produces complete markdown documentation with step-by-step breakdowns
- Tracks variable bindings and clause usage
- **Smart clause filtering** - Only shows clauses that were actually used during execution
- **Depth limiting** - Control trace depth to focus on relevant execution
- No external dependencies beyond SWI-Prolog

## Prerequisites

**SWI-Prolog 7.0 or later** - Install from https://www.swi-prolog.org/Download.html

The tool uses a custom tracer built on SWI-Prolog's `prolog_trace_interception/4` hook, which requires version 7.0 or later. No additional packages are required.

## Installation

```
npm install -g prolog-trace-viz
```

Or run directly with npx:

```
npx prolog-trace-viz <prolog-file> <query>
```

## Usage

```
prolog-trace-viz <prolog-file> <query> [options]
```

### Arguments

- `<prolog-file>` - Path to your Prolog source file
- `<query>` - Prolog query to trace (e.g., `"append([1,2], [3,4], X)"`)

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Write output to file (default: `<source>-output.md`) |
| `--depth <number>` | Maximum trace depth to capture (default: 100) |
| `--verbose` | Display detailed processing information |
| `--quiet` | Suppress all non-error output except final result |
| `-h, --help` | Show help message |
| `-v, --version` | Show version number |

### Examples

Basic usage:

```
prolog-trace-viz program.pl "append([1,2], [3,4], X)"
```

Save to file:

```
prolog-trace-viz program.pl "member(X, [a,b,c])" -o trace.md
```

With verbose output:

```
prolog-trace-viz program.pl "factorial(5, X)" --verbose
```

Limit trace depth:

```
prolog-trace-viz program.pl "factorial(10, X)" --depth 20
```

## Example Output

Given a simple Prolog file `append.pl`:

```prolog
append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).
```

Running:

```
prolog-trace-viz append.pl "append([1,2], [3], X)"
```

Produces a markdown document with:

1. **Query section** - The original query in a code block
2. **Clause definitions** - Table showing clauses used during execution
3. **Execution timeline** - Step-by-step breakdown with subgoal tracking
4. **Call tree diagram** - Mermaid visualisation showing execution structure
5. **Final answer** - The result bindings with original query variables

### Timeline Format

The execution timeline shows each step with:
- Step number and event type (CALL, EXIT, REDO, FAIL)
- Goal being solved
- Pattern matches and unifications
- Subgoal labels in `[N.M]` format
- Variable flow between steps
- Box drawing characters for visual structure

### Call Tree Format

The Mermaid diagram shows:
- Circled numbers (①②③...) for step references
- Node colours: blue (root query), green (success), red (failure)
- Edges labelled with subgoal relationships
- Clause numbers for each call
- Final bindings at EXIT nodes

## Architecture

The tool uses a custom Prolog tracer that leverages SWI-Prolog's `prolog_trace_interception/4` hook to capture execution events. This approach provides several advantages:

- **Accurate unifications**: Direct access to variable bindings via `prolog_frame_attribute/3`
- **No code instrumentation**: Your Prolog code runs unmodified
- **Reliable clause tracking**: Clause numbers come from Prolog's internal tracking
- **Structured output**: JSON-based trace format for easy parsing
- **Depth control**: Configurable trace depth to manage output size

### Pipeline

1. Parse user's Prolog file to extract clauses
2. Generate wrapper that loads custom tracer with depth limit
3. Execute query with trace interception active
4. Export trace events as JSON
5. Build execution timeline and call tree in parallel
6. Format timeline with subgoal tracking and variable flow
7. Generate Mermaid diagram from call tree
8. Render complete markdown document

## Development

```
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Licence

MIT
