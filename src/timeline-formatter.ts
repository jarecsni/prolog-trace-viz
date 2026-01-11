/**
 * Timeline Formatter - Formats nested timeline steps into markdown
 * 
 * Renders a hierarchical view where child calls are visually nested inside their parents.
 * By default, uses clause variable names (X, Z, X1) instead of internal Prolog names (_2008).
 */

import { TimelineStep } from './timeline.js';

export interface TimelineFormatterOptions {
  showInternalVars?: boolean;
}

/**
 * Format timeline steps into markdown with nested structure
 */
export function formatTimeline(steps: TimelineStep[], options: TimelineFormatterOptions = {}): string {
  const lines: string[] = [];
  
  for (const step of steps) {
    lines.push(...formatStepNested(step, 0, options));
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format a single timeline step with nesting support
 * @param step The step to format
 * @param depth Current nesting depth (0 = root level)
 * @param options Formatter options
 */
function formatStepNested(step: TimelineStep, depth: number, options: TimelineFormatterOptions): string[] {
  const lines: string[] = [];
  const indent = '│  '.repeat(depth);
  const showInternal = options.showInternalVars ?? false;
  
  // Step header with box drawing
  const portLabel = step.port === 'merged' ? '' : step.port.toUpperCase() + ' ';
  // subgoalLabel is like "[1.1]", strip brackets for cleaner display
  const subgoalMarker = step.subgoalLabel ? ` [Goal ${step.subgoalLabel.slice(1, -1)}]` : '';
  
  // Format goal display - use clause variable name for output arg if available
  const goalDisplay = formatGoalDisplay(step, showInternal);
  
  // Build goal display: show template → instantiated if we have binding context
  let fullGoalDisplay = `${portLabel}${goalDisplay}`;
  if (step.subgoalTemplate && step.subgoalBindings && step.subgoalBindings.length > 0) {
    fullGoalDisplay = `${portLabel}${step.subgoalTemplate} → ${goalDisplay}`;
  }
  
  lines.push(`${indent}┌─ Step ${step.stepNumber}${subgoalMarker}: ${fullGoalDisplay}`);
  
  // Show binding context if we have bindings from sibling steps
  if (step.subgoalBindings && step.subgoalBindings.length > 0) {
    for (const binding of step.subgoalBindings) {
      lines.push(`${indent}│  where ${binding.variable} = ${binding.value} (from Step ${binding.fromStep})`);
    }
  }
  
  // Format based on port type
  switch (step.port) {
    case 'call':
    case 'merged':
      lines.push(...formatMergedContent(step, indent, showInternal));
      break;
    case 'redo':
      lines.push(`${indent}│  Backtracking...`);
      break;
    case 'fail':
      lines.push(`${indent}│  Failure`);
      break;
  }
  
  // Render children (nested inside this step)
  if (step.children.length > 0) {
    lines.push(`${indent}│  `);
    for (const child of step.children) {
      lines.push(...formatStepNested(child, depth + 1, options));
    }
  }
  
  // Show result AFTER children (this is the key insight!)
  if (step.port === 'merged' && step.result) {
    // Get the output variable name from clause if available, otherwise extract from goal
    const outputVar = getOutputVariableName(step, showInternal);
    lines.push(`${indent}│  => ${outputVar} = ${step.result}`);
    
    // Show query variable state only on root-level steps (depth 0)
    // This prevents showing "A = ?" on intermediate steps
    if (depth === 0 && step.queryVarState) {
      lines.push(`${indent}│  Query Variable: ${step.queryVarState}`);
    }
  }
  
  lines.push(`${indent}└─`);
  
  return lines;
}

/**
 * Format the goal display, replacing internal variable names with clause variable names
 */
function formatGoalDisplay(step: TimelineStep, showInternal: boolean): string {
  if (showInternal) {
    return step.goal;
  }
  
  // If we have clause info, try to use clause variable name for the output argument
  if (step.clause) {
    const goalMatch = step.goal.match(/^([^(]+)\((.+)\)$/);
    const headMatch = step.clause.head.match(/^([^(]+)\((.+)\)$/);
    
    if (goalMatch && headMatch) {
      const predicate = goalMatch[1];
      const goalArgs = splitArgs(goalMatch[2]);
      const headArgs = splitArgs(headMatch[2]);
      
      // Replace internal variable names with clause variable names where appropriate
      const displayArgs = goalArgs.map((arg, i) => {
        // If this is an internal variable (starts with _) and we have a clause variable
        if (isInternalVariable(arg) && i < headArgs.length) {
          const clauseVar = extractVariableName(headArgs[i]);
          if (clauseVar) {
            return clauseVar;
          }
        }
        return arg;
      });
      
      return `${predicate}(${displayArgs.join(',')})`;
    }
  }
  
  return step.goal;
}

/**
 * Get the output variable name for result display
 */
function getOutputVariableName(step: TimelineStep, showInternal: boolean): string {
  // Extract the last argument from the goal (typically the output)
  const goalMatch = step.goal.match(/^[^(]+\((.+)\)$/);
  if (!goalMatch) return '?';
  
  const args = splitArgs(goalMatch[1]);
  const lastArg = args[args.length - 1] || '?';
  
  if (showInternal) {
    return lastArg;
  }
  
  // If we have clause info, use the clause variable name
  if (step.clause) {
    const headMatch = step.clause.head.match(/^[^(]+\((.+)\)$/);
    if (headMatch) {
      const headArgs = splitArgs(headMatch[1]);
      if (headArgs.length > 0) {
        const clauseVar = extractVariableName(headArgs[headArgs.length - 1]);
        if (clauseVar) {
          return clauseVar;
        }
      }
    }
  }
  
  return lastArg;
}

/**
 * Check if a term is an internal Prolog variable (starts with _)
 */
function isInternalVariable(term: string): boolean {
  return /^_\d+$/.test(term.trim());
}

/**
 * Extract variable name from a term (handles patterns like X, [H|T], X+1, etc.)
 */
function extractVariableName(term: string): string | null {
  const trimmed = term.trim();
  // Simple variable
  if (/^[A-Z][A-Za-z0-9_]*$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Split arguments respecting nested brackets
 */
function splitArgs(argsStr: string): string[] {
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
 * Format merged CALL/EXIT step content (before children)
 */
function formatMergedContent(step: TimelineStep, indent: string, showInternal: boolean): string[] {
  const lines: string[] = [];
  
  if (step.clause) {
    const clauseLabel = step.clause.body && step.clause.body !== 'true' ? 'Clause' : 'Fact';
    lines.push(`${indent}│  ${clauseLabel}: ${step.clause.head} [line ${step.clause.line}]`);
    
    // Show unifications if any
    if (step.unifications.length > 0) {
      lines.push(`${indent}│  Unifications:`);
      for (const unif of step.unifications) {
        lines.push(`${indent}│    ${unif.variable} = ${unif.value}`);
      }
    }
    
    // Show spawned subgoals (these will be solved by children)
    if (step.subgoals.length > 0) {
      lines.push(`${indent}│  Subgoals:`);
      for (const subgoal of step.subgoals) {
        lines.push(`${indent}│    ${subgoal.label} ${subgoal.goal}`);
      }
    }
  }
  
  return lines;
}
