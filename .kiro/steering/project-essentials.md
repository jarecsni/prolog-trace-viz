---
inclusion: always
---

# Project Essentials - Prolog Trace Visualiser

## Project Overview

A TypeScript-based tool that generates enhanced visual trace diagrams for Prolog query execution. Produces markdown output with execution timelines, call trees (Mermaid diagrams), and query variable tracking.

## Key Technologies

- **Language**: TypeScript (ES modules)
- **Runtime**: Node.js
- **Testing**: Vitest with property-based testing
- **Prolog**: SWI-Prolog (for trace generation)
- **Build**: TypeScript compiler (tsc)

## Project Structure

```
src/                    # TypeScript source files
  ├── cli.ts           # Command-line interface
  ├── parser.ts        # Trace event parser
  ├── timeline.ts      # Timeline builder (merged CALL/EXIT)
  ├── variable-tracker.ts  # Query variable binding tracker
  ├── tree.ts          # Call tree builder
  ├── mermaid.ts       # Mermaid diagram generator
  └── *.test.ts        # Unit tests
examples/              # Example Prolog files and outputs
specs/                 # Design specifications
tracer.pl             # SWI-Prolog tracer implementation
```

## Development Workflow

### Running Tests

```
npm test                    # Run all tests
npm test -- src/file.test.ts  # Run specific test file
```

### Building

```
npm run build              # Compile TypeScript to dist/
```

### Running Examples

```
node dist/index.js examples/append.pl 'append([1,2], [3,4], X)'
./regenerate_examples.sh   # Regenerate all example outputs
```

## Release Process

**IMPORTANT**: Always use the release script, not manual `npm version`.

### Steps

1. **Ensure clean state**
   ```
   git status                    # Must be on main with no uncommitted changes
   git pull origin main          # Ensure up to date
   ```

2. **Run release script**
   ```
   npm run release patch         # Bug fixes (2.1.0 → 2.1.1)
   npm run release minor         # New features (2.1.0 → 2.2.0)
   npm run release major         # Breaking changes (2.1.0 → 3.0.0)
   npm run release 2.1.5         # Specific version
   ```

3. **What the script does**
   - Verifies you're on main branch with clean working directory
   - Updates package.json version
   - Regenerates build info (commit hash, branch)
   - Builds the project
   - Runs all tests
   - Updates CHANGELOG.md with new version and date
   - Creates release commit: `🔖 release vX.Y.Z`
   - Creates git tag: `vX.Y.Z`

4. **Push to GitHub**
   ```
   git push origin main --tags
   ```

5. **Publish to npm** (when ready)
   ```
   npm publish
   ```

### Release Script Location

`scripts/release.js` - handles the entire release process

### Version Semantics

- **Patch** (2.1.0 → 2.1.1): Bug fixes, no new features
- **Minor** (2.1.0 → 2.2.0): New features, backwards compatible
- **Major** (2.1.0 → 3.0.0): Breaking changes

## Git Workflow

### Branch Strategy

- `main` - production-ready code
- `feature/*` - feature branches (e.g., `feature/timeline-redesign`)

### Creating a Feature Branch

```
git checkout -b feature/my-feature
# Make changes, commit regularly
git push origin feature/my-feature
```

### Creating a Pull Request

Use GitHub MCP tools:
```
mcp_github_create_pull_request with:
  - owner: jarecsni
  - repo: prolog-trace-viz
  - head: feature/my-feature
  - base: main
  - title: "✨ descriptive title with gitmoji"
  - body: detailed description
```

### Merging Pull Request

```
mcp_github_merge_pull_request with:
  - owner: jarecsni
  - repo: prolog-trace-viz
  - pull_number: X
  - merge_method: squash
```

### After Merge

```
git checkout main
git pull origin main
# Continue with release process if needed
```

## Commit Message Format

Always use gitmoji at the start:

- ✨ `:sparkles:` - New feature
- 🐛 `:bug:` - Bug fix
- 📝 `:memo:` - Documentation
- ♻️ `:recycle:` - Refactoring
- ✅ `:white_check_mark:` - Tests
- 🔖 `:bookmark:` - Release/version tags

Example: `✨ add query variable tracking for recursive execution`

## Testing Philosophy

- Unit tests for core logic (parser, timeline, tree builders)
- Property-based tests for parsers and formatters
- Integration tests for end-to-end execution
- All tests must pass before release

## Key Features

### Timeline Redesign (v2.1.0)

- Merged CALL/EXIT pairs into single steps
- Query variable tracking (Russian doll pattern)
- Shows intermediate variable construction states
- Example: `X = ?` → `X = [1|?]` → `X = [1,2|?]` → `X = [1,2,3,4]`

### Variable Binding Tracker

- Event-driven processing of trace events
- Tracks bindings through parent_info field
- Processes events in chronological order
- Propagates bindings up the call chain

## Common Tasks

### Adding a New Feature

1. Create feature branch: `git checkout -b feature/my-feature`
2. Create spec document in `specs/` if complex
3. Implement with tests
4. Run `npm test` to verify
5. Update examples: `./regenerate_examples.sh`
6. Create PR and merge
7. Release with appropriate version bump

### Debugging Trace Issues

1. Generate raw trace: `swipl -g "consult('tracer.pl'), consult('examples/file.pl'), test_predicate, halt"`
2. Check trace JSON in `dev-tools/`
3. Use `dev-tools/test-trace-data.pl` for inspection

### Updating Examples

```
./regenerate_examples.sh     # Regenerates all examples
node dist/index.js examples/file.pl 'query'  # Single example
```

## Important Files

- `package.json` - Version, dependencies, scripts
- `CHANGELOG.md` - Release history (updated by release script)
- `tracer.pl` - SWI-Prolog tracer implementation
- `scripts/release.js` - Release automation
- `scripts/generate-build-info.js` - Build metadata generation

## Notes

- Always regenerate examples after changes to output format
- Keep CHANGELOG.md updated (release script does this)
- Use British English spelling in documentation
- Test with multiple Prolog examples before release
