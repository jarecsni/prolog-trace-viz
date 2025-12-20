import { AnalysisResult, ExecutionStep, ClauseUsage } from './analyzer.js';

export interface RenderContext {
  query: string;
  diagram: string;
  executionSteps: ExecutionStep[];
  finalAnswer?: string;
  clausesUsed: ClauseUsage[];
}

/**
 * Renders a complete markdown document from the analysis results.
 */
export function renderMarkdown(context: RenderContext): string {
  const sections: string[] = [];
  
  // Title
  sections.push(`# Prolog Execution Tree: ${context.query}`);
  sections.push('');
  
  // Original query
  sections.push('## Query');
  sections.push('');
  sections.push('```prolog');
  sections.push(context.query);
  sections.push('```');
  sections.push('');
  
  // Clauses defined (moved up front)
  sections.push('## Clauses Defined');
  sections.push('');
  sections.push(renderClausesUsed(context.clausesUsed));
  sections.push('');
  
  // Mermaid diagram
  sections.push('## Search Tree Visualization');
  sections.push('');
  sections.push('```mermaid');
  sections.push(context.diagram);
  sections.push('```');
  sections.push('');
  
  // Legend
  sections.push(renderLegend());
  sections.push('');
  
  // Step-by-step execution
  sections.push('## Step-by-Step Execution');
  sections.push('');
  sections.push(renderExecutionSteps(context.executionSteps));
  sections.push('');
  
  // Final answer
  sections.push('## Final Answer');
  sections.push('');
  if (context.finalAnswer) {
    sections.push('```prolog');
    sections.push(context.finalAnswer);
    sections.push('```');
  } else {
    sections.push('Query succeeded with no bindings.');
  }
  
  return sections.join('\n');
}

/**
 * Renders the legend section explaining visual elements.
 */
export function renderLegend(): string {
  const lines: string[] = [
    '### Legend',
    '',
    '- 🎯 **Blue**: Initial query',
    '- 🔄 **Yellow**: Currently solving goal',
    '- 📦 **Orange**: Clause match with unifications',
    '- ⏸️ **Gray**: Pending goals (waiting for current goal to complete)',
    '- ✅ **Green**: Solved goal with binding',
    '- 🎉 **Green**: Final success',
    '- **Solid arrows**: Active execution flow',
    '- **Dashed arrows**: Goals queued for later',
    '- **Double arrows (green)**: Pending goal becomes active',
  ];
  
  return lines.join('\n');
}

/**
 * Renders the step-by-step execution breakdown.
 */
export function renderExecutionSteps(steps: ExecutionStep[]): string {
  if (steps.length === 0) {
    return '_No execution steps recorded._';
  }
  
  const lines: string[] = [];
  
  for (const step of steps) {
    lines.push(`### Step ${step.stepNumber}`);
    lines.push('');
    lines.push(`**Goal:** \`${step.goal}\``);
    lines.push('');
    lines.push(`**Action:** ${step.description}`);
    
    if (step.clauseMatched) {
      lines.push('');
      lines.push(`**Clause matched:** \`${step.clauseMatched}\``);
    }
    
    if (step.bindings && Object.keys(step.bindings).length > 0) {
      lines.push('');
      lines.push('**Bindings:**');
      for (const [key, value] of Object.entries(step.bindings)) {
        lines.push(`- \`${key} = ${value}\``);
      }
    }
    
    if (step.newGoals && step.newGoals.length > 0) {
      lines.push('');
      lines.push('**New subgoals:**');
      for (const goal of step.newGoals) {
        lines.push(`- \`${goal}\``);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Renders the clauses defined in the source file.
 */
function renderClausesUsed(clauses: ClauseUsage[]): string {
  if (clauses.length === 0) {
    return '_No clauses found in source file._';
  }
  
  const lines: string[] = [];
  
  // Table header
  lines.push('| Line # | Clause |');
  lines.push('|--------|--------|');
  
  // Table rows
  for (const clause of clauses) {
    lines.push(`| ${clause.clauseNumber} | \`${clause.clauseText}\` |`);
  }
  
  return lines.join('\n');
}

/**
 * Checks if the markdown output contains all required sections.
 */
export function hasRequiredSections(markdown: string): {
  hasTitle: boolean;
  hasQuery: boolean;
  hasMermaid: boolean;
  hasLegend: boolean;
  hasSteps: boolean;
  hasFinalAnswer: boolean;
  hasClausesUsed: boolean;
} {
  return {
    hasTitle: markdown.includes('# Prolog Trace:'),
    hasQuery: markdown.includes('## Query') && markdown.includes('```prolog'),
    hasMermaid: markdown.includes('```mermaid'),
    hasLegend: markdown.includes('## Legend'),
    hasSteps: markdown.includes('## Step-by-Step Execution'),
    hasFinalAnswer: markdown.includes('## Final Answer'),
    hasClausesUsed: markdown.includes('## Clauses Used'),
  };
}
