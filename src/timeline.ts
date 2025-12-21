/**
 * Timeline Builder - Constructs a flat, sequential timeline from trace events
 */

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

  constructor(private events: TraceEvent[]) {}

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
    for (const event of this.events) {
      // Filter out tracer infrastructure
      if (!this.isTracerPredicate(event.predicate)) {
        this.processEvent(event);
      }
    }
    return this.steps;
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
    
    // Extract subgoals from clause body if available
    const subgoals: Array<{ label: string; goal: string }> = [];
    if (event.clause && event.clause.body) {
      const subgoalGoals = this.extractSubgoals(event.clause.body);
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
        
        // Map the FIRST subgoal to the next level
        this.subgoalMap.set(event.level + 1, {
          parentStep: stepNumber,
          subgoalIndex: 1,
        });
      }
    }
    
    // Determine if this call is solving a subgoal
    let subgoalLabel: string | undefined;
    const subgoalInfo = this.subgoalMap.get(event.level);
    if (subgoalInfo) {
      subgoalLabel = `[${subgoalInfo.parentStep}.${subgoalInfo.subgoalIndex}]`;
    }
    
    const step: TimelineStep = {
      stepNumber,
      port: 'call',
      level: event.level,
      goal: event.goal,
      clause: event.clause,
      unifications: [],
      subgoals,
      subgoalLabel,
    };
    
    this.steps.push(step);
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
    
    // Determine if this completes a subgoal
    let subgoalLabel: string | undefined;
    let nextSubgoal: string | undefined;
    const subgoalInfo = this.subgoalMap.get(event.level);
    if (subgoalInfo) {
      subgoalLabel = `[${subgoalInfo.parentStep}.${subgoalInfo.subgoalIndex}]`;
      
      // Mark this subgoal as completed
      const parentStep = subgoalInfo.parentStep;
      const currentCompleted = this.completedSubgoals.get(parentStep) || 0;
      this.completedSubgoals.set(parentStep, currentCompleted + 1);
      
      // Check if there's a next subgoal
      const parentSubgoals = this.parentSubgoals.get(parentStep);
      if (parentSubgoals && subgoalInfo.subgoalIndex < parentSubgoals.length) {
        // There's a next subgoal - update the mapping
        const nextSubgoalIndex = subgoalInfo.subgoalIndex + 1;
        const nextSubgoalData = parentSubgoals[nextSubgoalIndex - 1];
        nextSubgoal = `Subgoal ${nextSubgoalData.label}`;
        
        // Update the subgoal map for the next subgoal at the same level
        this.subgoalMap.set(event.level, {
          parentStep,
          subgoalIndex: nextSubgoalIndex,
        });
      } else {
        // All subgoals completed - clear the mapping
        this.subgoalMap.delete(event.level);
      }
    }
    
    const step: TimelineStep = {
      stepNumber,
      port: 'exit',
      level: event.level,
      goal: event.goal,
      clause: event.clause,
      unifications,
      subgoals: [],
      returnsTo: callStep,
      subgoalLabel,
      nextSubgoal,
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
