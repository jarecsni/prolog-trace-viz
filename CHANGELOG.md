# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2025-12-14

## [1.0.2] - 2025-12-13

### Fixed
- Correct copyright year from 2024 to 2025
- Remove extra newline at start of copyright notice

## [1.0.1] - 2025-12-13

### Fixed
- Correct author email address in package.json and copyright notice

## [1.0.0] - 2025-12-13

### Added
- Copyright and version information display
- Build timestamp and git commit hash tracking
- Comprehensive changelog documentation

## [1.0.0] - 2024-12-13

### Added
- Initial release of Prolog Trace Visualiser (ptv)
- Generate Mermaid diagrams from SWI-Prolog trace execution
- Four detail levels: minimal, standard, detailed, full
- Support for recursive predicate visualisation with match nodes
- Clause alignment between tracer output and visualisation
- Comprehensive test coverage (180+ tests)
- Global npm package installation support
- Built-in tracer integration with SWI-Prolog

### Features
- **Query Visualisation**: Transform Prolog execution traces into clear Mermaid flowcharts
- **Detail Levels**: 
  - `minimal`: Basic execution flow
  - `standard`: Includes recursion indicators
  - `detailed`: Adds match nodes showing clause selection
  - `full`: Complete trace with all backtracking paths
- **Match Nodes**: Show exactly which clauses are being matched during execution
- **Recursion Detection**: Automatic identification and highlighting of recursive calls
- **Clause Alignment**: Perfect synchronisation between trace events and clause references
- **Built-in Filtering**: Removes infrastructure predicates (catch/3, format/2) from output

### Technical
- TypeScript implementation with comprehensive type safety
- Property-based testing with fast-check
- Integration tests for end-to-end functionality
- Robust error handling and parser warnings
- Cross-platform compatibility (macOS, Linux, Windows)

### Installation
```
npm install -g prolog-trace-viz
ptv your-program.pl "your_query(X)"
```

### Examples
- Factorial computation with recursion visualisation
- List membership with backtracking
- Append operations with unification details
- Arithmetic expression evaluation

---

## Release Notes

### Version 1.0.0 - "Foundation Release"

This initial release establishes ptv as a comprehensive tool for visualising Prolog execution traces. The core architecture supports extensible detail levels and maintains perfect alignment between SWI-Prolog's internal clause numbering and the generated visualisations.

Key architectural decisions:
- Extract clause definitions directly from trace events rather than parsing source files
- Use predicate-based matching with heuristics for base vs recursive case detection
- Implement comprehensive filtering to hide infrastructure predicates
- Provide four distinct detail levels for different use cases

The tool has been tested extensively with property-based testing and includes comprehensive integration tests to ensure reliability across different Prolog programs and query patterns.