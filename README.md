# prolog-trace-viz

Generate beautiful, educational Mermaid diagrams from Prolog execution traces.

## Features

- Custom Prolog tracer using SWI-Prolog's trace interception hook
- Captures accurate unification information directly from execution
- Generates colour-coded Mermaid diagrams
- Produces complete markdown documentation with step-by-step breakdowns
- Tracks pending goals, variable bindings, and clause usage
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
| `-o, --output <file>` | Write output to file instead of stdout |
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
2. **Execution tree** - A Mermaid diagram showing the trace
3. **Legend** - Explanation of visual elements
4. **Step-by-step breakdown** - Detailed execution steps
5. **Final answer** - The result bindings
6. **Clauses used** - Summary of which clauses matched

### Visual Elements

| Symbol | Meaning |
|--------|---------|
| 🎯 | Initial query |
| 🔄 | Currently solving |
| ⏸️ | Pending (queued) |
| ✅ | Solved |
| 🎉 | Success |

### Colour Scheme

- **Blue** - Query nodes
- **Yellow** - Solving nodes
- **Grey** - Pending nodes
- **Green** - Solved/Success nodes

## Architecture

The tool uses a custom Prolog tracer that leverages SWI-Prolog's `prolog_trace_interception/4` hook to capture execution events. This approach provides several advantages:

- **Accurate unifications**: Direct access to variable bindings via `prolog_frame_attribute/3`
- **No code instrumentation**: Your Prolog code runs unmodified
- **Reliable clause tracking**: Clause numbers come from Prolog's internal tracking
- **Structured output**: JSON-based trace format for easy parsing

### Pipeline

1. Parse user's Prolog file to extract clauses
2. Generate wrapper that loads custom tracer
3. Execute query with trace interception active
4. Export trace events as JSON
5. Build execution tree from trace events
6. Analyze tree and generate visualization
7. Render as Mermaid diagram in markdown

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
