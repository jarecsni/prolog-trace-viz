import { ExecutionNode } from './parser.js';

export interface VisualizationNode {
  id: string;
  type: 'query' | 'solving' | 'pending' | 'solved' | 'success' | 'clause-body' | 'match';
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

export type DetailLevel = 'minimal' | 'standard' | 'detailed' | 'full';

export interface AnalysisOptions {
  detailLevel?: DetailLevel;
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
  'clause-body': '📋',
  match: '📦',
};

import { Clause, inferClauseFromGoal } from './clauses.js';

/**
 * Extracts unification details by matching a goal against a clause.
 */
function extractUnifications(goal: string, clause: Clause): string[] {
  const unifications: string[] = [];
  
  // Parse clause head (before :- if it exists)
  const clauseHead = clause.text.includes(':-') 
    ? clause.text.split(':-')[0].trim() 
    : clause.text.trim();
  
  // Extract predicate name and arguments from both goal and clause head
  const goalMatch = goal.match(/^([a-z_][a-zA-Z0-9_]*)\((.*)\)$/);
  const clauseMatch = clauseHead.match(/^([a-z_][a-zA-Z0-9_]*)\((.*)\)$/);
  
  if (!goalMatch || !clauseMatch) {
    return unifications;
  }
  
  const [, goalPred, goalArgsStr] = goalMatch;
  const [, clausePred, clauseArgsStr] = clauseMatch;
  
  if (goalPred !== clausePred) {
    return unifications;
  }
  
  // Parse arguments (simple split by comma, doesn't handle nested structures perfectly)
  const goalArgs = parseArguments(goalArgsStr);
  const clauseArgs = parseArguments(clauseArgsStr);
  
  if (goalArgs.length !== clauseArgs.length) {
    return unifications;
  }
  
  // Match each argument pair
  for (let i = 0; i < goalArgs.length; i++) {
    const goalArg = goalArgs[i].trim();
    const clauseArg = clauseArgs[i].trim();
    
    // If clause arg is a variable (starts with uppercase or _)
    if (/^[A-Z_]/.test(clauseArg)) {
      unifications.push(`${clauseArg} = ${goalArg}`);
    } else if (goalArg !== clauseArg) {
      // If they're different, show the unification
      unifications.push(`${goalArg} = ${clauseArg}`);
    }
  }
  
  return unifications;
}

/**
 * Parse arguments from a comma-separated string, respecting nested structures.
 */
function parseArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of argsStr) {
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      if (char === '(' || char === '[') depth++;
      if (char === ')' || char === ']') depth--;
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

/**
 * Splits a compound goal into individual goals, respecting nested structures.
 * E.g., "3>0, N1 is 3-1" -> ["3>0", "N1 is 3-1"]
 */
function splitCompoundGoal(goal: string): string[] {
  return parseArguments(goal);
}

/**
 * Checks if a goal is a compound goal (contains top-level commas).
 */
function isCompoundGoal(goal: string): boolean {
  let depth = 0;
  for (const char of goal) {
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) return true;
  }
  return false;
}

/**
 * Extracts subgoals from a clause body.
 */
function extractSubgoals(clause: Clause): string[] {
  if (!clause.text.includes(':-')) {
    return [];
  }
  
  const body = clause.text.split(':-')[1].trim();
  return parseArguments(body);
}

/**
 * Analyzes an execution tree and produces visualization data.
 */
export function analyzeTree(
  root: ExecutionNode,
  clauses: Clause[] = [],
  options: AnalysisOptions = {}
): AnalysisResult {
  const detailLevel = options.detailLevel || 'standard';
  const nodes: VisualizationNode[] = [];
  const edges: VisualizationEdge[] = [];
  const pendingGoalMap = new Map<string, string>(); // goal text -> node id
  const executionSteps: ExecutionStep[] = [];
  
  let stepCounter = 1;
  let nodeIdCounter = 0;
  
  // Generate letter-based node IDs (A, B, ..., Z, AA, AB, ...)
  let currentNodeIndex = 0;
  let lastNonPendingIndex = -1;
  const pendingCounters = new Map<number, number>(); // Track pending node count per parent
  
  const indexToId = (index: number): string => {
    if (index < 26) {
      return String.fromCharCode(65 + index); // A-Z
    }
    // For index >= 26, use AA, AB, AC, ..., AZ, BA, BB, ...
    const firstLetter = String.fromCharCode(65 + Math.floor(index / 26) - 1);
    const secondLetter = String.fromCharCode(65 + (index % 26));
    return firstLetter + secondLetter;
  };
  
  const nextNodeId = (isPending: boolean = false) => {
    if (isPending) {
      // Pending nodes use the last non-pending index with incrementing suffixes
      const count = pendingCounters.get(lastNonPendingIndex) || 0;
      pendingCounters.set(lastNonPendingIndex, count + 1);
      return `${indexToId(lastNonPendingIndex)}${count + 2}`; // Start at 2 (B2, B3, B4...)
    } else {
      // Regular nodes advance the index
      const id = indexToId(currentNodeIndex);
      lastNonPendingIndex = currentNodeIndex;
      currentNodeIndex++;
      return id;
    }
  };
  
  // Extract final answer first so we can show it in the success node
  const finalAnswer = extractFinalAnswer(root);
  
  // Process the tree
  processTreeNode(root, null, {
    nodes,
    edges,
    pendingGoalMap,
    executionSteps,
    stepCounter: () => stepCounter++,
    nextNodeId,
    clauses,
    detailLevel,
    finalAnswer,
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
    finalAnswer,
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
  ancestorGoal?: string; // Track parent goal for recursion detection
  detailLevel: DetailLevel;
  finalAnswer?: string; // Final answer to show in success node
}

/**
 * Extract goal functor (predicate name) from a goal string.
 */
function getGoalFunctor(goal: string): string {
  const match = goal.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
  return match ? match[1] : goal;
}

/**
 * Check if a goal is recursive by comparing its functor with an ancestor.
 */
function isRecursiveCall(goal: string, ancestorGoal: string | null): boolean {
  if (!ancestorGoal) return false;
  const goalFunctor = getGoalFunctor(goal);
  const ancestorFunctor = getGoalFunctor(ancestorGoal);
  return goalFunctor === ancestorFunctor && goalFunctor !== '';
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
  
  // Check if this is a compound goal that should be decomposed (at detailed level)
  if (ctx.detailLevel === 'detailed' || ctx.detailLevel === 'full') {
    if (isCompoundGoal(node.goal) && node.type !== 'success' && node.type !== 'failure') {
      // Split into individual goals and create a chain
      const subgoals = splitCompoundGoal(node.goal);
      
      if (subgoals.length > 1) {
        // Create chain of nodes for each subgoal
        let currentParentId = parentId;
        
        for (let i = 0; i < subgoals.length; i++) {
          const subgoalNodeId = ctx.nextNodeId();
          const isLast = i === subgoals.length - 1;
          
          const subgoalNode: VisualizationNode = {
            id: subgoalNodeId,
            type: 'solving',
            label: `Solve: ${subgoals[i]}`,
            emoji: EMOJIS.solving,
            level: node.level,
          };
          ctx.nodes.push(subgoalNode);
          
          // Create edge from parent
          if (currentParentId) {
            const edge: VisualizationEdge = {
              id: `edge_${ctx.edges.length}`,
              from: currentParentId,
              to: subgoalNodeId,
              type: 'active',
              label: i === 0 ? '' : 'next',
              stepNumber: ctx.stepCounter(),
            };
            ctx.edges.push(edge);
          }
          
          currentParentId = subgoalNodeId;
        }
        
        // Process children from the last subgoal node
        if (node.children.length > 0) {
          for (const child of node.children) {
            processTreeNode(child, currentParentId, ctx);
          }
        }
        
        return currentParentId!;
      }
    }
  }
  
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
    // Show SUCCESS with the final answer if available
    if (ctx.finalAnswer) {
      label = `SUCCESS<br/>${ctx.finalAnswer}`;
    } else {
      label = 'SUCCESS';
    }
  } else {
    nodeType = 'solving';
    // Add space after commas in goal
    const formattedGoal = node.goal.replace(/,(?!\s)/g, ', ');
    
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
    
    // Check if this is a recursive call (only show if detail level >= standard)
    const isRecursive = ctx.detailLevel !== 'minimal' && isRecursiveCall(node.goal, ctx.ancestorGoal || null);
    const recursivePrefix = isRecursive ? '🔁 Recurse: ' : 'Solve: ';
    
    const clauseLabel = (clauseNumber && isUserPredicate) ? ` [clause ${clauseNumber}]` : '';
    label = `${recursivePrefix}${formattedGoal}${clauseLabel}`;
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
    // Find parent node to determine if we need a match node
    const parentNode = ctx.nodes.find(n => n.id === parentId);
    
    // Insert match node if we have a clause number and we're at detailed level or higher
    let actualParentId = parentId;
    
    if (clauseNumber && ctx.clauses.length > 0 && (ctx.detailLevel === 'detailed' || ctx.detailLevel === 'full')) {
      const clause = ctx.clauses.find(c => c.number === clauseNumber);
      
      if (clause) {
        // Create match node
        const matchNodeId = ctx.nextNodeId();
        const unifications = extractUnifications(node.goal, clause);
        const subgoals = extractSubgoals(clause);
        
        // Build match node label - only show clause HEAD, not body
        const clauseHead = clause.text.includes(':-') 
          ? clause.text.split(':-')[0].trim() 
          : clause.text.trim();
        
        let matchLabel = `Match Clause ${clauseNumber}<br/>${clauseHead}`;
        
        if (unifications.length > 0) {
          matchLabel += '<br/><br/>Unifications:<br/>' + unifications.map(u => `• ${u}`).join('<br/>');
        }
        
        if (subgoals.length > 0) {
          matchLabel += '<br/><br/>Subgoals (solve left-to-right):<br/>' + subgoals.map((sg, i) => `${i + 1}. ${sg}`).join('<br/>');
        }
        
        const matchNode: VisualizationNode = {
          id: matchNodeId,
          type: 'match',
          label: matchLabel,
          emoji: EMOJIS.match,
          level: node.level,
          clauseNumber,
        };
        ctx.nodes.push(matchNode);
        
        // Edge from parent to match node
        const toMatchEdge: VisualizationEdge = {
          id: `edge_${ctx.edges.length}`,
          from: parentId,
          to: matchNodeId,
          type: 'active',
          label: 'try',
          stepNumber: ctx.stepCounter(),
        };
        ctx.edges.push(toMatchEdge);
        
        // Edge from match node to actual node
        const fromMatchEdge: VisualizationEdge = {
          id: `edge_${ctx.edges.length}`,
          from: matchNodeId,
          to: nodeId,
          type: 'active',
          label: '',
          stepNumber: ctx.stepCounter(),
        };
        ctx.edges.push(fromMatchEdge);
        
        actualParentId = matchNodeId;
      } else {
        // No clause found, create edge without match node
        const edge: VisualizationEdge = {
          id: `edge_${ctx.edges.length}`,
          from: parentId,
          to: nodeId,
          type: 'active',
          label: clauseNumber ? `clause ${clauseNumber}` : '',
          stepNumber: ctx.stepCounter(),
        };
        ctx.edges.push(edge);
      }
    } else {
      // No match node needed, create direct edge
      let edgeLabel = '';
      
      if (parentNode) {
        if (parentNode.type === 'query' && vizNode.type === 'solving') {
          edgeLabel = clauseNumber ? `clause ${clauseNumber}` : '';
        } else if (parentNode.type === 'query' && vizNode.type === 'success') {
          edgeLabel = clauseNumber ? `clause ${clauseNumber}` : '';
        } else if (parentNode.type === 'solved' && vizNode.type === 'solving') {
          edgeLabel = clauseNumber ? `clause ${clauseNumber}` : 'done';
        } else if (parentNode.type === 'solving' && vizNode.type === 'success') {
          edgeLabel = clauseNumber ? `clause ${clauseNumber}` : 'success';
        } else if (parentNode.type === 'solving' && vizNode.type === 'solving') {
          const existingActiveEdges = ctx.edges.filter(e => 
            e.from === parentId && e.type === 'active' && 
            ctx.nodes.find(n => n.id === e.to && n.type === 'solving')
          ).length;
          
          if (existingActiveEdges > 0) {
            edgeLabel = 'backtrack';
          } else {
            edgeLabel = clauseNumber ? `clause ${clauseNumber}` : '';
          }
        } else if (parentNode.type === 'solved' && vizNode.type === 'success') {
          edgeLabel = 'all done';
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
    }
    
    ctx.executionSteps.push({
      stepNumber: ctx.edges[ctx.edges.length - 1].stepNumber,
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
  
  // Track the last node ID for chaining (no clause body nodes - match box shows subgoals)
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
  
  // Update ancestor goal for recursion detection
  // For children, the ancestor is the current node's goal (if it's a user predicate)
  const isUserPredicate = /^[a-z_][a-zA-Z0-9_]*\(/.test(node.goal);
  const newAncestor = isUserPredicate ? node.goal : ctx.ancestorGoal;
  const newCtx = { ...ctx, ancestorGoal: newAncestor };
  
  // Process children
  // If there are multiple children, they represent alternatives (OR branches)
  // The first child is the path taken, subsequent children are backtrack alternatives
  if (node.children.length > 1) {
    // First child is the main execution path
    const mainChildId = processTreeNode(node.children[0], lastNodeId, newCtx);
    
    // Subsequent children are alternative branches (backtracking)
    for (let i = 1; i < node.children.length; i++) {
      const altChild = node.children[i];
      // Process alternative branch - it connects to the same parent (lastNodeId)
      // but we need to mark it as a backtrack edge
      const altNodeId = newCtx.nextNodeId();
      
      let altLabel: string;
      let altType: VisualizationNode['type'];
      
      // Get clause number from alternative child
      const altClauseNumber = altChild.clauseNumber;
      
      if (altChild.type === 'success') {
        altType = 'success';
        if (newCtx.finalAnswer) {
          altLabel = `SUCCESS<br/>${newCtx.finalAnswer}`;
        } else {
          altLabel = 'SUCCESS';
        }
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
        const isRecursive = newCtx.detailLevel !== 'minimal' && isRecursiveCall(altChild.goal, newCtx.ancestorGoal || null);
        const recursivePrefix = isRecursive ? '🔁 Recurse: ' : 'Solve: ';
        const clauseLabel = (altClauseNumber && isUserPredicate) ? ` [clause ${altClauseNumber}]` : '';
        altLabel = `${recursivePrefix}${formattedGoal}${clauseLabel}`;
      }
      
      const altVizNode: VisualizationNode = {
        id: altNodeId,
        type: altType,
        label: altLabel,
        emoji: EMOJIS[altType],
        level: altChild.level,
        clauseNumber: altClauseNumber,
      };
      newCtx.nodes.push(altVizNode);
      
      // Create backtrack edge - show both backtrack and clause number
      const backtrackLabel = altClauseNumber ? `backtrack (clause ${altClauseNumber})` : 'backtrack';
      const backtrackEdge: VisualizationEdge = {
        id: `edge_${newCtx.edges.length}`,
        from: lastNodeId,
        to: altNodeId,
        type: 'active',
        label: backtrackLabel,
        stepNumber: newCtx.stepCounter(),
      };
      newCtx.edges.push(backtrackEdge);
      
      newCtx.executionSteps.push({
        stepNumber: backtrackEdge.stepNumber,
        goal: altChild.goal,
        description: `Backtracking: ${altChild.goal}`,
      });
      
      // Recursively process the alternative branch's children
      if (altChild.children.length > 0) {
        processAlternativeBranch(altChild, altNodeId, newCtx);
      }
    }
    
    return mainChildId;
  } else if (node.children.length === 1) {
    // Single child - sequential execution
    const childId = processTreeNode(node.children[0], lastNodeId, newCtx);
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
  // Update ancestor goal for recursion detection
  const newCtx = { ...ctx, ancestorGoal: node.goal };
  
  // Process children of this alternative branch
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childId = newCtx.nextNodeId();
    
    // Get clause number from child
    const childClauseNumber = child.clauseNumber;
    const isBacktrack = i > 0; // First child is main path, rest are backtracks
    
    let childLabel: string;
    let childType: VisualizationNode['type'];
    
    if (child.type === 'success') {
      childType = 'success';
      if (newCtx.finalAnswer) {
        childLabel = `SUCCESS<br/>${newCtx.finalAnswer}`;
      } else {
        childLabel = 'SUCCESS';
      }
    } else if (child.type === 'failure') {
      childType = 'solving';
      childLabel = `Solve: ${child.goal.replace(/,(?!\s)/g, ', ')}`;
    } else {
      childType = 'solving';
      const isRecursive = newCtx.detailLevel !== 'minimal' && isRecursiveCall(child.goal, newCtx.ancestorGoal || null);
      const recursivePrefix = isRecursive ? '🔁 Recurse: ' : 'Solve: ';
      const clauseLabel = childClauseNumber ? ` [clause ${childClauseNumber}]` : '';
      childLabel = `${recursivePrefix}${child.goal.replace(/,(?!\s)/g, ', ')}${clauseLabel}`;
    }
    
    const childVizNode: VisualizationNode = {
      id: childId,
      type: childType,
      label: childLabel,
      emoji: EMOJIS[childType],
      level: child.level,
      clauseNumber: childClauseNumber,
    };
    newCtx.nodes.push(childVizNode);
    
    // Create edge - show backtrack + clause number for alternatives
    let edgeLabel = '';
    if (isBacktrack && childClauseNumber) {
      edgeLabel = `backtrack (clause ${childClauseNumber})`;
    } else if (childClauseNumber) {
      edgeLabel = `clause ${childClauseNumber}`;
    } else if (isBacktrack) {
      edgeLabel = 'backtrack';
    }
    
    const edge: VisualizationEdge = {
      id: `edge_${newCtx.edges.length}`,
      from: nodeId,
      to: childId,
      type: 'active',
      label: edgeLabel,
      stepNumber: newCtx.stepCounter(),
    };
    newCtx.edges.push(edge);
    
    newCtx.executionSteps.push({
      stepNumber: edge.stepNumber,
      goal: child.goal,
      description: `Solving ${child.goal}`,
    });
    
    // Recursively process this child's children
    if (child.children.length > 0) {
      processAlternativeBranch(child, childId, newCtx);
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
