/**
 * Tree Formatter - Generates Mermaid diagram from tree structure
 * 
 * By default, uses clause variable names instead of internal Prolog names.
 */

import { TreeNode } from './tree.js';

export interface TreeFormatterOptions {
  showInternalVars?: boolean;
}

/**
 * Format tree as Mermaid diagram
 */
export function formatTreeAsMermaid(root: TreeNode | null, options: TreeFormatterOptions = {}): string {
  if (!root) {
    return 'graph TD\n  A["No execution tree"]';
  }
  
  const lines: string[] = [];
  lines.push('graph TD');
  lines.push('');
  
  // Generate nodes
  const nodes: string[] = [];
  const edges: string[] = [];
  const styles: string[] = [];
  
  collectNodesAndEdges(root, nodes, edges, styles, true, options);
  
  // Add nodes section
  lines.push('%% Nodes');
  lines.push(...nodes);
  lines.push('');
  
  // Add edges section
  lines.push('%% Edges');
  lines.push(...edges);
  lines.push('');
  
  // Add styles section
  lines.push('%% Styles');
  lines.push(...styles);
  
  return lines.join('\n');
}

/**
 * Collect nodes, edges, and styles recursively
 */
function collectNodesAndEdges(
  node: TreeNode,
  nodes: string[],
  edges: string[],
  styles: string[],
  isRoot: boolean = true,
  options: TreeFormatterOptions = {}
): void {
  // Generate node definition
  const nodeLabel = formatNodeLabel(node, options);
  nodes.push(`${node.id}[${nodeLabel}]`);
  
  // Generate style
  const style = getNodeStyle(node, isRoot);
  if (style) {
    styles.push(style);
  }
  
  // Generate edges to children
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    
    // Use actual subgoal content if available, otherwise generic label
    let edgeLabel = `subgoal ${i + 1}`;
    if (node.subgoals && i < node.subgoals.length) {
      edgeLabel = node.subgoals[i].goal;
    }
    
    edges.push(`${node.id} -->|"${edgeLabel}"| ${child.id}`);
    
    // Recursively process child
    collectNodesAndEdges(child, nodes, edges, styles, false, options);
  }
}

/**
 * Format node label with circled numbers and clause info
 */
function formatNodeLabel(node: TreeNode, options: TreeFormatterOptions = {}): string {
  const parts: string[] = [];
  const showInternal = options.showInternalVars ?? false;
  
  // Use source clause head if available, otherwise use goal
  const displayGoal = node.clauseHead || node.goal;
  
  // Add call step with circled number
  parts.push(`${toCircledNumber(node.callStep)} ${displayGoal}`);
  
  // Add clause number if available
  if (node.clauseNumber) {
    parts.push(`clause ${node.clauseNumber}`);
  }
  
  // Add final binding if available
  if (node.finalBinding) {
    // Format the binding - use clause variable name if not showing internal
    const bindingDisplay = showInternal 
      ? node.finalBinding 
      : formatBindingWithClauseVar(node.finalBinding, node.clauseHead);
    parts.push(`Result: ${bindingDisplay}`);
  }
  
  return `"${parts.join('<br/>')}"`;
}

/**
 * Format a binding using clause variable name instead of internal name
 * e.g., "_2008=1+1+1+1+0" with clauseHead "t(X+1+1, Z)" -> "Z=1+1+1+1+0"
 */
function formatBindingWithClauseVar(binding: string, clauseHead?: string): string {
  if (!clauseHead) return binding;
  
  // Parse binding: "_2008=1+1+1+1+0" -> ["_2008", "1+1+1+1+0"]
  const eqIndex = binding.indexOf('=');
  if (eqIndex === -1) return binding;
  
  const varPart = binding.slice(0, eqIndex);
  const valuePart = binding.slice(eqIndex + 1);
  
  // If it's an internal variable, try to find the clause variable name
  if (/^_\d+$/.test(varPart)) {
    // Extract the last argument from clause head (typically the output)
    const headMatch = clauseHead.match(/^[^(]+\((.+)\)$/);
    if (headMatch) {
      const args = splitArgsSimple(headMatch[1]);
      if (args.length > 0) {
        const lastArg = args[args.length - 1].trim();
        // Check if it's a simple variable
        if (/^[A-Z][A-Za-z0-9_]*$/.test(lastArg)) {
          return `${lastArg}=${valuePart}`;
        }
        // For patterns like X+1+0, show the full pattern
        if (lastArg.includes('+') || lastArg.includes('[')) {
          return `${lastArg}=${valuePart}`;
        }
      }
    }
  }
  
  return binding;
}

/**
 * Simple argument splitter for clause heads
 */
function splitArgsSimple(argsStr: string): string[] {
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
 * Convert number to circled Unicode character
 */
function toCircledNumber(n: number): string {
  if (n >= 1 && n <= 20) {
    // Unicode circled numbers 1-20
    return String.fromCharCode(0x2460 + n - 1);
  } else if (n >= 21 && n <= 35) {
    // Unicode circled numbers 21-35
    return String.fromCharCode(0x3251 + n - 21);
  } else if (n >= 36 && n <= 50) {
    // Unicode circled numbers 36-50
    return String.fromCharCode(0x32B1 + n - 36);
  } else {
    // Fallback for numbers > 50
    return `(${n})`;
  }
}

/**
 * Get Mermaid style for node based on status
 */
function getNodeStyle(node: TreeNode, isRoot: boolean): string | null {
  if (isRoot) {
    // Blue for root query
    return `style ${node.id} fill:#e1f5ff,stroke:#01579b,stroke-width:3px`;
  }
  
  switch (node.status) {
    case 'success':
      // Green for success
      return `style ${node.id} fill:#c8e6c9,stroke:#388e3c`;
    case 'failure':
      // Red for failure
      return `style ${node.id} fill:#ffcdd2,stroke:#c62828`;
    case 'pending':
      // Yellow for pending
      return `style ${node.id} fill:#fff9c4,stroke:#f57f17`;
    default:
      return null;
  }
}

/**
 * Handle backtracking visualization in tree
 */
export function markBacktrackingPaths(root: TreeNode): void {
  // Walk the tree and mark failed attempts
  function markNode(node: TreeNode): void {
    // If this node failed, mark it
    if (node.status === 'failure') {
      // Already marked by status
    }
    
    // Process children
    for (const child of node.children) {
      markNode(child);
    }
  }
  
  markNode(root);
}
