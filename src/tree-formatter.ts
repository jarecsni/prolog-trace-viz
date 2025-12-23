/**
 * Tree Formatter - Generates Mermaid diagram from tree structure
 */

import { TreeNode } from './tree.js';

/**
 * Format tree as Mermaid diagram
 */
export function formatTreeAsMermaid(root: TreeNode | null): string {
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
  
  collectNodesAndEdges(root, nodes, edges, styles);
  
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
  isRoot: boolean = true
): void {
  // Generate node definition
  const nodeLabel = formatNodeLabel(node);
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
    collectNodesAndEdges(child, nodes, edges, styles, false);
  }
}

/**
 * Format node label with circled numbers and clause info
 */
function formatNodeLabel(node: TreeNode): string {
  const parts: string[] = [];
  
  // Use source clause head if available, otherwise use goal
  const displayGoal = node.clauseHead || node.goal;
  
  // Add call step with circled number
  parts.push(`${toCircledNumber(node.callStep)} ${displayGoal}`);
  
  // Add clause number if available
  if (node.clauseNumber) {
    parts.push(`clause ${node.clauseNumber}`);
  }
  
  // Add final binding if available (without EXIT step number since steps are now merged)
  if (node.finalBinding) {
    parts.push(`EXIT: ${node.finalBinding}`);
  }
  
  return `"${parts.join('<br/>')}"`;
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
