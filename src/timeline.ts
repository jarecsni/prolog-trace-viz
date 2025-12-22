/**
 * Timeline Builder - Constructs a flat, sequential timeline from trace events
 */

import { SourceClauseMap } from './clauses.js';
import { VariableBindingTracker } from './variable-tracker.js';

export interface TimelineStep {
  stepNumber: number;
  port: 'call' | 'exit' | 'redo' | 'fail' | 'merged';  // Add 'merged' type
  level: number;
  goal: string;
  clause?: {
    head: string;
    body: string;
    line: number;
  };
  unifications: Array<{
    variable: string;
    value: string;
  }>;
  subgoals: Array<{
    label: string;          // e.g., "[1.1]", "[1.2]"
    goal: string;
  }>;
  subgoalLabel?: string;    // e.g., "[1.1]" - which subgoal this step is solving
  returnsTo?: number;       // For EXIT: which CALL step
  note?: string;            // Additional context
  nextSubgoal?: string;     // e.g., "Subgoal [1.2]" - what comes next
  variableFlowNotes?: string[];  // Variable flow tracking notes
  result?: string;          // For merged steps: the result value
  queryVarState?: string;   // State of the query variable at this step (e.g., "[1|?]", "[1,2,3,4]")
  parentContext?: string;   // How parent sees this step's variables (e.g., "X = [1|R]")
}

export interface TraceEvent {
  port: 'call' | 'exit' | 'redo' | 'fail';
  level: number;
  goal: string;
  predicate: string;
  arguments?: any[];
  clause?: {
    head: string;
    body: string;
    line: number;
  };
  parent_info?: {
    level: number;
    goal: string;
  };
}

/**
 * Timeline Builder class - processes trace events into timeline steps
 */
export class TimelineBuilder {
  private steps: TimelineStep[] = [];
  private stepCounter = 0;
  private callStack: Map<number, number> = new Map(); // level -> step number
  private subgoalMap: Map<number, { parentStep: number; subgoalIndex: number }> = new Map(); // level -> subgoal info
  private parentSubgoals: Map<number, Array<{ label: string; goal: string }>> = new Map(); // step number -> subgoals
  private completedSubgoals: Map<number, number> = new Map(); // parent step -> count of completed subgoals

  constructor(private events: TraceEvent[], private sourceClauseMap?: SourceClauseMap, private originalQuery?: string) {}

  /**
   * Check if a predicate is part of tracer infrastructure and should be filtered
   */
  private isTracerPredicate(predicate: string): boolean {
    const tracerPredicates = [
      'catch/3',
      'export_trace_json/1',
      'run_trace/0',
      'install_tracer/1',
      'remove_tracer/0',
    ];
    return tracerPredicates.includes(predicate);
  }

  /**
   * Build the complete timeline from trace events
   */
  build(): TimelineStep[] {
    // First pass: process all events
    for (const event of this.events) {
      // Filter out tracer infrastructure
      if (!this.isTracerPredicate(event.predicate)) {
        this.processEvent(event);
      }
    }
    
    // Second pass: backfill clause info from EXIT to CALL steps
    this.backfillClauseInfo();
    
    // Third pass: merge CALL/EXIT pairs into single steps (with incremental binding tracking)
    this.mergeCallExitPairs();
    
    // Fourth pass: update subgoal tracking based on execution flow
    this.updateSubgoalTracking();
    
    // Fifth pass: add variable flow tracking notes
    this.addVariableFlowNotes();
    
    return this.steps;
  }
  
  /**
   * Backfill clause information from EXIT events to their corresponding CALL events
   */
  private backfillClauseInfo(): void {
    // For each CALL step without clause info, find its matching EXIT
    for (let i = 0; i < this.steps.length; i++) {
      const callStep = this.steps[i];
      
      if (callStep.port === 'call' && !callStep.clause) {
        // Find the matching EXIT for this CALL
        // It should be at the same level and have the same predicate
        const exitStep = this.findMatchingExit(callStep, i);
        
        if (exitStep && exitStep.clause) {
          // Use source clause if available, otherwise use runtime clause
          const sourceClause = this.getSourceClause(exitStep.clause.line);
          if (sourceClause) {
            callStep.clause = {
              head: sourceClause.head,
              body: sourceClause.body || 'true',
              line: sourceClause.number,
            };
          } else {
            callStep.clause = exitStep.clause;
          }
          
          // Extract pattern match bindings using source clause head
          const patternBindings = this.extractPatternMatchBindings(callStep.goal, callStep.clause.head);
          callStep.unifications = patternBindings;
          
          // Re-extract subgoals now that we have clause info
          if (callStep.clause.body && callStep.clause.body !== 'true') {
            const subgoalGoals = this.extractSubgoals(callStep.clause.body);
            callStep.subgoals = subgoalGoals.map((goal, index) => ({
              label: `[${callStep.stepNumber}.${index + 1}]`,
              goal,
            }));
            
            // Update parent subgoals map
            if (callStep.subgoals.length > 0) {
              this.parentSubgoals.set(callStep.stepNumber, callStep.subgoals);
              this.completedSubgoals.set(callStep.stepNumber, 0);
            }
          }
        }
      }
    }
  }
  
  /**
   * Merge CALL/EXIT pairs into single steps
   * This creates a cleaner timeline focused on goal execution rather than trace mechanics
   */
  private mergeCallExitPairs(): void {
    const mergedSteps: TimelineStep[] = [];
    const processedExits = new Set<number>();
    
    // Initialize binding tracker if we have original query
    let bindingTracker: VariableBindingTracker | undefined;
    if (this.originalQuery) {
      bindingTracker = new VariableBindingTracker(this.originalQuery);
    }
    
    // Build a map of CALL events to their trace events for parent_info access
    const callEventMap = new Map<number, TraceEvent>();
    for (const event of this.events) {
      if (event.port === 'call') {
        // Find the step number for this event
        const step = this.steps.find(s => s.port === 'call' && s.goal === event.goal && s.level === event.level);
        if (step) {
          callEventMap.set(step.stepNumber, event);
        }
      }
    }
    
    // Process events in order, tracking bindings as we go
    for (const step of this.steps) {
      if (step.port === 'call') {
        // Process this CALL event in the binding tracker
        const callEvent = callEventMap.get(step.stepNumber);
        if (callEvent && bindingTracker && !this.isTracerPredicate(callEvent.predicate)) {
          bindingTracker.processEvent(callEvent);
        }
        
        // Find the matching EXIT
        const exitStep = this.steps.find(s => 
          s.port === 'exit' && s.returnsTo === step.stepNumber
        );
        
        if (exitStep) {
          // Merge CALL and EXIT into a single step
          const mergedStep: TimelineStep = {
            ...step,
            port: 'merged',
            result: this.extractResult(exitStep.goal),
          };
          
          // Get query variable state at CALL time (before EXIT)
          if (bindingTracker) {
            const queryVarState = bindingTracker.getQueryVarState(step.level);
            if (queryVarState) {
              mergedStep.queryVarState = queryVarState;
            }
          }
          
          // Fallback to old method if binding tracker didn't produce result
          if (!mergedStep.queryVarState && callEvent && this.originalQuery) {
            const env = this.extractVariableEnvironment(callEvent, this.originalQuery);
            if (env.queryVarState) {
              mergedStep.queryVarState = env.queryVarState;
            }
            if (env.parentContext) {
              mergedStep.parentContext = env.parentContext;
            }
          }
          
          // Now process the EXIT event in the binding tracker
          const exitEvent = this.events.find(e => 
            e.port === 'exit' && e.level === exitStep.level && e.goal === exitStep.goal
          );
          if (exitEvent && bindingTracker && !this.isTracerPredicate(exitEvent.predicate)) {
            bindingTracker.processEvent(exitEvent);
          }
          
          mergedSteps.push(mergedStep);
          processedExits.add(exitStep.stepNumber);
        } else {
          // CALL without EXIT (failed goal) - keep as is
          mergedSteps.push(step);
        }
      } else if (step.port === 'exit' && !processedExits.has(step.stepNumber)) {
        // EXIT without CALL (shouldn't happen, but keep for safety)
        mergedSteps.push(step);
      } else if (step.port === 'redo' || step.port === 'fail') {
        // Keep REDO/FAIL steps as is
        mergedSteps.push(step);
      }
    }
    
    this.steps = mergedSteps;
  }
  
  /**
   * Extract complete variable environment from parent_info
   * Shows the immediate parent's view of this call
   */
  private extractVariableEnvironment(event: TraceEvent, originalQuery: string): {
    queryVarState?: string;
    parentContext?: string;
  } {
    if (!event.parent_info || !event.parent_info.goal) {
      return {};
    }
    
    const parentGoal = event.parent_info.goal;
    
    // Skip meta-call wrappers and test predicates
    if (parentGoal.includes('<meta-call>') || parentGoal === 'test_append') {
      return {};
    }
    
    // Extract predicate name from both goals
    const parentPredMatch = parentGoal.match(/^([^(]+)\(/);
    const queryPredMatch = originalQuery.match(/^([^(]+)\(/);
    
    if (!parentPredMatch || !queryPredMatch) {
      return {};
    }
    
    // Only process if parent is same predicate (recursive call)
    if (parentPredMatch[1] !== queryPredMatch[1]) {
      return {};
    }
    
    // Extract result from immediate parent
    const result = this.extractResultFromGoal(parentGoal);
    
    if (result) {
      const cleaned = this.cleanupVariableName(result);
      
      // Show query variable state if it has holes (partial construction)
      if (cleaned.includes('?')) {
        return {
          queryVarState: `X = ${cleaned}`,
          parentContext: `Parent view: result = ${cleaned}`
        };
      }
    }
    
    return {};
  }

  
  /**
   * Extract the result argument from a goal
   * For append([1,2],[3,4],[1|_79854]), extract [1|_79854]
   */
  private extractResultFromGoal(goal: string): string | null {
    const match = goal.match(/^([^(]+)\((.*)\)$/);
    if (!match) {
      return null;
    }
    
    const args = this.splitArguments(match[2]);
    // Return the last argument (typically the result in Prolog predicates)
    const lastArg = args[args.length - 1];
    
    // Clean up internal variable names for display
    return lastArg ? this.cleanupVariableName(lastArg) : null;
  }
  
  /**
   * Clean up variable names for better readability
   * Replace internal vars like _79854 and unbound clause vars like R with ? to show holes
   */
  private cleanupVariableName(value: string): string {
    // Replace internal variables (_NNNN) with ? to show "holes"
    let cleaned = value.replace(/_\d+/g, '?');
    // Replace remaining unbound variables (single uppercase letters or uppercase identifiers)
    // that appear as standalone terms (not part of a larger structure)
    cleaned = cleaned.replace(/\b[A-Z][A-Za-z0-9_]*\b/g, '?');
    return cleaned;
  }
  
  /**
   * Extract the result value from an EXIT goal
   * For example, from "append([1,2],[3,4],[1,2,3,4])" extract "[1,2,3,4]"
   */
  private extractResult(exitGoal: string): string {
    const match = exitGoal.match(/^([^(]+)\((.*)\)$/);
    if (!match) {
      return exitGoal;
    }
    
    const args = this.splitArguments(match[2]);
    // Return the last argument as the result (common pattern in Prolog)
    return args[args.length - 1] || exitGoal;
  }
  
  /**
   * Update subgoal tracking markers based on execution flow
   * This must run after backfillClauseInfo so we have all subgoals defined
   */
  private updateSubgoalTracking(): void {
    // Track which subgoal is currently active at each level
    const activeSubgoalMap = new Map<number, { parentStep: number; subgoalIndex: number }>();
    
    for (const step of this.steps) {
      // Handle both 'call' and 'merged' steps (merged steps are essentially completed calls)
      if (step.port === 'call' || step.port === 'merged') {
        // Check if this step is solving a subgoal
        const subgoalInfo = activeSubgoalMap.get(step.level);
        if (subgoalInfo) {
          step.subgoalLabel = `[${subgoalInfo.parentStep}.${subgoalInfo.subgoalIndex}]`;
        }
        
        // If this step has subgoals, set up tracking for the first one
        if (step.subgoals.length > 0) {
          activeSubgoalMap.set(step.level + 1, {
            parentStep: step.stepNumber,
            subgoalIndex: 1,
          });
        }
        
        // For merged steps, also handle completion logic
        if (step.port === 'merged' && subgoalInfo) {
          // Check if there's a next subgoal
          const parentSubgoals = this.parentSubgoals.get(subgoalInfo.parentStep);
          if (parentSubgoals && subgoalInfo.subgoalIndex < parentSubgoals.length) {
            // Move to next subgoal
            const nextSubgoalIndex = subgoalInfo.subgoalIndex + 1;
            const nextSubgoalData = parentSubgoals[nextSubgoalIndex - 1];
            step.nextSubgoal = `Subgoal ${nextSubgoalData.label}`;
            
            // Update active subgoal for this level
            activeSubgoalMap.set(step.level, {
              parentStep: subgoalInfo.parentStep,
              subgoalIndex: nextSubgoalIndex,
            });
          } else {
            // All subgoals completed
            activeSubgoalMap.delete(step.level);
          }
        }
      } else if (step.port === 'exit') {
        // Handle legacy EXIT steps (shouldn't exist after merging, but keep for safety)
        const subgoalInfo = activeSubgoalMap.get(step.level);
        if (subgoalInfo) {
          step.subgoalLabel = `[${subgoalInfo.parentStep}.${subgoalInfo.subgoalIndex}]`;
          
          // Check if there's a next subgoal
          const parentSubgoals = this.parentSubgoals.get(subgoalInfo.parentStep);
          if (parentSubgoals && subgoalInfo.subgoalIndex < parentSubgoals.length) {
            // Move to next subgoal
            const nextSubgoalIndex = subgoalInfo.subgoalIndex + 1;
            const nextSubgoalData = parentSubgoals[nextSubgoalIndex - 1];
            step.nextSubgoal = `Subgoal ${nextSubgoalData.label}`;
            
            // Update active subgoal for this level
            activeSubgoalMap.set(step.level, {
              parentStep: subgoalInfo.parentStep,
              subgoalIndex: nextSubgoalIndex,
            });
          } else {
            // All subgoals completed
            activeSubgoalMap.delete(step.level);
          }
        }
      }
    }
  }
  
  /**
   * Add variable flow tracking notes to steps
   * This shows how variables from parent clauses flow into child goals
   */
  private addVariableFlowNotes(): void {
    // Track variable bindings: step number -> variable name -> value
    const bindingMap = new Map<number, Map<string, string>>();
    
    for (const step of this.steps) {
      // Record bindings from this step
      if (step.unifications.length > 0) {
        const stepBindings = new Map<string, string>();
        for (const unif of step.unifications) {
          stepBindings.set(unif.variable, unif.value);
        }
        bindingMap.set(step.stepNumber, stepBindings);
      }
      
      // For EXIT steps, add notes about which variables got bound
      if (step.port === 'exit' && step.returnsTo) {
        const callStep = this.steps.find(s => s.stepNumber === step.returnsTo);
        if (callStep && callStep.unifications.length > 0) {
          const notes: string[] = [];
          
          for (const unif of callStep.unifications) {
            // Check if this variable was unbound at CALL and is now bound at EXIT
            if (unif.value.startsWith('_') && !step.goal.includes(unif.value)) {
              // Variable was unbound, now it's bound - extract the new value from EXIT goal
              const exitValue = this.extractVariableValueFromGoal(step.goal, unif.variable, callStep.clause?.head);
              if (exitValue && exitValue !== unif.value) {
                notes.push(`${unif.variable} from Step ${callStep.stepNumber} is now bound to ${exitValue}`);
              }
            }
          }
          
          if (notes.length > 0) {
            step.variableFlowNotes = notes;
          }
        }
      }
    }
  }
  
  /**
   * Extract the value of a variable from a goal based on its position in the clause head
   */
  private extractVariableValueFromGoal(goal: string, variable: string, clauseHead?: string): string | null {
    if (!clauseHead) {
      return null;
    }
    
    // Find the position of the variable in the clause head
    const headMatch = clauseHead.match(/^([^(]+)\((.*)\)$/);
    const goalMatch = goal.match(/^([^(]+)\((.*)\)$/);
    
    if (!headMatch || !goalMatch) {
      return null;
    }
    
    const headArgs = this.splitArguments(headMatch[2]);
    const goalArgs = this.splitArguments(goalMatch[2]);
    
    // Find which argument position contains the variable
    for (let i = 0; i < headArgs.length; i++) {
      if (headArgs[i].trim() === variable) {
        return goalArgs[i]?.trim() || null;
      }
    }
    
    return null;
  }
  
  /**
   * Get source clause from the source clause map
   */
  private getSourceClause(lineNumber: number): { head: string; body?: string; number: number } | null {
    if (!this.sourceClauseMap) {
      return null;
    }
    
    const clause = this.sourceClauseMap[lineNumber];
    if (!clause) {
      return null;
    }
    
    return {
      head: clause.head,
      body: clause.body,
      number: clause.number,
    };
  }
  
  /**
   * Find the matching EXIT step for a CALL step
   */
  private findMatchingExit(callStep: TimelineStep, startIndex: number): TimelineStep | null {
    // Look forward from the CALL to find the matching EXIT
    // The EXIT should be at the same level and return to this CALL
    for (let i = startIndex + 1; i < this.steps.length; i++) {
      const step = this.steps[i];
      
      if (step.port === 'exit' && 
          step.level === callStep.level && 
          step.returnsTo === callStep.stepNumber) {
        return step;
      }
    }
    
    return null;
  }

  /**
   * Process a single trace event
   */
  private processEvent(event: TraceEvent): void {
    switch (event.port) {
      case 'call':
        this.processCall(event);
        break;
      case 'exit':
        this.processExit(event);
        break;
      case 'redo':
        this.processRedo(event);
        break;
      case 'fail':
        this.processFail(event);
        break;
    }
  }

  /**
   * Extract subgoals from a clause body
   */
  private extractSubgoals(clauseBody: string): string[] {
    if (!clauseBody || clauseBody === 'true') {
      return [];
    }
    
    // Split on commas, respecting parentheses depth
    const subgoals: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of clauseBody) {
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        subgoals.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      subgoals.push(current.trim());
    }
    
    return subgoals;
  }

  /**
   * Process CALL event
   */
  private processCall(event: TraceEvent): void {
    this.stepCounter++;
    const stepNumber = this.stepCounter;
    
    // Track this call in the stack
    this.callStack.set(event.level, stepNumber);
    
    // Use source clause if available
    let clauseInfo = event.clause;
    if (clauseInfo && this.sourceClauseMap) {
      const sourceClause = this.getSourceClause(clauseInfo.line);
      if (sourceClause) {
        clauseInfo = {
          head: sourceClause.head,
          body: sourceClause.body || 'true',
          line: sourceClause.number,
        };
      }
    }
    
    // Extract subgoals from clause body if available
    const subgoals: Array<{ label: string; goal: string }> = [];
    if (clauseInfo && clauseInfo.body) {
      const subgoalGoals = this.extractSubgoals(clauseInfo.body);
      subgoalGoals.forEach((goal, index) => {
        subgoals.push({
          label: `[${stepNumber}.${index + 1}]`,
          goal,
        });
      });
      
      // Store subgoals for this step
      if (subgoals.length > 0) {
        this.parentSubgoals.set(stepNumber, subgoals);
        this.completedSubgoals.set(stepNumber, 0);
      }
    }
    
    // Determine if this call is solving a subgoal (will be set during backfill)
    let subgoalLabel: string | undefined;
    
    // Extract pattern match bindings if clause available
    const unifications: Array<{ variable: string; value: string }> = [];
    if (clauseInfo) {
      const patternBindings = this.extractPatternMatchBindings(event.goal, clauseInfo.head);
      unifications.push(...patternBindings);
    }
    
    const step: TimelineStep = {
      stepNumber,
      port: 'call',
      level: event.level,
      goal: event.goal,
      clause: clauseInfo,
      unifications,
      subgoals,
      subgoalLabel,
    };
    
    this.steps.push(step);
  }
  
  /**
   * Extract pattern match bindings by comparing goal with clause head
   * Uses structural decomposition - not heuristics, just comparing known data
   */
  private extractPatternMatchBindings(goal: string, clauseHead: string): Array<{ variable: string; value: string }> {
    const bindings: Array<{ variable: string; value: string }> = [];
    
    // Parse both goal and clause head
    const goalMatch = goal.match(/^([^(]+)\((.*)\)$/);
    const headMatch = clauseHead.match(/^([^(]+)\((.*)\)$/);
    
    if (!goalMatch || !headMatch) {
      return bindings;
    }
    
    const goalArgs = this.splitArguments(goalMatch[2]);
    const headArgs = this.splitArguments(headMatch[2]);
    
    // Match arguments positionally with structural decomposition
    for (let i = 0; i < Math.min(goalArgs.length, headArgs.length); i++) {
      const goalArg = goalArgs[i].trim();
      const headArg = headArgs[i].trim();
      
      // Recursively extract bindings from this argument pair
      this.extractBindingsFromTermPair(headArg, goalArg, bindings);
    }
    
    return bindings;
  }
  
  /**
   * Recursively extract bindings by comparing pattern term with value term
   * This is structural decomposition, not unification - we're just comparing strings
   */
  private extractBindingsFromTermPair(
    pattern: string,
    value: string,
    bindings: Array<{ variable: string; value: string }>
  ): void {
    // If pattern is a simple variable (single uppercase/underscore identifier)
    if (this.isSimpleVariable(pattern)) {
      bindings.push({ variable: pattern, value });
      return;
    }
    
    // If pattern and value are identical, no binding needed
    if (pattern === value) {
      return;
    }
    
    // Try to decompose as compound term with operators
    // e.g., "X+1+1" vs "0+1+1" -> extract X=0
    const patternOp = this.findOperator(pattern);
    const valueOp = this.findOperator(value);
    
    if (patternOp && valueOp && patternOp.op === valueOp.op) {
      // Same operator - recursively match operands
      this.extractBindingsFromTermPair(patternOp.left, valueOp.left, bindings);
      this.extractBindingsFromTermPair(patternOp.right, valueOp.right, bindings);
      return;
    }
    
    // Try to decompose as list
    // e.g., "[H|T]" vs "[1,2,3]" -> extract H=1, T=[2,3]
    if (pattern.startsWith('[') && value.startsWith('[')) {
      const patternList = this.parseListPattern(pattern);
      const valueList = this.parseListPattern(value);
      
      if (patternList && valueList) {
        if (patternList.head && valueList.head) {
          this.extractBindingsFromTermPair(patternList.head, valueList.head, bindings);
        }
        if (patternList.tail && valueList.tail) {
          this.extractBindingsFromTermPair(patternList.tail, valueList.tail, bindings);
        }
        return;
      }
    }
    
    // If we can't decompose further, no binding
  }
  
  /**
   * Check if a term is a simple variable
   */
  private isSimpleVariable(term: string): boolean {
    return /^[A-Z_][A-Za-z0-9_]*$/.test(term);
  }
  
  /**
   * Find the main operator in a term
   * Returns null if no operator found
   */
  private findOperator(term: string): { op: string; left: string; right: string } | null {
    const operators = ['+', '-', '*', '/'];
    
    // Find operator at depth 0 (not inside parentheses)
    let depth = 0;
    for (let i = term.length - 1; i >= 0; i--) {
      const char = term[i];
      
      if (char === ')' || char === ']') {
        depth++;
      } else if (char === '(' || char === '[') {
        depth--;
      } else if (depth === 0 && operators.includes(char)) {
        return {
          op: char,
          left: term.slice(0, i).trim(),
          right: term.slice(i + 1).trim(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Parse a list pattern
   */
  private parseListPattern(list: string): { head: string; tail: string } | null {
    if (!list.startsWith('[') || !list.endsWith(']')) {
      return null;
    }
    
    const content = list.slice(1, -1).trim();
    
    // Check for [H|T] pattern
    const pipeIndex = content.indexOf('|');
    if (pipeIndex !== -1) {
      return {
        head: content.slice(0, pipeIndex).trim(),
        tail: content.slice(pipeIndex + 1).trim(),
      };
    }
    
    // Check for [H, ...] pattern
    const commaIndex = content.indexOf(',');
    if (commaIndex !== -1) {
      return {
        head: content.slice(0, commaIndex).trim(),
        tail: `[${content.slice(commaIndex + 1).trim()}]`,
      };
    }
    
    // Single element or empty list
    if (content) {
      return { head: content, tail: '[]' };
    }
    
    return null;
  }

  /**
   * Extract unifications by comparing CALL and EXIT goals
   */
  private extractUnifications(callGoal: string, exitGoal: string): Array<{ variable: string; value: string }> {
    const unifications: Array<{ variable: string; value: string }> = [];
    
    // Simple structural comparison - extract arguments
    const callMatch = callGoal.match(/^([^(]+)\((.*)\)$/);
    const exitMatch = exitGoal.match(/^([^(]+)\((.*)\)$/);
    
    if (!callMatch || !exitMatch) {
      return unifications;
    }
    
    const callArgs = this.splitArguments(callMatch[2]);
    const exitArgs = this.splitArguments(exitMatch[2]);
    
    // Compare arguments positionally
    for (let i = 0; i < Math.min(callArgs.length, exitArgs.length); i++) {
      const callArg = callArgs[i].trim();
      const exitArg = exitArgs[i].trim();
      
      // If call arg is a variable (starts with _ or uppercase) and exit arg is different
      if (callArg !== exitArg && /^[A-Z_]/.test(callArg)) {
        unifications.push({
          variable: callArg,
          value: exitArg,
        });
      }
    }
    
    return unifications;
  }

  /**
   * Split arguments respecting parentheses and brackets
   */
  private splitArguments(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of argsStr) {
      if (char === '(' || char === '[') {
        depth++;
        current += char;
      } else if (char === ')' || char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      args.push(current.trim());
    }
    
    return args;
  }

  /**
   * Process EXIT event
   */
  private processExit(event: TraceEvent): void {
    this.stepCounter++;
    const stepNumber = this.stepCounter;
    
    // Find the matching CALL step
    const callStep = this.callStack.get(event.level);
    
    // Extract unifications by comparing with CALL goal
    let unifications: Array<{ variable: string; value: string }> = [];
    if (callStep) {
      const callStepData = this.steps.find(s => s.stepNumber === callStep);
      if (callStepData) {
        unifications = this.extractUnifications(callStepData.goal, event.goal);
      }
    }
    
    // Subgoal tracking will be updated in updateSubgoalTracking pass
    const step: TimelineStep = {
      stepNumber,
      port: 'exit',
      level: event.level,
      goal: event.goal,
      clause: event.clause,
      unifications,
      subgoals: [],
      returnsTo: callStep,
    };
    
    // Remove from call stack
    this.callStack.delete(event.level);
    
    this.steps.push(step);
  }

  /**
   * Process REDO event
   */
  private processRedo(event: TraceEvent): void {
    this.stepCounter++;
    const stepNumber = this.stepCounter;
    
    // Find the step being retried
    const retriedStep = this.callStack.get(event.level);
    
    const step: TimelineStep = {
      stepNumber,
      port: 'redo',
      level: event.level,
      goal: event.goal,
      unifications: [],
      subgoals: [],
      note: retriedStep ? `Retrying Step ${retriedStep}` : undefined,
    };
    
    this.steps.push(step);
  }

  /**
   * Process FAIL event
   */
  private processFail(event: TraceEvent): void {
    this.stepCounter++;
    const stepNumber = this.stepCounter;
    
    // Find parent step
    const parentLevel = event.level - 1;
    const parentStep = this.callStack.get(parentLevel);
    
    const step: TimelineStep = {
      stepNumber,
      port: 'fail',
      level: event.level,
      goal: event.goal,
      unifications: [],
      subgoals: [],
      note: parentStep ? `Returns to Step ${parentStep}` : undefined,
    };
    
    // Remove from call stack
    this.callStack.delete(event.level);
    
    this.steps.push(step);
  }
}
