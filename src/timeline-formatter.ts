/**
 * Timeline Formatter - Formats timeline steps into markdown
 */

import { TimelineStep } from './timeline.js';

/**
 * Format timeline steps into markdown
 */
export function formatTimeline(steps: TimelineStep[]): string {
  const lines: string[] = [];
  
  for (const step of steps) {
    lines.push(...formatStep(step));
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format a single timeline step
 */
function formatStep(step: TimelineStep): string[] {
  const lines: string[] = [];
  
  // Step header with box drawing
  lines.push(`┌─ Step ${step.stepNumber}: ${step.port.toUpperCase()} ${step.goal}`);
  
  // Add subgoal marker if this is solving a subgoal
  if (step.subgoalLabel) {
    lines.push(`│  ◀── Solving subgoal ${step.subgoalLabel}`);
  }
  
  // Format based on port type
  switch (step.port) {
    case 'call':
      lines.push(...formatCallStep(step));
      break;
    case 'exit':
      lines.push(...formatExitStep(step));
      break;
    case 'redo':
      lines.push(...formatRedoStep(step));
      break;
    case 'fail':
      lines.push(...formatFailStep(step));
      break;
  }
  
  lines.push('└─');
  
  return lines;
}

/**
 * Format CALL step
 */
function formatCallStep(step: TimelineStep): string[] {
  const lines: string[] = [];
  
  // Show pattern match if clause available
  if (step.clause) {
    lines.push('│  ');
    lines.push('│  Pattern Match:');
    lines.push(`│    Goal: ${step.goal}`);
    lines.push(`│    Head: ${step.clause.head}`);
    
    // Show unifications if any
    if (step.unifications.length > 0) {
      for (const unif of step.unifications) {
        lines.push(`│    ├─ ${unif.variable} = ${unif.value}`);
      }
    }
    
    lines.push('│  ');
    
    // Display clause head and body separately
    if (step.clause.body && step.clause.body !== 'true') {
      // Clause with body
      lines.push(`│  Clause: ${step.clause.head} :- ${step.clause.body} [line ${step.clause.line}]`);
    } else {
      // Fact (no body)
      lines.push(`│  Clause: ${step.clause.head} [line ${step.clause.line}] (fact)`);
    }
    
    // Show spawned subgoals
    if (step.subgoals.length > 0) {
      lines.push('│  Spawns subgoals:');
      for (const subgoal of step.subgoals) {
        lines.push(`│    ${subgoal.label} ${subgoal.goal}`);
      }
    }
  }
  
  return lines;
}

/**
 * Format EXIT step
 */
function formatExitStep(step: TimelineStep): string[] {
  const lines: string[] = [];
  
  // Show completed subgoal marker
  if (step.subgoalLabel) {
    lines.push(`│  ◀── Completed subgoal ${step.subgoalLabel}`);
  }
  
  // Show bindings
  if (step.unifications.length > 0) {
    lines.push('│  Bindings:');
    for (const unif of step.unifications) {
      lines.push(`│    ${unif.variable} = ${unif.value}`);
    }
  }
  
  // Show return-to reference
  if (step.returnsTo) {
    lines.push(`│  Returns to: Step ${step.returnsTo}`);
  }
  
  // Show variable flow note
  if (step.note) {
    lines.push(`│  Note: ${step.note}`);
  }
  
  // Show next subgoal
  if (step.nextSubgoal) {
    lines.push(`│  Next: ${step.nextSubgoal}`);
  }
  
  return lines;
}

/**
 * Format REDO step
 */
function formatRedoStep(step: TimelineStep): string[] {
  const lines: string[] = [];
  
  if (step.note) {
    lines.push(`│  ${step.note}`);
  }
  
  if (step.clause) {
    lines.push(`│  Trying clause: ${step.clause.head} [line ${step.clause.line}]`);
  }
  
  return lines;
}

/**
 * Format FAIL step
 */
function formatFailStep(step: TimelineStep): string[] {
  const lines: string[] = [];
  
  lines.push('│  Failure');
  
  if (step.note) {
    lines.push(`│  ${step.note}`);
  }
  
  return lines;
}

/**
 * Format built-in predicates concisely
 */
function isBuiltIn(goal: string): boolean {
  const builtins = ['>', '<', '>=', '=<', '=:=', '=\\=', 'is', '=', '\\=', 'true'];
  const predicate = goal.match(/^([^(]+)/)?.[1];
  return predicate ? builtins.includes(predicate) : false;
}
