/**
 * Variable Binding Tracker
 * 
 * Tracks variable bindings through recursive Prolog execution by processing
 * trace events in order and maintaining accumulated state.
 */

import { TraceEvent } from './timeline.js';

interface LevelBinding {
  level: number;
  resultVar: string;           // The variable name (e.g., "_79984")
  resultPattern: string;        // Current pattern (e.g., "[1|_79854]", "[1,2,3,4]")
  isResolved: boolean;          // Whether we've seen the EXIT
}

export class VariableBindingTracker {
  private bindings: Map<number, LevelBinding> = new Map();
  private topLevelQuery: string;
  
  constructor(originalQuery: string) {
    this.topLevelQuery = originalQuery;
  }
  
  /**
   * Process a trace event and update bindings
   */
  processEvent(event: TraceEvent): void {
    if (event.port === 'call') {
      this.processCall(event);
    } else if (event.port === 'exit') {
      this.processExit(event);
    }
  }
  
  /**
   * Process CALL event - extract variable relationships from parent_info
   * 
   * Key insight: parent_info.goal shows how the PARENT sees its own result variable
   * at the moment it's calling this child.
   */
  private processCall(event: TraceEvent): void {
    // Extract the result variable from this call's goal
    const resultVar = this.extractResultVariable(event.goal);
    if (!resultVar) return;
    
    // Initialize binding for this level
    this.bindings.set(event.level, {
      level: event.level,
      resultVar,
      resultPattern: resultVar, // Initially just the variable name
      isResolved: false,
    });
    
    // If there's parent_info, it tells us how the parent sees ITS OWN result
    if (event.parent_info && event.parent_info.goal) {
      const parentGoal = event.parent_info.goal;
      
      // Skip meta-calls and test predicates
      if (parentGoal.includes('<meta-call>') || parentGoal.includes('test_')) {
        return;
      }
      
      // Extract what the parent's result looks like from parent's perspective
      const parentResultPattern = this.extractResultVariable(parentGoal);
      if (!parentResultPattern) return;
      
      const parentLevel = event.parent_info.level;
      const parentBinding = this.bindings.get(parentLevel);
      
      if (parentBinding) {
        // Save the parent's OLD result variable before updating
        const parentOldResultVar = parentBinding.resultVar;
        
        // Update parent's pattern - this is how parent sees its result NOW
        parentBinding.resultPattern = parentResultPattern;
        
        // Propagate: substitute the parent's OLD result variable with its NEW pattern in all ancestors
        // e.g., if parent was "_79854" and now has pattern "[2|_79774]",
        // then ancestors with "[1|_79854]" should become "[1|[2|_79774]]"
        if (parentOldResultVar !== parentResultPattern) {
          this.propagateBinding(parentLevel, parentOldResultVar, parentResultPattern);
        }
      }
    }
  }
  
  /**
   * Process EXIT event - we now know the final value
   */
  private processExit(event: TraceEvent): void {
    const binding = this.bindings.get(event.level);
    if (!binding) return;
    
    // Extract the resolved value from EXIT goal
    const resolvedValue = this.extractResultVariable(event.goal);
    if (!resolvedValue) return;
    
    // Mark as resolved and update pattern
    binding.isResolved = true;
    binding.resultPattern = resolvedValue;
    
    // Propagate this binding up to all parents that reference this variable
    this.propagateBinding(event.level, binding.resultVar, resolvedValue);
  }
  
  /**
   * Propagate a binding up through parent levels
   */
  private propagateBinding(fromLevel: number, varName: string, value: string): void {
    // Find all levels that reference this variable and substitute
    for (const [level, binding] of this.bindings.entries()) {
      if (level < fromLevel && binding.resultPattern.includes(varName)) {
        binding.resultPattern = this.substitute(
          binding.resultPattern,
          varName,
          value
        );
      }
    }
  }
  
  /**
   * Get the accumulated query variable state for a given level
   * This shows what the top-level query variable looks like at this point
   */
  getQueryVarState(level: number): string | null {
    // Find the top-level binding (lowest level number)
    let topLevel = Infinity;
    for (const lvl of this.bindings.keys()) {
      if (lvl < topLevel) {
        topLevel = lvl;
      }
    }
    
    if (topLevel === Infinity) return null;
    
    const topBinding = this.bindings.get(topLevel);
    if (!topBinding) return null;
    
    // Clean up the pattern to show holes
    const cleaned = this.cleanupPattern(topBinding.resultPattern);
    
    // Always show the state (whether partial or complete)
    return `X = ${cleaned}`;
  }
  
  /**
   * Extract the result variable/pattern from a goal
   * For "append([1,2],[3,4],_79984)", returns "_79984"
   * For "append([1,2],[3,4],[1|_79854])", returns "[1|_79854]"
   */
  private extractResultVariable(goal: string): string | null {
    const match = goal.match(/^([^(]+)\((.*)\)$/);
    if (!match) return null;
    
    const args = this.splitArguments(match[2]);
    // Return the last argument (typically the result in Prolog predicates)
    return args[args.length - 1]?.trim() || null;
  }
  
  /**
   * Substitute a variable with a value in a pattern
   * e.g., substitute("[1|_79854]", "_79854", "[2|_79774]") -> "[1|[2|_79774]]"
   */
  private substitute(pattern: string, varName: string, value: string): string {
    // Simple string replacement for now
    // TODO: Handle nested structures more carefully
    return pattern.replace(new RegExp(`\\b${this.escapeRegex(varName)}\\b`, 'g'), value);
  }
  
  /**
   * Clean up a pattern to show holes
   * Replace unbound variables with ? and simplify nested lists
   */
  private cleanupPattern(pattern: string): string {
    // Replace internal variables (_NNNN) with ?
    let cleaned = pattern.replace(/_\d+/g, '?');
    // Replace remaining unbound variables (uppercase identifiers)
    cleaned = cleaned.replace(/\b[A-Z][A-Za-z0-9_]*\b/g, '?');
    
    // Simplify nested list structures: [1|[2|[3,4]]] -> [1,2,3,4]
    // Keep doing this until no more simplifications possible
    let prev = '';
    while (prev !== cleaned) {
      prev = cleaned;
      // Pattern: [X|[Y,...]] -> [X,Y,...]
      cleaned = cleaned.replace(/\[([^\[\]|]+)\|\[([^\[\]]+)\]\]/g, '[$1,$2]');
    }
    
    return cleaned;
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
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
