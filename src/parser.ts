import { createError, ErrorCode, ToolError } from './errors.js';

export interface ExecutionNode {
  id: string;
  type: 'query' | 'goal' | 'success' | 'failure';
  goal: string;
  binding?: string;
  clauseNumber?: number;
  children: ExecutionNode[];
  subgoals?: string[];
  level: number;
}

export interface Bundle {
  goal: string;
  chunks: Chunk[];
  subgoals?: string[];
}

export interface Chunk {
  binding?: string;
  content: string | Bundle | Tabular;
}

export interface Tabular {
  type: 'tabular';
  subgoals: string[];
}

interface ParseContext {
  nodeIdCounter: number;
}

// Unicode subscript characters
const SUBSCRIPTS: { [key: string]: string } = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
};

/**
 * Cleans up LaTeX formatting from goal text.
 */
function cleanLatexFormatting(text: string): string {
  return text
    .replace(/\$/g, '') // Remove math mode delimiters
    .replace(/\\lbrack\s*/g, '[') // Replace \lbrack with [
    .replace(/\\rbrack\s*/g, ']') // Replace \rbrack with ]
    .replace(/\\_/g, '_') // Replace \_ with _
    .replace(/_{(\d+)}/g, (_, digit) => SUBSCRIPTS[digit] || `_${digit}`) // Convert _{n} to subscript
    .replace(/,\s*,/g, ',') // Replace double commas with single
    .replace(/,\s*$/, '') // Remove trailing comma
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Parses sldnfdraw LaTeX output into an execution tree.
 */
export function parseLatex(latex: string): ExecutionNode {
  const ctx: ParseContext = { nodeIdCounter: 0 };
  
  // Find the outermost bundle
  const bundles = extractBundles(latex);
  
  if (bundles.length === 0) {
    // Return empty root if no bundles found
    return {
      id: `node_${ctx.nodeIdCounter++}`,
      type: 'query',
      goal: '',
      children: [],
      level: 0,
    };
  }
  
  // Convert the first bundle to an execution node (it's the query root)
  const tree = bundleToNode(bundles[0], ctx, 0);
  
  // Filter out clause_marker nodes
  return filterClauseMarkers(tree);
}

/**
 * Recursively filters out clause_marker nodes from the tree.
 * When a clause_marker node is found, it's replaced by its child,
 * and the clause number is stored in the child node.
 */
function filterClauseMarkers(node: ExecutionNode): ExecutionNode {
  // Check if this node is a clause_marker
  const markerMatch = node.goal.match(/clause_marker\(([^,]+),\s*(\d+)\)/);
  if (markerMatch) {
    const clauseNumber = parseInt(markerMatch[2], 10);
    // This is a clause_marker node - skip it and return its child with the clause number
    if (node.children.length > 0) {
      const child = filterClauseMarkers(node.children[0]);
      child.clauseNumber = clauseNumber;
      return child;
    }
    // No children - return the node as-is (shouldn't happen)
    return node;
  }
  
  // Not a clause_marker - filter its children
  node.children = node.children.map(child => filterClauseMarkers(child));
  return node;
}

/**
 * Extracts all top-level bundle structures from LaTeX content.
 */
export function extractBundles(latex: string): Bundle[] {
  const bundles: Bundle[] = [];
  let pos = 0;
  
  while (pos < latex.length) {
    const bundleStart = latex.indexOf('\\begin{bundle}', pos);
    if (bundleStart === -1) break;
    
    const result = parseBundleAt(latex, bundleStart);
    if (result) {
      bundles.push(result.bundle);
      pos = result.endPos;
    } else {
      pos = bundleStart + 1;
    }
  }
  
  return bundles;
}

/**
 * Parses a bundle starting at the given position.
 */
function parseBundleAt(latex: string, startPos: number): { bundle: Bundle; endPos: number } | null {
  // Match \begin{bundle}{
  const beginMatch = latex.slice(startPos).match(/^\\begin\{bundle\}\{/);
  if (!beginMatch) return null;
  
  // Find the matching closing brace for the goal
  const goalStart = startPos + beginMatch[0].length;
  const goalEnd = findMatchingBrace(latex, goalStart);
  if (goalEnd === -1) return null;
  
  let goal = latex.slice(goalStart, goalEnd);
  let subgoals: string[] | undefined;
  
  // If goal contains tabular, extract the content from inside it
  const tabularMatch = goal.match(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/);
  if (tabularMatch) {
    // Extract goals from tabular, they're separated by \\
    const tabularContent = tabularMatch[1];
    subgoals = tabularContent
      .split(/\\\\/)
      .map(s => cleanLatexFormatting(s.trim()))
      .filter(s => s.length > 0);
    
    // Use first goal as the main goal text
    goal = subgoals[0] || goal;
  } else {
    // Clean up LaTeX formatting
    goal = cleanLatexFormatting(goal);
  }
  
  const contentStart = goalEnd + 1;
  
  // Find matching \end{bundle}
  const endPos = findMatchingEnd(latex, contentStart, 'bundle');
  if (endPos === -1) return null;
  
  const content = latex.slice(contentStart, endPos);
  const chunks = extractChunks(content);
  
  return {
    bundle: { goal, chunks, subgoals },
    endPos: endPos + '\\end{bundle}'.length,
  };
}

/**
 * Finds the matching \end{type} for a \begin{type}.
 */
function findMatchingEnd(latex: string, startPos: number, type: string): number {
  let depth = 1;
  let pos = startPos;
  const beginTag = `\\begin{${type}}`;
  const endTag = `\\end{${type}}`;
  
  while (pos < latex.length && depth > 0) {
    const nextBegin = latex.indexOf(beginTag, pos);
    const nextEnd = latex.indexOf(endTag, pos);
    
    if (nextEnd === -1) return -1;
    
    if (nextBegin !== -1 && nextBegin < nextEnd) {
      depth++;
      pos = nextBegin + beginTag.length;
    } else {
      depth--;
      if (depth === 0) return nextEnd;
      pos = nextEnd + endTag.length;
    }
  }
  
  return -1;
}

/**
 * Extracts chunks from bundle content.
 */
export function extractChunks(content: string): Chunk[] {
  const chunks: Chunk[] = [];
  let pos = 0;
  
  while (pos < content.length) {
    // Look for \chunk command
    const chunkMatch = content.slice(pos).match(/^\\chunk(\[[^\]]*\])?\{/);
    if (chunkMatch) {
      const binding = chunkMatch[1] ? cleanLatexFormatting(chunkMatch[1].slice(1, -1)) : undefined;
      const chunkContentStart = pos + chunkMatch[0].length;
      
      // Find the matching closing brace
      const chunkContentEnd = findMatchingBrace(content, chunkContentStart);
      if (chunkContentEnd === -1) {
        pos++;
        continue;
      }
      
      const chunkContent = content.slice(chunkContentStart, chunkContentEnd);
      
      // Check if content is a nested bundle
      if (chunkContent.includes('\\begin{bundle}')) {
        const nestedBundles = extractBundles(chunkContent);
        if (nestedBundles.length > 0) {
          chunks.push({ binding, content: nestedBundles[0] });
        }
      } else if (chunkContent.includes('\\begin{tabular}')) {
        const tabular = parseTabular(chunkContent);
        if (tabular) {
          chunks.push({ binding, content: tabular });
        }
      } else {
        chunks.push({ binding, content: chunkContent.trim() });
      }
      
      pos = chunkContentEnd + 1;
    } else {
      pos++;
    }
  }
  
  return chunks;
}

/**
 * Finds the matching closing brace.
 */
function findMatchingBrace(content: string, startPos: number): number {
  let depth = 1;
  let pos = startPos;
  
  while (pos < content.length && depth > 0) {
    if (content[pos] === '{') depth++;
    else if (content[pos] === '}') depth--;
    if (depth > 0) pos++;
  }
  
  return depth === 0 ? pos : -1;
}

/**
 * Parses a tabular block to extract subgoals.
 */
function parseTabular(content: string): Tabular | null {
  const tabularMatch = content.match(/\\begin\{tabular\}[^}]*\}([\s\S]*?)\\end\{tabular\}/);
  if (!tabularMatch) return null;
  
  const tabularContent = tabularMatch[1];
  // Subgoals are typically separated by & or \\
  const subgoals = tabularContent
    .split(/[&\\\\]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('\\'));
  
  return { type: 'tabular', subgoals };
}

/**
 * Converts a Bundle to an ExecutionNode.
 */
function bundleToNode(bundle: Bundle, ctx: ParseContext, level: number): ExecutionNode {
  const node: ExecutionNode = {
    id: `node_${ctx.nodeIdCounter++}`,
    type: level === 0 ? 'query' : 'goal',
    goal: bundle.goal,
    children: [],
    subgoals: bundle.subgoals,
    level,
  };
  
  for (const chunk of bundle.chunks) {
    if (chunk.binding) {
      // This chunk has a binding - it represents a clause match
      node.binding = cleanLatexFormatting(chunk.binding);
    }
    
    if (typeof chunk.content === 'string') {
      // Terminal content - could be success/failure marker
      const trimmed = chunk.content.trim().replace(/~/g, '').trim();
      if (trimmed === 'true' || trimmed === 'success' || chunk.content === '') {
        // Add success child
        node.children.push({
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'success',
          goal: 'true',
          children: [],
          level: level + 1,
        });
      } else if (trimmed === 'false' || trimmed === 'fail') {
        // Add failure child
        node.children.push({
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'failure',
          goal: 'false',
          children: [],
          level: level + 1,
        });
      }
    } else if ('type' in chunk.content && chunk.content.type === 'tabular') {
      // Tabular with subgoals
      node.subgoals = chunk.content.subgoals;
      // Create child nodes for each subgoal
      for (const subgoal of chunk.content.subgoals) {
        node.children.push({
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'goal',
          goal: subgoal,
          children: [],
          level: level + 1,
        });
      }
    } else {
      // Nested bundle
      const childNode = bundleToNode(chunk.content as Bundle, ctx, level + 1);
      if (chunk.binding && !childNode.binding) {
        // Only set binding if child doesn't have one already
        childNode.binding = cleanLatexFormatting(chunk.binding);
      }
      node.children.push(childNode);
    }
  }
  
  return node;
}

/**
 * Serializes an ExecutionNode back to LaTeX format (for round-trip testing).
 */
export function serializeToLatex(node: ExecutionNode): string {
  return serializeNode(node);
}

function serializeNode(node: ExecutionNode): string {
  const lines: string[] = [];
  
  lines.push(`\\begin{bundle}{${node.goal}}`);
  
  if (node.children.length === 0) {
    // Leaf node
    const bindingAttr = node.binding ? `[${node.binding}]` : '';
    lines.push(`\\chunk${bindingAttr}{}`);
  } else if (node.subgoals && node.subgoals.length > 0) {
    // Node with tabular subgoals
    const bindingAttr = node.binding ? `[${node.binding}]` : '';
    lines.push(`\\chunk${bindingAttr}{`);
    lines.push(`\\begin{tabular}{${'c'.repeat(node.subgoals.length)}}`);
    lines.push(node.subgoals.join(' & '));
    lines.push(`\\end{tabular}`);
    lines.push(`}`);
  } else {
    // Node with children
    for (const child of node.children) {
      if (child.type === 'success') {
        const bindingAttr = node.binding ? `[${node.binding}]` : '';
        lines.push(`\\chunk${bindingAttr}{success}`);
      } else {
        const bindingAttr = child.binding ? `[${child.binding}]` : '';
        lines.push(`\\chunk${bindingAttr}{`);
        lines.push(serializeNode(child));
        lines.push(`}`);
      }
    }
  }
  
  lines.push(`\\end{bundle}`);
  
  return lines.join('\n');
}
