/**
 * Timeline Formatter - Formats nested timeline steps into markdown
 * 
 * Renders a hierarchical view where child calls are visually nested inside their parents.
 */

import { TimelineStep } from './timeline.js';

/**
 * Format timeline steps into markdown with nested structure
 */
export function formatTimeline(steps: TimelineStep[]): string {
  const lines: string[] = [];
  
  for (const step of steps) {
    lines.push(...formatStepNested(step, 0));
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format a single timeline step with nesting support
 * @param step The step to format
 * @param depth Current nesting depth (0 = root level)
 */
function formatStepNested(step: TimelineStep, depth: number): string[] {
  const lines: string[] = [];
  const indent = '│  '.repeat(depth);
  
  // Step header with box drawing
  const portLabel = step.port === 'merged' ? '' : step.port.toUpperCase() + ' ';
  // subgoalLabel is like "[1.1]", strip brackets for cleaner display
  const subgoalMarker = step.subgoalLabel ? ` [Goal ${step.subgoalLabel.slice(1, -1)}]` : '';
  
  // Build goal display: show template → instantiated if we have binding context
  let goalDisplay = `${portLabel}${step.goal}`;
  if (step.subgoalTemplate && step.subgoalBindings && step.subgoalBindings.length > 0) {
    goalDisplay = `${portLabel}${step.subgoalTemplate} → ${step.goal}`;
  }
  
  lines.push(`${indent}┌─ Step ${step.stepNumber}${subgoalMarker}: ${goalDisplay}`);
  
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
      lines.push(...formatMergedContent(step, indent));
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
      lines.push(...formatStepNested(child, depth + 1));
    }
  }
  
  // Show result AFTER children (this is the key insight!)
  if (step.port === 'merged' && step.result) {
    // Extract the output variable from the goal (last argument, typically unbound)
    const goalMatch = step.goal.match(/^[^(]+\((.+)\)$/);
    let outputVar = '?';
    if (goalMatch) {
      const args = splitArgs(goalMatch[1]);
      outputVar = args[args.length - 1] || '?';
    }
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
function formatMergedContent(step: TimelineStep, indent: string): string[] {
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
