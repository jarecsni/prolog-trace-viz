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
- `bugfix/*` - bugfix branches (e.g., `bugfix/timeline-merging-fix`)

### Bugfix Release Workflow

When working on a bugfix that needs to be released:

1. **Create bugfix branch from main**
   ```
   git checkout main
   git pull origin main
   git checkout -b bugfix/descriptive-name
   ```

2. **Make changes and commit regularly**
   ```
   git add .
   git commit -m "🐛 fix: descriptive message"
   ```

3. **Update CHANGELOG.md**
   - Add entry under `## [Unreleased]` section
   - Describe the bug fix clearly
   - Reference any related issues
   ```markdown
   ## [Unreleased]
   
   ### Fixed
   - Fixed timeline merging bug where steps appeared out of order for recursive predicates
   - Synchronized call tree diagram step numbers with timeline steps
   ```

4. **Run tests and regenerate examples**
   ```
   npm test
   npm run build
   ./regenerate_examples.sh
   ```

5. **Commit CHANGELOG and any example updates**
   ```
   git add CHANGELOG.md examples/
   git commit -m "📝 update changelog and examples for bugfix"
   ```

6. **Push branch to GitHub**
   ```
   git push origin bugfix/descriptive-name
   ```

7. **Create Pull Request**
   ```
   Use GitHub MCP tools or web interface:
   - owner: jarecsni
   - repo: prolog-trace-viz
   - head: bugfix/descriptive-name
   - base: main
   - title: "🐛 fix: descriptive title"
   - body: detailed description of bug and fix
   ```

8. **Merge Pull Request**
   ```
   After review and approval:
   - merge_method: squash (combines all commits into one)
   ```

9. **Switch back to main and pull**
   ```
   git checkout main
   git pull origin main
   ```

10. **Run release script**
    ```
    npm run release patch    # For bugfixes, use patch version bump
    ```
    
    This will:
    - Update version in package.json
    - Move CHANGELOG [Unreleased] entries to new version section
    - Build and test
    - Create release commit and tag

11. **Push release to GitHub**
    ```
    git push origin main --tags
    ```

12. **Publish to npm** (manual step)
    ```
    npm publish
    ```
    
    User takes over for manual npm publishing.

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

### CRITICAL: Test Coverage for Changes

**Every new feature or bug fix MUST include new test cases that cover the change.**

- New features: Add tests that verify the feature works correctly
- Bug fixes: Add regression tests that would have caught the bug
- Refactoring: Ensure existing tests still pass, add tests if coverage gaps exist

Do NOT rely solely on existing tests passing. The change itself needs dedicated test coverage to prevent regressions.

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

**CRITICAL**: Always generate and inspect the raw trace JSON first before assuming bugs in our code!

1. **Create a test wrapper** (like the one in `src/wrapper.ts`):
   ```
   cat > /tmp/test-query.pl << 'EOF'
   :- ['/path/to/tracer.pl'].
   
   % Your Prolog code here
   
   run_trace :-
       install_tracer(100),
       catch(
           (your_query_here, export_trace_json('/tmp/trace.json')),
           Error,
           (format('Error: ~w~n', [Error]), export_trace_json('/tmp/trace.json'))
       ),
       remove_tracer.
   
   :- run_trace.
   :- halt.
   EOF
   ```

2. **Run it**: `swipl /tmp/test-query.pl`

3. **Inspect the JSON**: `python3 -m json.tool /tmp/trace.json | grep '"goal"' | head -20`

4. **Check what SWI-Prolog actually recorded** - if the goals look wrong in the JSON, it's how Prolog represents them internally (e.g., operator associativity), not our bug

5. Use `dev-tools/test-trace-data.pl` for deeper inspection if needed

**Remember**: The trace JSON is the source of truth. If it looks wrong there, it's either:
- How Prolog internally represents the terms (operator precedence/associativity)
- A bug in the tracer.pl itself
- NOT a bug in our TypeScript code

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
