import { createError, ErrorCode, ToolError } from './errors.js';

export interface Unification {
  variable: string;
  value: string;
}

export interface TraceEvent {
  port: 'call' | 'exit' | 'redo' | 'fail';
  level: number;
  goal: string;
  arguments?: any[];
  clause?: {
    head: string;
    body: string;
    line: number;
  };
  predicate: string;
}

export interface ExecutionNode {
  id: string;
  type: 'query' | 'goal' | 'success' | 'failure';
  goal: string;
  binding?: string;
  unifications?: Unification[];
  clauseNumber?: number;
  clauseLine?: number;
  children: ExecutionNode[];
  subgoals?: string[];
  level: number;
  arguments?: any[];
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
 * and the clause number is stored in the child node and propagated to predicate calls.
 */
function filterClauseMarkers(node: ExecutionNode): ExecutionNode {
  // Check if this node is a clause_marker
  const markerMatch = node.goal.match(/clause_marker\(([^,]+),\s*(\d+)\)/);
  if (markerMatch) {
    const clauseNumber = parseInt(markerMatch[2], 10);
    const predicateName = markerMatch[1];
    
    // This is a clause_marker node - skip it and return its child with the clause number
    if (node.children.length > 0) {
      const child = filterClauseMarkers(node.children[0]);
      child.clauseNumber = clauseNumber;
      // Preserve subgoals from the parent (the node being filtered out)
      if (node.subgoals && !child.subgoals) {
        child.subgoals = node.subgoals;
      }
      return child;
    }
    // No children - return the node as-is (shouldn't happen)
    return node;
  }
  
  // Not a clause_marker - filter its children
  node.children = node.children.map(child => filterClauseMarkers(child));
  
  // If this is a predicate call (not the root query) and its first child has a clause number, inherit it
  // This handles the case where factorial(2, R1₀) has a child "2>0, ... [clause 2]"
  if (node.level > 0 && node.goal.match(/^[a-z_][a-zA-Z0-9_]*\(/) && !node.clauseNumber && node.children.length > 0) {
    const firstChild = node.children[0];
    if (firstChild.clauseNumber) {
      node.clauseNumber = firstChild.clauseNumber;
    }
    // Also inherit subgoals if the first child has them
    if (firstChild.subgoals && !node.subgoals) {
      node.subgoals = firstChild.subgoals;
    }
  }
  
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

/**
 * Parses JSON trace events from the custom tracer into an execution tree.
 */
export function parseTraceJson(json: string): ExecutionNode {
  const events = parseEvents(json);
  return buildTreeFromEvents(events);
}

/**
 * Parses JSON array into TraceEvent objects with validation.
 */
function parseEvents(json: string): TraceEvent[] {
  let rawEvents: any[];
  
  try {
    rawEvents = JSON.parse(json);
  } catch (error) {
    console.error('JSON parsing error:', error);
    return [];
  }
  
  if (!Array.isArray(rawEvents)) {
    console.error('Expected JSON array of trace events');
    return [];
  }
  
  const events: TraceEvent[] = [];
  
  for (let i = 0; i < rawEvents.length; i++) {
    const rawEvent = rawEvents[i];
    
    // Validate required fields
    if (!rawEvent || typeof rawEvent !== 'object') {
      console.warn(`Skipping invalid event at index ${i}: not an object`);
      continue;
    }
    
    const { port, level, goal, predicate } = rawEvent;
    
    if (!port || !['call', 'exit', 'redo', 'fail'].includes(port)) {
      console.warn(`Skipping event at index ${i}: invalid port "${port}"`);
      continue;
    }
    
    if (typeof level !== 'number' || level < 0) {
      console.warn(`Skipping event at index ${i}: invalid level "${level}"`);
      continue;
    }
    
    if (!goal || typeof goal !== 'string') {
      console.warn(`Skipping event at index ${i}: invalid goal "${goal}"`);
      continue;
    }
    
    if (!predicate || typeof predicate !== 'string') {
      console.warn(`Skipping event at index ${i}: invalid predicate "${predicate}"`);
      continue;
    }
    
    // Filter out system predicates if needed
    if (isSystemPredicate(predicate)) {
      continue;
    }
    
    // Build valid event
    const event: TraceEvent = {
      port: port as 'call' | 'exit' | 'redo' | 'fail',
      level,
      goal,
      predicate,
    };
    
    // Add optional fields
    if (rawEvent.arguments && Array.isArray(rawEvent.arguments)) {
      event.arguments = rawEvent.arguments;
    }
    
    if (rawEvent.clause && typeof rawEvent.clause === 'object') {
      const { head, body, line } = rawEvent.clause;
      if (head && body && typeof line === 'number') {
        event.clause = { head, body, line };
      }
    }
    
    events.push(event);
  }
  
  return events;
}

/**
 * Checks if a predicate is a system predicate that should be filtered out.
 */
function isSystemPredicate(predicate: string): boolean {
  const systemPredicates = [
    'findall/3',
    'trace_event/1',
    'export_trace_json/1',
    'open/3',
    'close/1',
    'write/2',
    'format/2',
    'format/3',
  ];
  
  return systemPredicates.includes(predicate);
}

/**
 * Stack entry for call stack management.
 */
interface StackEntry {
  node: ExecutionNode;
  callEvent: TraceEvent;
  children: ExecutionNode[];
  isCompleted: boolean;
  isFailed: boolean;
}

/**
 * Call stack manager for tracking active goals by recursion level.
 * Optimized for performance with large traces and deep recursion.
 */
class CallStack {
  private stack: Map<number, StackEntry> = new Map();
  private maxLevel: number = -1; // Track maximum level for optimization
  
  push(level: number, node: ExecutionNode, event: TraceEvent): void {
    // Reuse StackEntry objects to reduce garbage collection
    const entry: StackEntry = {
      node,
      callEvent: event,
      children: [],
      isCompleted: false,
      isFailed: false,
    };
    
    this.stack.set(level, entry);
    
    // Update max level for optimization
    if (level > this.maxLevel) {
      this.maxLevel = level;
    }
  }
  
  pop(level: number): StackEntry | undefined {
    const entry = this.stack.get(level);
    if (entry) {
      this.stack.delete(level);
      
      // Update max level if we popped the highest level
      if (level === this.maxLevel) {
        this.maxLevel = this.findNewMaxLevel();
      }
    }
    return entry;
  }
  
  peek(level: number): StackEntry | undefined {
    return this.stack.get(level);
  }
  
  isEmpty(): boolean {
    return this.stack.size === 0;
  }
  
  getParent(level: number): StackEntry | undefined {
    // Optimized parent lookup - check if parent level exists before Map lookup
    if (level <= 0 || level - 1 > this.maxLevel) {
      return undefined;
    }
    return this.stack.get(level - 1);
  }
  
  /**
   * Clear all stack entries to free memory (useful for large traces)
   */
  clear(): void {
    this.stack.clear();
    this.maxLevel = -1;
  }
  
  /**
   * Get current stack depth for monitoring
   */
  getDepth(): number {
    return this.stack.size;
  }
  
  /**
   * Get maximum level seen (for debugging/monitoring)
   */
  getMaxLevel(): number {
    return this.maxLevel;
  }
  
  /**
   * Find new maximum level after popping the current max
   */
  private findNewMaxLevel(): number {
    let newMax = -1;
    for (const level of this.stack.keys()) {
      if (level > newMax) {
        newMax = level;
      }
    }
    return newMax;
  }
}

/**
 * Builds an execution tree from trace events using the 4-port model.
 * Optimised for deep recursion with efficient memory usage and comprehensive error handling.
 */
function buildTreeFromEvents(events: TraceEvent[]): ExecutionNode {
  const ctx: ParseContext = { nodeIdCounter: 0 };
  const callStack = new CallStack();
  let root: ExecutionNode | null = null;
  
  // Early return for empty events
  if (events.length === 0) {
    return {
      id: `node_${ctx.nodeIdCounter++}`,
      type: 'query',
      goal: '',
      children: [],
      level: 0,
    };
  }
  
  // Error tracking for debugging (only in development)
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Optimized level calculation - single pass instead of Math.min
  let minLevel = events[0].level;
  let maxLevel = events[0].level;
  for (let i = 1; i < events.length; i++) {
    const level = events[i].level;
    if (level < minLevel) minLevel = level;
    if (level > maxLevel) maxLevel = level;
  }
  
  // Pre-allocate node ID space for better performance with large traces
  const estimatedNodes = Math.min(events.length, maxLevel * 2 + 100);
  
  // Performance monitoring (can be disabled in production)
  let maxDepthSeen = 0;
  let processedEvents = 0;
  
  // Process events with optimized loop
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const { port, level, goal, arguments: args, clause, predicate } = event;
    
    // Track maximum recursion depth for monitoring
    if (level > maxDepthSeen) {
      maxDepthSeen = level;
    }
    
    processedEvents++;
    
    if (port === 'call') {
      // Create new node for this goal
      const node: ExecutionNode = {
        id: `node_${ctx.nodeIdCounter++}`,
        type: level === minLevel ? 'query' : 'goal',
        goal,
        children: [],
        level,
      };
      
      // Extract clause information if present
      if (clause) {
        node.clauseLine = clause.line;
        node.clauseNumber = clause.line; // Use line number as clause number for now
      }
      
      // Set as root if this is the top-level query (minimum level)
      if (level === minLevel) {
        root = node;
        node.type = 'query'; // Ensure root is marked as query
      } else {
        // Add to parent's children
        const parent = callStack.getParent(level);
        if (parent) {
          parent.node.children.push(node);
        }
      }
      
      // Push onto call stack
      callStack.push(level, node, event);
      
    } else if (port === 'exit') {
      // Goal succeeded - extract unifications and mark as completed
      const stackEntry = callStack.peek(level);
      if (stackEntry) {
        const node = stackEntry.node;
        
        // Store arguments from exit event
        if (args && args.length > 0) {
          node.arguments = args;
        }
        
        // Extract unifications by comparing call and exit goals
        const unifications = extractUnifications(stackEntry.callEvent.goal, goal, args);
        if (unifications.length > 0) {
          node.unifications = unifications;
          // Format binding for analyzer compatibility
          node.binding = unifications.map(u => `${u.variable} = ${u.value}`).join(', ');
        }
        
        // Update clause info if present
        if (clause) {
          node.clauseLine = clause.line;
          node.clauseNumber = clause.line;
        }
        
        stackEntry.isCompleted = true;
        
        // Add success child if no children exist
        if (node.children.length === 0) {
          node.children.push({
            id: `node_${ctx.nodeIdCounter++}`,
            type: 'success',
            goal: 'true',
            children: [],
            level: level + 1,
          });
        }
      } else {
        // Handle unmatched exit event - create placeholder node
        warnings.push(`Unmatched exit event at level ${level} for goal: ${goal}`);
        
        // Create placeholder node for missing call
        const placeholderNode: ExecutionNode = {
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'goal',
          goal: goal + ' (recovered)',
          children: [],
          level,
        };
        
        // Add arguments and unifications if present
        if (args && args.length > 0) {
          placeholderNode.arguments = args;
          // Try to extract unifications even without matching call
          const simpleUnifications = extractSimpleUnifications(goal, args);
          if (simpleUnifications.length > 0) {
            placeholderNode.unifications = simpleUnifications;
            placeholderNode.binding = simpleUnifications.map(u => `${u.variable} = ${u.value}`).join(', ');
          }
        }
        
        // Add success child
        placeholderNode.children.push({
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'success',
          goal: 'true',
          children: [],
          level: level + 1,
        });
        
        // Add to parent if possible, otherwise ensure we have a root to contain it
        const parent = callStack.getParent(level);
        if (parent) {
          parent.node.children.push(placeholderNode);
        } else {
          // Ensure we have a root node to contain placeholders
          if (!root) {
            root = {
              id: `node_${ctx.nodeIdCounter++}`,
              type: 'query',
              goal: '',
              children: [],
              level: minLevel,
            };
          }
          root.children.push(placeholderNode);
        }
      }
      
    } else if (port === 'fail') {
      // Goal failed - mark as failed and add failure child
      const stackEntry = callStack.peek(level);
      if (stackEntry) {
        const node = stackEntry.node;
        stackEntry.isFailed = true;
        
        // Add failure child (but preserve any existing unifications from previous solutions)
        node.children.push({
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'failure',
          goal: 'false',
          children: [],
          level: level + 1,
        });
        
        // Pop from stack
        callStack.pop(level);
      } else {
        // Handle unmatched fail event
        warnings.push(`Unmatched fail event at level ${level} for goal: ${goal}`);
        
        // Create placeholder node for missing call
        const placeholderNode: ExecutionNode = {
          id: `node_${ctx.nodeIdCounter++}`,
          type: 'goal',
          goal: goal + ' (recovered)',
          children: [{
            id: `node_${ctx.nodeIdCounter++}`,
            type: 'failure',
            goal: 'false',
            children: [],
            level: level + 1,
          }],
          level,
        };
        
        // Add to parent if possible, otherwise ensure we have a root to contain it
        const parent = callStack.getParent(level);
        if (parent) {
          parent.node.children.push(placeholderNode);
        } else {
          // Ensure we have a root node to contain placeholders
          if (!root) {
            root = {
              id: `node_${ctx.nodeIdCounter++}`,
              type: 'query',
              goal: '',
              children: [],
              level: minLevel,
            };
          }
          root.children.push(placeholderNode);
        }
      }
      
    } else if (port === 'redo') {
      // Backtracking - prepare for alternative execution
      const stackEntry = callStack.peek(level);
      if (stackEntry) {
        const node = stackEntry.node;
        
        // Store previous solution state (don't clear it yet - wait for next exit or fail)
        // This allows us to preserve the last successful solution if we fail later
        
        // Remove success children to prepare for new attempt
        node.children = node.children.filter(child => child.type !== 'success');
        
        // Reset completion state but keep unifications until we get a new solution or fail
        stackEntry.isCompleted = false;
        stackEntry.isFailed = false;
      } else {
        // Handle unmatched redo event
        warnings.push(`Unmatched redo event at level ${level} for goal: ${goal}`);
        // Redo events without matching calls are less critical, just log the warning
      }
    }
  }
  
  // Clean up resources
  callStack.clear();
  
  // Log errors and warnings if any occurred (only in development)
  if (process.env.NODE_ENV !== 'production') {
    if (errors.length > 0) {
      console.error('Parser errors encountered:', errors);
    }
    if (warnings.length > 0) {
      console.warn('Parser warnings:', warnings);
    }
    
    // Log performance metrics for large traces
    if (events.length > 1000) {
      console.log(`Parsed ${processedEvents} events, max depth: ${maxDepthSeen}, final stack depth: ${callStack.getDepth()}`);
    }
  }
  
  // Return root or create empty root if none exists
  return root || {
    id: `node_${ctx.nodeIdCounter++}`,
    type: 'query',
    goal: '',
    children: [],
    level: 0,
  };
}

/**
 * Clears internal caches to free memory.
 * Call this periodically when processing many large traces.
 */
export function clearParserCaches(): void {
  argumentCache.clear();
}

/**
 * Performance benchmark results
 */
export interface BenchmarkResult {
  parseTime: number;
  eventsPerSecond: number;
  memoryUsed: number;
  nodeCount: number;
  maxDepth: number;
  cacheHitRate?: number;
}

/**
 * Benchmarks the JSON parser performance with the given trace data.
 * Returns detailed performance metrics.
 */
export function benchmarkParser(json: string): BenchmarkResult {
  // Clear caches for consistent benchmarking
  clearParserCaches();
  
  // Measure memory before parsing
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Parse events to count them
  const events = parseEvents(json);
  const eventCount = events.length;
  
  // Benchmark the tree building
  const startTime = performance.now();
  const tree = buildTreeFromEvents(events);
  const endTime = performance.now();
  
  // Measure memory after parsing
  const finalMemory = process.memoryUsage().heapUsed;
  
  // Calculate metrics
  const parseTime = endTime - startTime;
  const eventsPerSecond = eventCount / (parseTime / 1000);
  const memoryUsed = finalMemory - initialMemory;
  
  // Count nodes in tree
  function countNodes(node: ExecutionNode): number {
    let count = 1;
    for (const child of node.children) {
      count += countNodes(child);
    }
    return count;
  }
  
  // Calculate max depth
  function getMaxDepth(node: ExecutionNode): number {
    if (node.children.length === 0) return node.level;
    return Math.max(...node.children.map(getMaxDepth));
  }
  
  const nodeCount = countNodes(tree);
  const maxDepth = getMaxDepth(tree);
  
  return {
    parseTime,
    eventsPerSecond,
    memoryUsed,
    nodeCount,
    maxDepth,
  };
}

// Cache for parsed arguments to avoid re-parsing
const argumentCache = new Map<string, string[]>();

/**
 * Extracts unifications by comparing call goal with exit goal and arguments.
 * Optimized with caching for better performance with repeated patterns.
 */
function extractUnifications(callGoal: string, exitGoal: string, exitArgs?: any[]): Unification[] {
  // Early return for common cases
  if (!exitArgs || exitArgs.length === 0) {
    return [];
  }
  
  // Parse call goal to get variable names
  const callMatch = callGoal.match(/^([a-z_][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!callMatch) {
    return [];
  }
  
  const callArgString = callMatch[2];
  
  // Use cache for argument parsing to improve performance
  let callArgs = argumentCache.get(callArgString);
  if (!callArgs) {
    callArgs = parseArguments(callArgString);
    // Limit cache size to prevent memory leaks
    if (argumentCache.size < 1000) {
      argumentCache.set(callArgString, callArgs);
    }
  }
  
  // Pre-allocate unifications array for better performance
  const unifications: Unification[] = [];
  const maxArgs = Math.min(callArgs.length, exitArgs.length);
  
  // Create unifications by pairing call args with exit args
  for (let i = 0; i < maxArgs; i++) {
    const callArg = callArgs[i].trim();
    
    // Only create unification if call arg is a variable (starts with uppercase or _)
    // Use charAt for better performance than regex
    const firstChar = callArg.charAt(0);
    if (firstChar >= 'A' && firstChar <= 'Z' || firstChar === '_') {
      unifications.push({
        variable: callArg,
        value: formatValue(exitArgs[i]),
      });
    }
  }
  
  return unifications;
}

/**
 * Parses argument string into individual arguments.
 * Handles nested structures like lists and compounds.
 */
function parseArguments(argString: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  
  for (let i = 0; i < argString.length; i++) {
    const char = argString[i];
    
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      current += char;
    } else if (inQuotes) {
      current += char;
    } else if (char === '(' || char === '[') {
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
 * Formats a value for display.
 */
function formatValue(value: any): string {
  if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(',')}]`;
  } else if (typeof value === 'object' && value !== null) {
    // Handle compound terms
    return JSON.stringify(value);
  } else {
    return String(value);
  }
}

/**
 * Extracts simple unifications from a goal and arguments when no matching call exists.
 * This is a fallback for error recovery scenarios.
 */
function extractSimpleUnifications(goal: string, args?: any[]): Unification[] {
  const unifications: Unification[] = [];
  
  if (!args || args.length === 0) {
    return unifications;
  }
  
  // Parse goal to get argument positions
  const goalMatch = goal.match(/^([a-z_][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!goalMatch) {
    return unifications;
  }
  
  const goalArgString = goalMatch[2];
  const goalArgs = parseArguments(goalArgString);
  
  // Create unifications for variables in goal arguments
  for (let i = 0; i < Math.min(goalArgs.length, args.length); i++) {
    const goalArg = goalArgs[i].trim();
    const argValue = formatValue(args[i]);
    
    // Only create unification if goal arg looks like a variable
    if (goalArg.match(/^[A-Z_]/)) {
      unifications.push({
        variable: goalArg,
        value: argValue,
      });
    }
  }
  
  return unifications;
}
