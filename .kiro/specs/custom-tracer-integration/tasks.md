# Implementation Plan

- [x] 1. Create custom Prolog tracer
  - Implement `tracer.pl` with `prolog_trace_interception/4` hook
  - Implement event capture with frame attribute extraction
  - Implement JSON export functionality
  - Implement tracer lifecycle (install/remove)
  - Handle errors gracefully during event capture
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.4, 5.1, 5.2, 5.4_

- [x] 1.1 Write property test for event completeness
  - **Property 3: Event completeness**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 1.2 Write property test for exit event arguments
  - **Property 4: Exit event arguments**
  - **Validates: Requirements 2.4**

- [x] 1.3 Write property test for clause information presence
  - **Property 5: Clause information presence**
  - **Validates: Requirements 2.5**

- [x] 1.4 Write property test for tracer lifecycle correctness
  - **Property 7: Tracer lifecycle correctness**
  - **Validates: Requirements 3.1, 3.4, 5.4**

- [x] 1.5 Write property test for error resilience
  - **Property 13: Error resilience**
  - **Validates: Requirements 5.1, 5.2**

- [x] 1.6 Write unit tests for tracer edge cases
  - Test empty Prolog files
  - Test queries with no solutions
  - Test deeply recursive predicates
  - Test malformed queries
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Update data models and interfaces
  - Add `TraceEvent` interface to `parser.ts`
  - Add `Unification` interface to `parser.ts`
  - Update `ExecutionNode` interface with new fields (unifications, clauseLine, arguments)
  - Update `WrapperConfig` interface in `wrapper.ts`
  - Update `ExecutionResult` interface in `executor.ts` (json instead of latex)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Implement JSON parser to replace LaTeX parser
  - Create `parseTraceJson()` function to parse JSON trace events
  - Implement tree building algorithm using call/exit/redo/fail ports
  - Extract unifications from exit events
  - Map clause information to ExecutionNode
  - Handle malformed JSON gracefully
  - _Requirements: 2.6, 4.3, 6.1_

- [x] 3.1 Write property test for JSON round-trip
  - **Property 6: JSON output validity**
  - **Validates: Requirements 2.6**

- [x] 3.2 Write property test for parser format compatibility
  - **Property 11: Parser format compatibility**
  - **Validates: Requirements 4.3**

- [x] 3.3 Write property test for analyzer interface compatibility
  - **Property 12: Analyzer interface compatibility**
  - **Validates: Requirements 4.4, 6.1**

- [x] 3.4 Write unit tests for JSON parser
  - Test parsing valid trace events
  - Test handling missing fields
  - Test handling type mismatches
  - Test building tree from events
  - _Requirements: 2.6, 4.3_

- [x] 4. Update wrapper generator
  - Remove `instrumentPrologCode()` call from wrapper generation
  - Update wrapper template to load `tracer.pl`
  - Add `install_tracer/0` call before query execution
  - Add `export_trace_json/1` call after query
  - Add `remove_tracer/0` call for cleanup
  - Add error handling with catch/3
  - _Requirements: 3.1, 3.2, 3.4, 4.1_

- [x] 4.1 Write property test for code preservation
  - **Property 8: Code preservation**
  - **Validates: Requirements 3.2**

- [x] 4.2 Write unit tests for wrapper generation
  - Test wrapper template generation
  - Test tracer path resolution
  - Test error handling in wrapper
  - _Requirements: 3.1, 3.4, 5.3_

- [x] 5. Update executor
  - Remove sldnfdraw dependency check
  - Update `executeSldnfdraw()` to `executeTracer()`
  - Execute wrapper with `swipl` directly
  - Read JSON output file instead of LaTeX
  - Return JSON string in `ExecutionResult`
  - Add SWI-Prolog version check (>= 7.0)
  - _Requirements: 4.1, 4.2, 5.3_

- [x] 5.1 Write property test for dependency independence
  - **Property 10: Dependency independence**
  - **Validates: Requirements 4.1, 4.2**

- [x] 5.2 Write unit tests for executor
  - Test successful execution
  - Test query failure vs execution error
  - Test file not found error
  - Test SWI-Prolog version check
  - _Requirements: 4.1, 4.2, 5.3_

- [x] 6. Update main entry point
  - Update `src/index.ts` to use `executeTracer()` instead of `executeSldnfdraw()`
  - Update to call `parseTraceJson()` instead of `parseLatex()`
  - Remove instrumentation step from pipeline
  - Update error messages to reference custom tracer
  - _Requirements: 4.1, 4.3_

- [x] 7. Simplify clauses.ts
  - Remove `instrumentPrologCode()` function (no longer needed)
  - Keep `parsePrologFile()` for clause list display
  - Update tests to remove instrumentation tests
  - _Requirements: 3.2, 4.1_

- [x] 8. Update analyzer for accurate unifications
  - Remove unification inference logic (no longer needed)
  - Use unifications directly from ExecutionNode
  - Use clause numbers directly from trace events
  - Verify analyzer works with new ExecutionNode structure
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.3_

- [x] 8.1 Write property test for unification accuracy
  - **Property 1: Unification accuracy**
  - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 8.2 Write property test for unbound variable indication
  - **Property 2: Unbound variable indication**
  - **Validates: Requirements 1.3**

- [x] 8.3 Write property test for clause number consistency
  - **Property 15: Clause number consistency**
  - **Validates: Requirements 6.3**

- [x] 8.4 Write unit tests for analyzer with new data
  - Test analysis with accurate unifications
  - Test handling of unbound variables
  - Test clause number mapping
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.3_

- [x] 9. Verify renderer and Mermaid generator compatibility
  - Run existing renderer tests with new analyzer output
  - Run existing Mermaid generator tests with new analyzer output
  - Verify no modifications needed
  - _Requirements: 6.4_

- [x] 9.1 Write property test for renderer compatibility
  - **Property 16: Renderer compatibility**
  - **Validates: Requirements 6.4**

- [x] 9.2 Write property test for tree structure preservation
  - **Property 14: Tree structure preservation**
  - **Validates: Requirements 6.2**

- [x] 10. Implement visualization correctness properties
  - Verify subgoal edge generation in analyzer
  - Verify success and failure edges
  - Verify backtracking edges with clause numbers
  - Verify step numbering is sequential
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3_

- [x] 10.1 Write property test for subgoal edge generation
  - **Property 17: Subgoal edge generation**
  - **Validates: Requirements 7.1, 7.3, 8.2, 8.3**

- [x] 10.2 Write property test for success and failure edges
  - **Property 18: Success and failure edges**
  - **Validates: Requirements 7.2**

- [x] 10.3 Write property test for backtracking edges
  - **Property 19: Backtracking edges**
  - **Validates: Requirements 7.4, 9.2**

- [x] 10.4 Write property test for step numbering
  - **Property 20: Step numbering**
  - **Validates: Requirements 7.5**

- [x] 11. Implement subgoal decomposition visualization
  - Verify subgoal node creation in analyzer
  - Verify subgoal completion propagation
  - Verify subgoal failure short-circuit
  - _Requirements: 8.1, 8.4, 8.5_

- [x] 11.1 Write property test for subgoal node creation
  - **Property 21: Subgoal node creation**
  - **Validates: Requirements 8.1**

- [x] 11.2 Write property test for subgoal completion propagation
  - **Property 22: Subgoal completion propagation**
  - **Validates: Requirements 8.4**

- [x] 11.3 Write property test for subgoal failure short-circuit
  - **Property 23: Subgoal failure short-circuit**
  - **Validates: Requirements 8.5**

- [x] 12. Implement clause selection visualization
  - Verify clause attempt ordering in analyzer
  - Verify goal failure indication
  - Verify success short-circuit (no subsequent clauses)
  - _Requirements: 9.1, 9.3, 9.4, 9.5_

- [x] 12.1 Write property test for clause attempt ordering
  - **Property 24: Clause attempt ordering**
  - **Validates: Requirements 9.1, 9.3**

- [x] 12.2 Write property test for goal failure indication
  - **Property 25: Goal failure indication**
  - **Validates: Requirements 9.4**

- [x] 12.3 Write property test for success short-circuit
  - **Property 26: Success short-circuit**
  - **Validates: Requirements 9.5**

- [x] 13. End-to-end integration testing
  - Test complete pipeline with factorial example
  - Test complete pipeline with append example
  - Test complete pipeline with member example
  - Test complete pipeline with operators example
  - Compare output quality with sldnfdraw version
  - _Requirements: 4.5, 6.2, 6.4_

- [x] 13.1 Write property test for behavioral equivalence
  - **Property 9: Behavioral equivalence**
  - **Validates: Requirements 3.3**

- [x] 13.2 Write integration tests for complete pipeline
  - Test factorial trace end-to-end
  - Test append trace end-to-end
  - Test member trace end-to-end
  - Test operators trace end-to-end
  - _Requirements: 4.5, 6.2, 6.4_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Update documentation
  - Update README with custom tracer information
  - Remove sldnfdraw installation instructions
  - Add SWI-Prolog version requirement (>= 7.0)
  - Update examples with new output format
  - Document tracer architecture and design decisions
  - _Requirements: 4.2_

- [ ] 16. Regenerate all example outputs
  - Delete old example outputs
  - Generate new outputs for all examples with all detail levels
  - Verify output quality matches or exceeds sldnfdraw version
  - _Requirements: 4.5_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

