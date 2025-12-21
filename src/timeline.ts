/**
 * Timeline Builder - Constructs a flat, sequential timeline from trace events
 */

import { SourceClauseMap } from './clauses.js';

export interface TimelineStep {
  stepNumber: number;
  port: 'call' | 'exit' | 'redo' | 'fail';
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

  constructor(private events: TraceEvent[], private sourceClauseMap?: SourceClauseMap) {}

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
    
    // Third pass: update subgoal tracking based on execution flow
    this.updateSubgoalTracking();
    
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
   * Update subgoal tracking markers based on execution flow
   * This must run after backfillClauseInfo so we have all subgoals defined
   */
  private updateSubgoalTracking(): void {
    // Track which subgoal is currently active at each level
    const activeSubgoalMap = new Map<number, { parentStep: number; subgoalIndex: number }>();
    
    for (const step of this.steps) {
      if (step.port === 'call') {
        // Check if this CALL is solving a subgoal
        const subgoalInfo = activeSubgoalMap.get(step.level);
        if (subgoalInfo) {
          step.subgoalLabel = `[${subgoalInfo.parentStep}.${subgoalInfo.subgoalIndex}]`;
        }
        
        // If this CALL has subgoals, set up tracking for the first one
        if (step.subgoals.length > 0) {
          activeSubgoalMap.set(step.level + 1, {
            parentStep: step.stepNumber,
            subgoalIndex: 1,
          });
        }
      } else if (step.port === 'exit') {
        // Check if this EXIT completes a subgoal
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
