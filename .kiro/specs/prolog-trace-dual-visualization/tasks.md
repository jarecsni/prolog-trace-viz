# Implementation Plan: Prolog Trace Dual Visualization

## Overview

This plan implements a dual-format Prolog trace visualization system with an execution timeline and call tree. The implementation reuses existing tracer infrastructure (~40% of current code) and rebuilds the parsing, analysis, and formatting layers from scratch.

## Tasks

- [x] 1. Update CLI to remove detail levels and add depth option
  - Remove `--detail` option and related code
  - Add `--depth` option with default value of 100
  - Update help text to reflect changes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 2. Preserve original query before tracer execution
  - [x] 2.1 Capture original query string from CLI arguments
    - Store query before passing to Prolog
    - Extract variable names from original query
    - _Requirements: 2.8_
  
  - [x] 2.2 Pass original query through to formatter
    - Add originalQuery parameter to analysis pipeline
    - Use for first match box and final answer display
    - _Requirements: 2.8_

- [x] 3. Implement depth limiting in tracer wrapper
  - [x] 3.1 Add depth parameter to wrapper generation
    - Pass depth limit to Prolog tracer
    - Default to 100 if not specified
    - _Requirements: 1.7, 1.8, 15.6_
  
  - [x] 3.2 Handle depth limit in trace events
    - Stop capturing events at depth limit
    - Add truncation marker to JSON output
    - _Requirements: 15.7, 15.8_

- [x] 4. Build Timeline Builder component
  - [x] 4.1 Create TimelineStep interface and builder class
    - Define TimelineStep structure with all fields
    - Initialize builder with trace events
    - _Requirements: 3.1, 3.2_
  
  - [x] 4.2 Process CALL events into timeline steps
    - Extract goal, clause, unifications
    - Generate subgoal labels [N.M]
    - Track which subgoal is being solved
    - _Requirements: 3.2, 7.1, 7.2, 7.9, 7.10_
  
  - [x] 4.3 Process EXIT events into timeline steps
    - Extract final bindings
    - Reference return-to step
    - Mark completed subgoal
    - Indicate next subgoal
    - _Requirements: 3.3, 7.3, 7.7, 7.11, 7.12_
  
  - [x] 4.4 Process REDO events into timeline steps
    - Show backtracking indicator
    - Reference step being retried
    - _Requirements: 3.4, 9.1, 9.3_
  
  - [x] 4.5 Process FAIL events into timeline steps
    - Show failure indicator
    - Reference parent step
    - _Requirements: 3.5, 9.2, 9.5_

- [x] 5. Build Tree Builder component
  - [x] 5.1 Create TreeNode interface and builder class
    - Define TreeNode structure
    - Implement node ID generation (A-Z, AA-AZ, etc.)
    - _Requirements: 4.1, 4.4_
  
  - [x] 5.2 Build tree structure from trace events
    - Track call stack by level
    - Create parent-child relationships
    - Assign CALL and EXIT step numbers to nodes
    - _Requirements: 4.3, 4.5, 4.6_
  
  - [x] 5.3 Determine node status (success/failure)
    - Mark successful paths green
    - Mark failed attempts red
    - Mark root query blue
    - _Requirements: 4.5, 4.6, 4.7_

- [x] 6. Implement Unification Extractor
  - [x] 6.1 Create structural goal comparison
    - Parse goals into predicate + arguments
    - Match arguments positionally
    - Handle nested structures recursively
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 6.2 Extract CALL vs EXIT unifications
    - Compare CALL goal with EXIT goal
    - Identify variable bindings
    - Format as "variable = value"
    - _Requirements: 5.1, 5.4_
  
  - [x] 6.3 Extract clause head pattern matches
    - Compare goal with clause head
    - Extract pattern match bindings
    - _Requirements: 5.5_
  
  - [x] 6.4 Handle complex unifications
    - Lists: [H|T] patterns
    - Compound terms
    - Arithmetic expressions
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 7. Implement Subgoal Extractor
  - [x] 7.1 Parse clause body into subgoals
    - Split on commas respecting parentheses
    - Handle nested structures
    - _Requirements: 7.1, 7.3_
  
  - [x] 7.2 Generate subgoal labels
    - Format as [StepNumber.SubgoalIndex]
    - Track subgoal-to-step mapping
    - _Requirements: 7.2, 7.9_
  
  - [x] 7.3 Track variable flow between subgoals
    - Identify shared variables
    - Show substitutions
    - Add flow notes
    - _Requirements: 7.5, 7.6, 7.7, 7.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 8. Implement Clause Numbering
  - [x] 8.1 Parse source file to identify clauses
    - Group clauses by line number
    - Assign sequential indices within each line
    - _Requirements: 6.2, 6.3_
  
  - [x] 8.2 Format clause numbers with dot notation
    - Single clause: "26"
    - Multiple clauses: "26.1", "26.2", "26.3"
    - _Requirements: 6.3_

- [x] 9. Build Timeline Formatter
  - [x] 9.1 Format CALL steps
    - Show goal, pattern match, clause info
    - Display spawned subgoals with labels
    - Add "◀── Solving subgoal [X.Y]" marker
    - _Requirements: 3.2, 3.6, 3.7, 3.8, 3.9, 7.10_
  
  - [x] 9.2 Format EXIT steps
    - Show bindings, return-to reference
    - Add "◀── Completed subgoal [X.Y]" marker
    - Indicate next subgoal
    - Add variable flow notes
    - _Requirements: 3.3, 3.10, 7.11, 7.12, 10.5_
  
  - [x] 9.3 Format REDO steps
    - Show "◀── Retrying Step N" marker
    - Indicate which clause being tried
    - _Requirements: 3.4, 9.1, 9.3, 9.4_
  
  - [x] 9.4 Format FAIL steps
    - Show failure reason
    - Reference parent step
    - _Requirements: 3.5, 9.2, 9.5_
  
  - [x] 9.5 Handle built-in predicates concisely
    - Show evaluation for arithmetic
    - Minimize visual noise for `true`
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 10. Build Tree Formatter (Mermaid)
  - [x] 10.1 Generate Mermaid node definitions
    - Format: `ID["① goal<br/>clause N<br/>⑥ EXIT: binding"]`
    - Use circled numbers for steps
    - Include clause numbers
    - _Requirements: 4.2, 4.4_
  
  - [x] 10.2 Generate Mermaid edges
    - Format: `A -->|subgoal 1| B`
    - Label with relationship type
    - _Requirements: 4.3_
  
  - [x] 10.3 Apply node styling
    - Blue for root query
    - Green for success
    - Red for failure
    - _Requirements: 4.5, 4.6, 4.7_
  
  - [x] 10.4 Handle backtracking in tree
    - Show failed attempts
    - Show alternative clause tries
    - _Requirements: 9.6, 9.7_

- [x] 11. Build Markdown Output Generator
  - [x] 11.1 Generate document header
    - Title with query
    - Original query code block
    - Clause definitions table
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [x] 11.2 Generate timeline section
    - Format all timeline steps
    - Use box drawing characters
    - Add step numbers prominently
    - _Requirements: 13.5_
  
  - [x] 11.3 Generate tree section
    - Embed Mermaid diagram
    - Add legend if needed
    - _Requirements: 13.6_
  
  - [x] 11.4 Generate final answer section
    - Show query result
    - Use original query variables
    - Note if truncated or first solution only
    - _Requirements: 13.7, 2.7, 15.8_
  
  - [x] 11.5 Apply formatting rules
    - Plain code blocks (no syntax highlighting)
    - No `?-` prompt in queries
    - British English spelling
    - _Requirements: 13.8, 13.9_

- [x] 12. Handle multiple solutions
  - Stop processing after first successful EXIT of root query
  - Add note: "Showing first solution only"
  - _Requirements: 2.7_

- [x] 13. Integrate all components
  - [x] 13.1 Wire event parser to timeline builder
    - Pass trace events to timeline builder
    - Pass original query context
    - _Requirements: 3.1_
  
  - [x] 13.2 Wire event parser to tree builder
    - Pass trace events to tree builder
    - Build tree in parallel with timeline
    - _Requirements: 4.1_
  
  - [x] 13.3 Wire builders to markdown formatter
    - Pass timeline steps to formatter
    - Pass tree nodes to formatter
    - Pass clause definitions to formatter
    - _Requirements: 13.1_
  
  - [x] 13.4 Update main execution flow
    - Remove old LaTeX parsing
    - Remove old analyzer
    - Use new builders and formatters
    - _Requirements: 2.1, 3.1, 4.1_

- [x] 14. Error handling
  - [x] 14.1 Handle missing trace data gracefully
    - Omit missing information
    - Add notes about unavailable data
    - Continue processing
    - _Requirements: 12.7_
  
  - [x] 14.2 Handle malformed events
    - Log error with context
    - Skip malformed event
    - Continue processing
    - _Requirements: 14.4_
  
  - [x] 14.3 Handle stack inconsistencies
    - Create placeholder entries
    - Mark as "recovered"
    - Note inconsistency
    - _Requirements: 14.4_

- [ ] 15. Testing and validation
  - [x] 15.1 Write unit tests for unification extraction
    - Test simple variable bindings
    - Test complex structures (lists, compounds)
    - Test arithmetic expressions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 15.2 Write unit tests for subgoal extraction
    - Test clause body parsing
    - Test subgoal labelling
    - Test variable flow tracking
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  
  - [x] 15.3 Write unit tests for timeline builder
    - Test CALL/EXIT/REDO/FAIL processing
    - Test step numbering
    - Test subgoal markers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 15.4 Write unit tests for tree builder
    - Test node creation
    - Test parent-child relationships
    - Test node ID generation
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 15.5 Write integration test for simple recursion (t/2)
    - Run tracer on t/2 example
    - Verify timeline format
    - Verify tree structure
    - Check cross-references
    - _Requirements: 2.1, 3.1, 4.1, 8.1_
  
  - [x] 15.6 Write integration test for backtracking (member/2)
    - Run tracer on member/2 example
    - Verify REDO/FAIL handling
    - Verify clause retry visualization
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 15.7 Write integration test for cut (max/3)
    - Run tracer on max/3 example
    - Verify cut visualization
    - Verify subgoal tracking
    - _Requirements: 18.1, 18.2, 18.3_
  
  - [x] 15.8 Write integration test for arithmetic (factorial/2)
    - Run tracer on factorial/2 example
    - Verify deep recursion handling
    - Verify variable flow between subgoals
    - Check all 26 steps formatted correctly
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 15.9 Write integration test for lists (append/3)
    - Run tracer on append/3 example
    - Verify list unification display
    - Verify nested subgoal tracking
    - _Requirements: 16.1, 16.2_
  
  - [x] 15.10 Write property test for timeline completeness
    - **Property 1: Timeline Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  
  - [x] 15.11 Write property test for step number consistency
    - **Property 2: Step Number Consistency**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.7**
  
  - [x] 15.12 Write property test for tree structure validity
    - **Property 3: Tree Structure Validity**
    - **Validates: Requirements 4.1, 4.3, 2.6**
  
  - [x] 15.13 Write property test for unification correctness
    - **Property 4: Unification Correctness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  
  - [x] 15.14 Write property test for subgoal ordering
    - **Property 5: Subgoal Ordering**
    - **Validates: Requirements 7.2, 7.3**
  
  - [x] 15.15 Write property test for cross-reference validity
    - **Property 6: Cross-Reference Validity**
    - **Validates: Requirements 8.4, 8.5, 8.6**
  
  - [x] 15.16 Write property test for no heuristics
    - **Property 7: No Heuristics**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7**

- [x] 16. Documentation and cleanup
  - Update README with new visualization format
  - Remove old detail level documentation
  - Add examples of timeline and tree output
  - Document depth limiting feature
  - _Requirements: 1.1, 1.7, 1.8_

## Notes

- Each integration test should verify both timeline and tree output
- Property tests should run minimum 100 iterations
- Reuse existing: tracer.pl, CLI infrastructure, clause parsing, wrapper generation
- Replace completely: LaTeX parsing, tree building, analyzer, Mermaid generation

## Phase 2: Implementation Gap Fixes

After initial implementation, a review against requirements revealed significant gaps in the educational detail. These tasks address missing functionality to meet the full specification.

- [x] 17. Enhance Timeline Formatter with Clause Information
  - [x] 17.1 Display clause head in CALL steps
    - Show matched clause head with pattern
    - Include clause line number
    - _Requirements: 3.2, 6.1, 6.2_
  
  - [x] 17.2 Display clause body in CALL steps
    - Show the body goals that will be spawned
    - Format body readably
    - _Requirements: 3.2, 6.4_
  
  - [x] 17.3 Extract and display spawned subgoals
    - Parse clause body to extract subgoals
    - Assign labels [N.M] to each subgoal
    - Display list of spawned subgoals in CALL step
    - _Requirements: 3.2, 7.1, 7.2, 7.9_

- [x] 18. Implement Subgoal Tracking in Timeline
  - [x] 18.1 Add subgoal label tracking
    - Track which subgoal each CALL is solving
    - Map subgoal labels to step numbers
    - _Requirements: 7.2, 7.9_
  
  - [x] 18.2 Add "Solving subgoal" markers
    - Display "◀── Solving subgoal [X.Y]" in CALL steps
    - Reference parent step that spawned this subgoal
    - _Requirements: 7.4, 7.10_
  
  - [x] 18.3 Add "Completed subgoal" markers
    - Display "◀── Completed subgoal [X.Y]" in EXIT steps
    - Show which subgoal was completed
    - _Requirements: 7.4, 7.11_
  
  - [x] 18.4 Add "Next subgoal" indicators
    - Show which subgoal comes next after EXIT
    - Reference the next subgoal label
    - _Requirements: 7.12_

- [ ] 19. Implement Variable Flow Tracking
  - [ ] 19.1 Track variable bindings across subgoals
    - Identify shared variables between subgoals
    - Track when variables get bound
    - _Requirements: 10.1, 10.4_
  
  - [ ] 19.2 Show variable substitutions
    - Display how bound variables affect subsequent subgoals
    - Show substituted values in subgoal calls
    - _Requirements: 10.2, 10.3_
  
  - [ ] 19.3 Add variable flow notes
    - Add notes indicating where values came from
    - Show which previous step bound a variable
    - _Requirements: 10.5, 10.7_
  
  - [ ] 19.4 Display clause variables consistently
    - Use consistent naming for clause-local variables (e.g., X1)
    - Show same variable name across all subgoals
    - _Requirements: 7.7, 7.8, 10.6_

- [x] 20. Enhance Tree Formatter with Missing Details
  - [x] 20.1 Add clause numbers to tree nodes
    - Extract clause line numbers from trace
    - Display in node label
    - Use dot notation for multiple clauses on same line
    - _Requirements: 4.2, 6.2, 6.3_
  
  - [ ] 20.2 Improve edge labels with subgoal content
    - Show actual subgoal instead of generic "subgoal N"
    - Extract subgoal text from clause body
    - Keep labels concise but meaningful
    - _Requirements: 4.3, 7.1_
  
  - [x] 20.3 Add clause head to node display
    - Show matched clause head in node
    - Format compactly for readability
    - _Requirements: 4.2, 6.1_

- [x] 21. Improve Subgoal Extraction Logic
  - [x] 21.1 Parse clause bodies correctly
    - Split on commas respecting parentheses
    - Handle nested structures
    - Preserve operator precedence
    - _Requirements: 7.1, 7.3_
  
  - [x] 21.2 Extract subgoals with proper formatting
    - Maintain variable names from clause
    - Handle complex terms correctly
    - _Requirements: 7.1, 7.5_
  
  - [x] 21.3 Map subgoals to execution steps
    - Track which step solves which subgoal
    - Handle recursive calls correctly
    - _Requirements: 7.2, 7.4_

- [x] 22. Enhance Unification Display
  - [x] 22.1 Show pattern match bindings
    - Extract bindings from clause head match
    - Display in CALL step
    - _Requirements: 5.5, 6.1_
  
  - [x] 22.2 Improve complex unification formatting
    - Handle list structures clearly
    - Show compound terms properly
    - Preserve arithmetic expressions
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [x] 22.3 Map internal variables to original query
    - Already implemented for final answer
    - Extend to all unification displays
    - _Requirements: 2.8_

- [x] 23. Testing and Validation
  - [x] 23.1 Test with factorial example
    - Verify all subgoals shown
    - Check variable flow tracking
    - Validate clause information display
    - _Requirements: 15.8_
  
  - [x] 23.2 Test with append example
    - Verify list unification display
    - Check recursive subgoal tracking
    - _Requirements: 15.9_
  
  - [x] 23.3 Test with member example (backtracking)
    - Verify REDO/FAIL handling
    - Check alternative clause attempts
    - _Requirements: 15.6_
  
  - [x] 23.4 Test with complex nested example
    - Verify deep subgoal nesting
    - Check variable flow across multiple levels
    - _Requirements: 10.1-10.7_
  
  - [x] 23.5 Update or remove old parser tests
    - Old tests reference removed code
    - Either update to test new pipeline or remove
    - _Requirements: 14.1-14.3_

- [x] 24. Documentation Updates
  - [x] 24.1 Update README with example output
    - Show actual timeline format
    - Show actual tree format
    - Highlight educational features
    - _Requirements: 13.1-13.9_
  
  - [x] 24.2 Document subgoal tracking feature
    - Explain [N.M] notation
    - Show how to read subgoal markers
    - _Requirements: 7.9, 7.10, 7.11_
  
  - [x] 24.3 Document variable flow visualization
    - Explain how to follow variable bindings
    - Show examples of flow notes
    - _Requirements: 10.1-10.7_

## Phase 3: Critical Gap Resolution

After comparing actual output against requirements and design, significant gaps were found in Phase 2 implementation. These tasks fix the core educational features that are currently broken or missing.

- [x] 25. Fix Clause Head Display with Source Variables
  - [x] 25.1 Implement source file parsing
    - Parse Prolog source file to extract original clause text
    - Map line numbers to clause definitions
    - Preserve original variable names (X, Z, etc.)
    - _Requirements: 6.1, 6.7_
  
  - [x] 25.2 Replace runtime clause heads with source clause heads
    - Use parsed source clauses instead of tracer's mangled versions
    - Display "Head: t(X+1+1, Z)" not "Head: t(_578+1+1, _568)"
    - Apply to all CALL steps
    - _Requirements: 6.1, 6.4_
  
  - [x] 25.3 Update subgoal display to use source variables
    - Show "[1.1] t(X+1, X1)" not "[1.1] t(_578+1, _592)"
    - Extract from parsed source clause body
    - _Requirements: 7.1, 7.5_

- [x] 26. Fix Pattern Match Binding Extraction
  - [x] 26.1 Implement positional structural matching
    - Compare CALL goal with source clause head positionally
    - Extract variable bindings by structural decomposition
    - Handle compound terms recursively (e.g., X+1+1 matches 0+1+1 → X=0)
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 26.2 Display extracted bindings correctly
    - Show "├─ X = 0" not "├─ _578+1+1 = 0+1+1"
    - Show actual variable-to-value mappings
    - Use source variable names
    - _Requirements: 5.5, 6.1_
  
  - [x] 26.3 Handle complex pattern matches
    - Arithmetic expressions: X+1+1 = 0+1+1 → X=0
    - List patterns: [H|T] = [1,2,3] → H=1, T=[2,3]
    - Nested structures
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 27. Implement Missing Subgoal Tracking Markers
  - [x] 27.1 Add "Solving subgoal" markers to CALL steps
    - Display "◀── Solving subgoal [1.1]" when CALL solves a subgoal
    - Track which subgoal each CALL is solving
    - Reference parent step that spawned the subgoal
    - _Requirements: 7.4, 7.10, 18.2_
  
  - [x] 27.2 Add "Completed subgoal" markers to EXIT steps
    - Display "◀── Completed subgoal [1.1]" when EXIT completes a subgoal
    - Show which subgoal was completed
    - _Requirements: 7.4, 7.11, 18.3_
  
  - [x] 27.3 Add "Next subgoal" indicators to EXIT steps
    - Display "Next: Subgoal [1.2]" after completing a subgoal
    - Show what comes next in the execution
    - Only show if there is a next subgoal
    - _Requirements: 7.12, 18.4_

- [ ] 28. Implement Variable Flow Tracking (Properly This Time)
  - [ ] 28.1 Track variable bindings across steps
    - Maintain map of variable → value for each step
    - Track when variables get bound in EXIT steps
    - Propagate bindings to subsequent subgoals
    - _Requirements: 10.1, 10.4_
  
  - [ ] 28.2 Add variable flow notes to EXIT steps
    - Show "Note: X1 from Step 1 is now bound to 1+0"
    - Indicate which variable was bound and to what value
    - Reference the step where the variable originated
    - _Requirements: 10.5, 10.7_
  
  - [ ] 28.3 Show variable substitutions in CALL steps
    - Display "Note: X1 from Step 1 was substituted → 1+0"
    - Show how bound variables affect subsequent subgoal calls
    - Use source variable names consistently
    - _Requirements: 10.2, 10.3, 10.6_

- [ ] 29. Fix Tree Visualization Issues
  - [ ] 29.1 Add clause numbers to tree nodes
    - Extract clause line numbers from trace
    - Display "clause 28" in node label
    - Use dot notation for multiple clauses (26.1, 26.2)
    - _Requirements: 4.2, 6.2, 6.3_
  
  - [ ] 29.2 Improve edge labels with actual subgoal content
    - Show "|t(X+1,X1)|" not "|subgoal 1|"
    - Extract subgoal text from source clause body
    - Keep labels concise but meaningful
    - _Requirements: 4.3, 7.1, 20.2_
  
  - [ ] 29.3 Fix clause head display in tree nodes
    - Use source clause head with original variables
    - Show "t(X+1+1,Z)" not "t(_578+1+1,_568)"
    - _Requirements: 4.2, 6.1_

- [ ] 30. Fix Line Number Mapping
  - [ ] 30.1 Correct clause line number extraction
    - Verify tracer provides correct line numbers
    - Map to actual source file lines
    - Handle multi-clause lines correctly
    - _Requirements: 6.2, 6.3_
  
  - [ ] 30.2 Update clause table generation
    - Show correct line numbers in clause definitions table
    - Match line numbers shown in timeline
    - _Requirements: 13.3, 13.4_

- [ ] 31. Testing and Validation
  - [ ] 31.1 Test with 3_3_operators example
    - Verify source variable names displayed (X, Z not _578, _568)
    - Check pattern match shows X=0 not _578+1+1=0+1+1
    - Validate subgoal markers present
    - Confirm variable flow notes present
    - _Requirements: All Phase 3_
  
  - [ ] 31.2 Test with factorial example
    - Verify all Phase 3 features working
    - Check deep recursion handling
    - Validate variable flow across multiple levels
    - _Requirements: All Phase 3_
  
  - [ ] 31.3 Test with append example
    - Verify list pattern matching works
    - Check subgoal tracking with recursion
    - _Requirements: All Phase 3_
  
  - [ ] 31.4 Regenerate all examples
    - Run regenerate_examples.sh
    - Verify all outputs match design examples
    - _Requirements: All Phase 3_
