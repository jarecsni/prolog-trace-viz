import { ExecutionNode } from './parser.js';

export interface VisualizationNode {
  id: string;
  type: 'query' | 'solving' | 'pending' | 'solved' | 'success';
  label: string;
  emoji: string;
  level: number;
  clauseNumber?: number;
}

export interface VisualizationEdge {
  id: string;
  from: string;
  to: string;
  type: 'active' | 'queue' | 'activate';
  label: string;
  stepNumber: number;
}

export interface PendingGoal {
  id: string;
  goal: string;
  queuedAt: string;
  activatedAt?: string;
}

export interface ClauseUsage {
  clauseNumber: number;
  clauseText: string;
  usageCount: number;
  usedAtSteps: number[];
}

export interface ExecutionStep {
  stepNumber: number;
  description: string;
  goal: string;
  clauseMatched?: string;
  bindings?: Record<string, string>;
  newGoals?: string[];
}

export interface AnalysisResult {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  pendingGoals: Map<string, PendingGoal>;
  executionOrder: string[];
  clausesUsed: ClauseUsage[];
  executionSteps: ExecutionStep[];
  finalAnswer?: string;
}

const EMOJIS = {
  query: '🎯',
  solving: '🔄',
  pending: '⏸️',
  solved: '✅',
  success: '🎉',
};

import { Clause, inferClauseFromGoal } from './clauses.js';

/**
 * Analyzes an execution tree and produces visualization data.
 */
export function analyzeTree(root: ExecutionNode, clauses: Clause[] = []): AnalysisResult {
  const nodes: VisualizationNode[] = [];
  const edges: VisualizationEdge[] = [];
  const pendingGoalMap = new Map<string, string>(); // goal text -> node id
  const executionSteps: ExecutionStep[] = [];
  
  let stepCounter = 1;
  let nodeIdCounter = 0;
  
  // Generate letter-based node IDs (A, B, B2, C, C2, etc.)
  const letterIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  let currentLetter = 0;
  let lastNonPendingLetter = -1;
  const pendingCounters = new Map<number, number>(); // Track pending node count per parent letter
  
  const nextNodeId = (isPending: boolean = false) => {
    if (isPending) {
      // Pending nodes use the last non-pending letter with incrementing suffixes
      const count = pendingCounters.get(lastNonPendingLetter) || 0;
      pendingCounters.set(lastNonPendingLetter, count + 1);
      return `${letterIds[lastNonPendingLetter]}${count + 2}`; // Start at 2 (B2, B3, B4...)
    } else {
      // Regular nodes advance the letter
      const id = letterIds[currentLetter];
      lastNonPendingLetter = currentLetter;
      currentLetter++;
      return id;
    }
  };
  
  // Process the tree
  processTreeNode(root, null, {
    nodes,
    edges,
    pendingGoalMap,
    executionSteps,
    stepCounter: () => stepCounter++,
    nextNodeId,
    clauses,
  });
  
  // Clause usage tracking - since we can't reliably determine which clauses were used,
  // just list all available clauses
  const clausesUsed: ClauseUsage[] = clauses.map(clause => ({
    clauseNumber: clause.number,
    clauseText: clause.text,
    usageCount: 0,
    usedAtSteps: [],
  }));
  
  return {
    nodes,
    edges,
    pendingGoals: new Map(),
    executionOrder: nodes.map(n => n.id),
    clausesUsed,
    executionSteps,
    finalAnswer: extractFinalAnswer(root),
  };
}

interface ProcessContext {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  pendingGoalMap: Map<string, string>;
  executionSteps: ExecutionStep[];
  stepCounter: () => number;
  nextNodeId: (isPending?: boolean) => string;
  clauses: Clause[];
}

/**
 * Extract goal functor (predicate name) from a goal string.
 */
function getGoalFunctor(goal: string): string {
  const match = goal.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
  return match ? match[1] : goal;
}

/**
 * Check if a goal matches a pending goal pattern.
 * For exact deduplication, use exact match.
 * For activation, check if the second argument (output variable) matches.
 */
function matchesPendingGoal(goal: string, pendingGoal: string, fuzzy: boolean = false): boolean {
  if (!fuzzy) {
    // Exact match for deduplication
    return goal.replace(/\s+/g, '') === pendingGoal.replace(/\s+/g, '');
  }
  
  // Fuzzy match for activation - check if they have the same functor
  const goalFunctor = getGoalFunctor(goal);
  const pendingFunctor = getGoalFunctor(pendingGoal);
  
  if (goalFunctor !== pendingFunctor) {
    return false;
  }
  
  // For 'is' operator, match on the first argument (the variable being assigned)
  // Format: Variable is Expression
  if (goalFunctor === 'is') {
    const goalVar = goal.match(/^([A-Z][A-Za-z0-9_]*[\u2080-\u2089]*)\s+is/);
    const pendingVar = pendingGoal.match(/^([A-Z][A-Za-z0-9_]*[\u2080-\u2089]*)\s+is/);
    
    if (goalVar && pendingVar) {
      return goalVar[1] === pendingVar[1];
    }
    return false;
  }
  
  // For other predicates, extract the output variable (usually last argument)
  // Try to match the last argument in parentheses
  const goalMatch = goal.match(/,\s*([A-Z][A-Za-z0-9_]*[\u2080-\u2089]*)\s*\)/);
  const pendingMatch = pendingGoal.match(/,\s*([A-Z][A-Za-z0-9_]*[\u2080-\u2089]*)\s*\)/);
  
  if (goalMatch && pendingMatch) {
    return goalMatch[1] === pendingMatch[1];
  }
  
  // Fallback: exact match
  return goal.replace(/\s+/g, '') === pendingGoal.replace(/\s+/g, '');
}

/**
 * Process a tree node and generate visualization nodes/edges.
 */
function processTreeNode(
  node: ExecutionNode,
  parentId: string | null,
  ctx: ProcessContext
): string {
  // Get clause number from node FIRST (set by parser)
  const clauseNumber = node.clauseNumber;
  
  // Create node for this goal
  const nodeId = ctx.nextNodeId();
  
  // Determine node type and label
  let nodeType: VisualizationNode['type'];
  let label: string;
  
  if (node.level === 0) {
    nodeType = 'query';
    // Add space after commas and format with QUERY label and line break
    const formattedGoal = node.goal.replace(/,(?!\s)/g, ', ');
    label = `QUERY<br/>${formattedGoal}`;
  } else if (node.type === 'success') {
    nodeType = 'success';
    label = 'SUCCESS';
  } else {
    nodeType = 'solving';
    // Add space after commas in goal
    const formattedGoal = node.goal.replace(/,(?!\s)/g, ', ');
    // Add clause number to label only for user-defined predicates (not built-ins or compound goals)
    // Check if it's a compound goal (has commas outside parentheses)
    let depth = 0;
    let hasTopLevelComma = false;
    for (const char of node.goal) {
      if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (char === ',' && depth === 0) {
        hasTopLevelComma = true;
        break;
      }
    }
    // User predicates: start with lowercase letter followed by (, and no top-level commas
    const isUserPredicate = /^[a-z_][a-zA-Z0-9_]*\(/.test(node.goal) && !hasTopLevelComma;
    const clauseLabel = (clauseNumber && isUserPredicate) ? ` [clause ${clauseNumber}]` : '';
    label = `Solve: ${formattedGoal}${clauseLabel}`;
  }
  
  const vizNode: VisualizationNode = {
    id: nodeId,
    type: nodeType,
    label,
    emoji: EMOJIS[nodeType],
    level: node.level,
    clauseNumber,
  };
  ctx.nodes.push(vizNode);
  
  // Create edge from parent if exists
  if (parentId) {
    // Determine edge label based on node types
    let edgeLabel = '';
    
    // Find parent node to determine label
    const parentNode = ctx.nodes.find(n => n.id === parentId);
    
    if (parentNode) {
      if (parentNode.type === 'query' && vizNode.type === 'solving') {
        // Query to first solving: show clause number if available
        edgeLabel = clauseNumber ? `clause ${clauseNumber}` : '';
      } else if (parentNode.type === 'query' && vizNode.type === 'success') {
        // Query to success: show clause number if available
        edgeLabel = clauseNumber ? `clause ${clauseNumber}` : '';
      } else if (parentNode.type === 'solved' && vizNode.type === 'solving') {
        // Solved to solving: show clause number if available, otherwise "done"
        edgeLabel = clauseNumber ? `clause ${clauseNumber}` : 'done';
      } else if (parentNode.type === 'solving' && vizNode.type === 'success') {
        // Solving to success: show clause number if available, otherwise "success"
        edgeLabel = clauseNumber ? `clause ${clauseNumber}` : 'success';
      } else if (parentNode.type === 'solving' && vizNode.type === 'solving') {
        // Solving to solving: check if this is a backtrack (alternative branch)
        // Count how many active edges (not queue) already exist from this parent to solving nodes
        const existingActiveEdges = ctx.edges.filter(e => 
          e.from === parentId && e.type === 'active' && 
          ctx.nodes.find(n => n.id === e.to && n.type === 'solving')
        ).length;
        
        if (existingActiveEdges > 0) {
          // This is not the first active edge to a solving node, so it's a backtrack
          edgeLabel = 'backtrack';
        } else {
          // First edge - show clause number if available, otherwise empty
          edgeLabel = clauseNumber ? `clause ${clauseNumber}` : '';
        }
      } else if (parentNode.type === 'solved' && vizNode.type === 'success') {
        // Solved to success: use "all done"
        edgeLabel = 'all done';
      } else {
        // Default: empty label (bindings are shown on solved nodes, not edges)
        edgeLabel = '';
      }
    }
    
    const edge: VisualizationEdge = {
      id: `edge_${ctx.edges.length}`,
      from: parentId,
      to: nodeId,
      type: 'active',
      label: edgeLabel,
      stepNumber: ctx.stepCounter(),
    };
    ctx.edges.push(edge);
    
    ctx.executionSteps.push({
      stepNumber: edge.stepNumber,
      goal: node.goal,
      description: `Solving ${node.goal}`,
      clauseMatched: node.binding,
    });
  }
  
  // Check if this node activates a pending goal (use fuzzy matching)
  // Do this AFTER creating the parent edge so activation comes after "done"
  for (const [pendingGoal, pendingId] of ctx.pendingGoalMap.entries()) {
    if (matchesPendingGoal(node.goal, pendingGoal, true)) {
      const activateEdge: VisualizationEdge = {
        id: `edge_${ctx.edges.length}`,
        from: pendingId,
        to: nodeId,
        type: 'activate',
        label: 'activate',
        stepNumber: ctx.stepCounter(),
      };
      ctx.edges.push(activateEdge);
      ctx.pendingGoalMap.delete(pendingGoal);
      break;
    }
  }
  
  // Handle subgoals (from tabular blocks)
  if (node.subgoals && node.subgoals.length > 0) {
    // First subgoal is being solved (will be in children)
    // Rest are pending
    for (let i = 1; i < node.subgoals.length; i++) {
      const pendingGoal = node.subgoals[i];
      
      // Only create pending node if we haven't seen this goal pattern before
      let alreadyPending = false;
      for (const existing of ctx.pendingGoalMap.keys()) {
        if (matchesPendingGoal(pendingGoal, existing)) {
          alreadyPending = true;
          break;
        }
      }
      
      if (!alreadyPending) {
        const pendingNodeId = ctx.nextNodeId(true); // Mark as pending
        ctx.pendingGoalMap.set(pendingGoal, pendingNodeId);
        
        const pendingNode: VisualizationNode = {
          id: pendingNodeId,
          type: 'pending',
          label: `Pending: ${pendingGoal.replace(/,(?!\s)/g, ', ')}`,
          emoji: EMOJIS.pending,
          level: node.level + 1,
        };
        ctx.nodes.push(pendingNode);
        
        // Queue edge from current node to pending
        const queueEdge: VisualizationEdge = {
          id: `edge_${ctx.edges.length}`,
          from: nodeId,
          to: pendingNodeId,
          type: 'queue',
          label: 'queue',
          stepNumber: ctx.stepCounter(),
        };
        ctx.edges.push(queueEdge);
      }
    }
  }
  
  // Track the last node ID for chaining
  let lastNodeId = nodeId;
  
  // If this node has a binding (and it's not a success node), create a solved node FIRST
  // The solved node goes BETWEEN this solving node and its child
  if (node.binding && node.type !== 'success' && node.level > 0) {
    const solvedId = ctx.nextNodeId();
    // Convert binding from X/value to X = value format
    const formattedBinding = node.binding.replace(/([^/]+)\/(.+)/, '$1 = $2');
    const solvedNode: VisualizationNode = {
      id: solvedId,
      type: 'solved',
      label: `Solved: ${formattedBinding}`,
      emoji: EMOJIS.solved,
      level: node.level,
    };
    ctx.nodes.push(solvedNode);
    
    // Edge from solving node to solved node - just show the binding
    const doneEdge: VisualizationEdge = {
      id: `edge_${ctx.edges.length}`,
      from: nodeId,
      to: solvedId,
      type: 'active',
      label: formattedBinding,
      stepNumber: ctx.stepCounter(),
    };
    ctx.edges.push(doneEdge);
    
    lastNodeId = solvedId;
  }
  
  // Process children
  // If there are multiple children, they represent alternatives (OR branches)
  // The first child is the path taken, subsequent children are backtrack alternatives
  if (node.children.length > 1) {
    // First child is the main execution path
    const mainChildId = processTreeNode(node.children[0], lastNodeId, ctx);
    
    // Subsequent children are alternative branches (backtracking)
    for (let i = 1; i < node.children.length; i++) {
      const altChild = node.children[i];
      // Process alternative branch - it connects to the same parent (lastNodeId)
      // but we need to mark it as a backtrack edge
      const altNodeId = ctx.nextNodeId();
      
      let altLabel: string;
      let altType: VisualizationNode['type'];
      
      // Get clause number from alternative child
      const altClauseNumber = altChild.clauseNumber;
      
      if (altChild.type === 'success') {
        altType = 'success';
        altLabel = 'SUCCESS';
      } else if (altChild.type === 'failure') {
        altType = 'solving';
        altLabel = `Solve: ${altChild.goal.replace(/,(?!\s)/g, ', ')}`;
      } else {
        altType = 'solving';
        const formattedGoal = altChild.goal.replace(/,(?!\s)/g, ', ');
        // Check if it's a compound goal
        let depth = 0;
        let hasTopLevelComma = false;
        for (const char of altChild.goal) {
          if (char === '(' || char === '[') depth++;
          else if (char === ')' || char === ']') depth--;
          else if (char === ',' && depth === 0) {
            hasTopLevelComma = true;
            break;
          }
        }
        const isUserPredicate = /^[a-z_][a-zA-Z0-9_]*\(/.test(altChild.goal) && !hasTopLevelComma;
        const clauseLabel = (altClauseNumber && isUserPredicate) ? ` [clause ${altClauseNumber}]` : '';
        altLabel = `Solve: ${formattedGoal}${clauseLabel}`;
      }
      
      const altVizNode: VisualizationNode = {
        id: altNodeId,
        type: altType,
        label: altLabel,
        emoji: EMOJIS[altType],
        level: altChild.level,
        clauseNumber: altClauseNumber,
      };
      ctx.nodes.push(altVizNode);
      
      // Create backtrack edge
      const backtrackEdge: VisualizationEdge = {
        id: `edge_${ctx.edges.length}`,
        from: lastNodeId,
        to: altNodeId,
        type: 'active',
        label: 'backtrack',
        stepNumber: ctx.stepCounter(),
      };
      ctx.edges.push(backtrackEdge);
      
      ctx.executionSteps.push({
        stepNumber: backtrackEdge.stepNumber,
        goal: altChild.goal,
        description: `Backtracking: ${altChild.goal}`,
      });
      
      // Recursively process the alternative branch's children
      if (altChild.children.length > 0) {
        processAlternativeBranch(altChild, altNodeId, ctx);
      }
    }
    
    return mainChildId;
  } else if (node.children.length === 1) {
    // Single child - sequential execution
    const childId = processTreeNode(node.children[0], lastNodeId, ctx);
    return childId;
  }
  
  return lastNodeId;
}



/**
 * Process an alternative branch (backtracking path).
 * Similar to processTreeNode but doesn't create the root node (already created).
 */
function processAlternativeBranch(
  node: ExecutionNode,
  nodeId: string,
  ctx: ProcessContext
): void {
  // Process children of this alternative branch
  for (const child of node.children) {
    const childId = ctx.nextNodeId();
    
    // Get clause number from child
    const childClauseNumber = child.clauseNumber;
    
    let childLabel: string;
    let childType: VisualizationNode['type'];
    
    if (child.type === 'success') {
      childType = 'success';
      childLabel = 'SUCCESS';
    } else if (child.type === 'failure') {
      childType = 'solving';
      childLabel = `Solve: ${child.goal.replace(/,(?!\s)/g, ', ')}`;
    } else {
      childType = 'solving';
      const clauseLabel = childClauseNumber ? ` [clause ${childClauseNumber}]` : '';
      childLabel = `Solve: ${child.goal.replace(/,(?!\s)/g, ', ')}${clauseLabel}`;
    }
    
    const childVizNode: VisualizationNode = {
      id: childId,
      type: childType,
      label: childLabel,
      emoji: EMOJIS[childType],
      level: child.level,
      clauseNumber: childClauseNumber,
    };
    ctx.nodes.push(childVizNode);
    
    // Create edge - show clause number if available, otherwise empty
    const edgeLabel = childClauseNumber ? `clause ${childClauseNumber}` : '';
    const edge: VisualizationEdge = {
      id: `edge_${ctx.edges.length}`,
      from: nodeId,
      to: childId,
      type: 'active',
      label: edgeLabel,
      stepNumber: ctx.stepCounter(),
    };
    ctx.edges.push(edge);
    
    ctx.executionSteps.push({
      stepNumber: edge.stepNumber,
      goal: child.goal,
      description: `Solving ${child.goal}`,
    });
    
    // Recursively process this child's children
    if (child.children.length > 0) {
      processAlternativeBranch(child, childId, ctx);
    }
  }
}

/**
 * Assigns level-based variable names to avoid confusion in recursive calls.
 */
export function assignLevelVariables(node: ExecutionNode, level: number): void {
  node.level = level;
  
  // Rename variables in the goal if they exist
  if (node.goal) {
    node.goal = renameVariablesWithLevel(node.goal, level);
  }
  
  if (node.binding) {
    node.binding = renameVariablesWithLevel(node.binding, level);
  }
  
  for (const child of node.children) {
    assignLevelVariables(child, level + 1);
  }
}

/**
 * Renames variables in a string to include level suffix.
 */
function renameVariablesWithLevel(text: string, level: number): string {
  // Match Prolog variables (uppercase letter followed by alphanumerics/underscores)
  return text.replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, (match) => {
    // Don't rename if already has level suffix
    if (/_L\d+$/.test(match)) return match;
    return `${match}_L${level}`;
  });
}

/**
 * Extracts the final answer from a successful execution tree.
 */
function extractFinalAnswer(root: ExecutionNode): string | undefined {
  // Extract the query variable from the root goal (e.g., C from t(..., C₀))
  // Match variable name before subscript
  const queryVarMatch = root.goal.match(/,\s*([A-Z][A-Za-z0-9_]*)[\u2080-\u2089]*\s*\)/);
  const queryVar = queryVarMatch ? queryVarMatch[1] : null;
  
  // Find the binding that matches the query variable
  let finalBinding: string | undefined;
  
  function findQueryBinding(node: ExecutionNode): void {
    if (node.binding && queryVar) {
      // Check if this binding is for the query variable (with or without subscript)
      const bindingVarMatch = node.binding.match(/^([A-Z][A-Za-z0-9_]*)[\u2080-\u2089]*/);
      if (bindingVarMatch && bindingVarMatch[1] === queryVar) {
        finalBinding = node.binding;
      }
    }
    for (const child of node.children) {
      findQueryBinding(child);
    }
  }
  
  findQueryBinding(root);
  
  // Convert from X/value to X = value format, and strip subscript from variable name
  if (finalBinding) {
    return finalBinding.replace(/^([A-Z][A-Za-z0-9_]*)[\u2080-\u2089]*\/(.+)/, '$1 = $2');
  }
  
  return undefined;
}

/**
 * Determines the execution order (left-to-right, depth-first).
 */
export function determineExecutionOrder(root: ExecutionNode): string[] {
  const order: string[] = [];
  
  function traverse(node: ExecutionNode): void {
    order.push(node.id);
    for (const child of node.children) {
      traverse(child);
    }
  }
  
  traverse(root);
  return order;
}
