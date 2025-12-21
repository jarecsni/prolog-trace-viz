/**
 * Tree Builder - Constructs hierarchical call tree from trace events
 */

import { TraceEvent } from './timeline.js';

export interface TreeNode {
  id: string;                   // e.g., "A", "B", "C", ..., "Z", "AA", "AB"
  goal: string;
  clauseNumber?: string;        // e.g., "26", "26.1", "26.2"
  callStep: number;
  exitStep?: number;
  status: 'success' | 'failure' | 'pending';
  children: TreeNode[];
  finalBinding?: string;
}

/**
 * Tree Builder class - constructs call tree from trace events
 */
export class TreeBuilder {
  private nodes: TreeNode[] = [];
  private nodeCounter = 0;
  private callStack: Map<number, TreeNode> = new Map(); // level -> node
  private stepToNode: Map<number, TreeNode> = new Map(); // step number -> node
  private stepCounter = 0;

  constructor(private events: TraceEvent[]) {}

  /**
   * Build the complete tree from trace events
   */
  build(): TreeNode | null {
    let root: TreeNode | null = null;

    for (const event of this.events) {
      this.stepCounter++;
      
      switch (event.port) {
        case 'call':
          const node = this.processCall(event, this.stepCounter);
          if (!root) {
            root = node;
          }
          break;
        case 'exit':
          this.processExit(event, this.stepCounter);
          break;
        case 'redo':
          // REDO doesn't create new nodes, just marks retry
          break;
        case 'fail':
          this.processFail(event, this.stepCounter);
          break;
      }
    }

    return root;
  }

  /**
   * Generate node ID (A-Z, AA-AZ, BA-BZ, ...)
   */
  private generateNodeId(): string {
    const index = this.nodeCounter++;
    
    if (index < 26) {
      return String.fromCharCode(65 + index); // A-Z
    }
    
    // After Z: AA, AB, AC, ..., AZ, BA, BB, ...
    const firstChar = String.fromCharCode(65 + Math.floor(index / 26) - 1);
    const secondChar = String.fromCharCode(65 + (index % 26));
    return firstChar + secondChar;
  }

  /**
   * Process CALL event - create new node
   */
  private processCall(event: TraceEvent, stepNumber: number): TreeNode {
    const node: TreeNode = {
      id: this.generateNodeId(),
      goal: event.goal,
      clauseNumber: event.clause?.line.toString(),
      callStep: stepNumber,
      status: 'pending',
      children: [],
    };

    // Add as child to parent if there is one
    const parentLevel = event.level - 1;
    const parent = this.callStack.get(parentLevel);
    if (parent) {
      parent.children.push(node);
    }

    // Track in call stack
    this.callStack.set(event.level, node);
    this.stepToNode.set(stepNumber, node);
    this.nodes.push(node);

    return node;
  }

  /**
   * Process EXIT event - mark node as successful
   */
  private processExit(event: TraceEvent, stepNumber: number): void {
    const node = this.callStack.get(event.level);
    if (node) {
      node.exitStep = stepNumber;
      node.status = 'success';
      
      // Extract final binding if available
      // Compare CALL goal with EXIT goal to find bindings
      const callGoal = node.goal;
      const exitGoal = event.goal;
      if (callGoal !== exitGoal) {
        node.finalBinding = this.extractBinding(callGoal, exitGoal);
      }
      
      // Remove from call stack
      this.callStack.delete(event.level);
    }
  }

  /**
   * Process FAIL event - mark node as failed
   */
  private processFail(event: TraceEvent, stepNumber: number): void {
    const node = this.callStack.get(event.level);
    if (node) {
      node.exitStep = stepNumber;
      node.status = 'failure';
      
      // Remove from call stack
      this.callStack.delete(event.level);
    }
  }

  /**
   * Extract binding by comparing CALL and EXIT goals
   */
  private extractBinding(callGoal: string, exitGoal: string): string | undefined {
    // Simple extraction - find the first variable that changed
    const callMatch = callGoal.match(/^([^(]+)\((.*)\)$/);
    const exitMatch = exitGoal.match(/^([^(]+)\((.*)\)$/);
    
    if (!callMatch || !exitMatch) {
      return undefined;
    }
    
    const callArgs = this.splitArguments(callMatch[2]);
    const exitArgs = this.splitArguments(exitMatch[2]);
    
    // Find first differing argument where call has variable
    for (let i = 0; i < Math.min(callArgs.length, exitArgs.length); i++) {
      const callArg = callArgs[i].trim();
      const exitArg = exitArgs[i].trim();
      
      if (callArg !== exitArg && /^[A-Z_]/.test(callArg)) {
        return `${callArg}=${exitArg}`;
      }
    }
    
    return undefined;
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
}
