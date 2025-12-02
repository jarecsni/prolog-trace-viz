# prolog-trace-viz

Generate beautiful, educational Mermaid diagrams from Prolog execution traces.

## Features

- Automatically wraps your Prolog files for sldnfdraw
- Parses LaTeX output into structured execution trees
- Generates colour-coded Mermaid diagrams
- Produces complete markdown documentation with step-by-step breakdowns
- Tracks pending goals, variable bindings, and clause usage

## Prerequisites

1. **SWI-Prolog** - Install from https://www.swi-prolog.org/Download.html

2. **sldnfdraw pack** - Install by running:

```
swipl -g "pack_install(sldnfdraw)" -t halt
```

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
| `--depth <n>` | Set maximum trace depth for sldnfdraw |
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

With depth limit and verbose output:

```
prolog-trace-viz program.pl "factorial(5, X)" --depth 10 --verbose
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
