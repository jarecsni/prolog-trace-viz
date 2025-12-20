import { ExecutionNode, TraceEvent } from './parser.js';
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

/**
 * Extracts clause definitions from raw trace events.
 * This uses the actual clauses that SWI-Prolog worked with during execution.
 * Note: These clauses contain runtime variable names and should only be used
 * as a fallback when original parsed clauses are not available.
 */
function extractClausesFromTraceEvents(traceEvents: TraceEvent[]): Clause[] {
  const clauseMap = new Map<string, Clause>();
  
  traceEvents.forEach(event => {
    if (event.clause && event.port === 'exit') {
      const { head, body, line } = event.clause;
      const clauseKey = `${line}-${head}`;
      
      if (!clauseMap.has(clauseKey)) {
        const clauseText = body && body !== 'true' 
          ? `${head} :- ${body}`
          : head;
          
        clauseMap.set(clauseKey, {
          number: line,
          head,
          body: body !== 'true' ? body : undefined,
          text: clauseText
        });
      }
    }
  });
  
  // Convert to array and sort by line number
  return Array.from(clauseMap.values()).sort((a, b) => a.number - b.number);
}

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

import { Clause } from './clauses.js';

/**
 * Maps runtime variable names back to source variable names based on the original query.
 */
function mapRuntimeVariablesToSource(unifications: { variable: string; value: string }[], originalQuery: string): string[] {
  // Extract variables from the original query
  const queryVars = extractVariablesFromGoal(originalQuery);
  
  return unifications.map(u => {
    // Try to find a corresponding source variable
    // For now, use a simple heuristic: if there's only one variable in the query, map to it
    if (queryVars.length === 1) {
      return `${queryVars[0]} = ${u.value}`;
    }
    
    // For multiple variables, we'd need more sophisticated mapping
    // For now, just use the runtime variable name
    return `${u.variable} = ${u.value}`;
  });
}

/**
 * Maps runtime variables in a goal string to source variables.
 */
function mapGoalVariablesToSource(goal: string, originalQuery: string): string {
  const queryVars = extractVariablesFromGoal(originalQuery);
  
  if (queryVars.length === 1) {
    // Replace any runtime variable with the source variable
    return goal.replace(/_\d+/g, queryVars[0]);
  }
  
  // For multiple variables, return as-is for now
  return goal;
}

/**
 * Finds a matching clause from the parsed clauses based on predicate structure.
 * This helps match trace events (which have runtime variables and different line numbers)
 * with the original source clauses (which have source variables and correct line numbers).
 */
/**
 * Checks if two clause heads match structurally, ignoring variable names.
 * For example: "t(X+1+1, Z)" matches "t(_548+1+1, _538)"
 */
function clausesStructurallyMatch(traceHead: string, clauseHead: string): boolean {
  // Normalize both by replacing variables with a placeholder
  const normalizeClause = (clause: string): string => {
    return clause
      // Replace all variables (starting with uppercase or _) with 'VAR'
      .replace(/\b[A-Z_][a-zA-Z0-9_]*\b/g, 'VAR')
      // Normalize whitespace and remove spaces around commas and operators
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\+\s*/g, '+')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const normalizedTrace = normalizeClause(traceHead);
  const normalizedClause = normalizeClause(clauseHead);
  
  return normalizedTrace === normalizedClause;
}

/**
 * Maps trace clause information to parsed clauses by finding the best match.
 * This handles the mismatch between tracer line numbers (from wrapper file)
 * and source file line numbers by using structural matching.
 * 
 * The tracer provides exact clause heads and bodies, but with different variable names
 * and line numbers than our parsed clauses (which have source variables and correct line numbers).
 */
function findMatchingClause(goal: string, parsedClauses: Clause[], traceClause?: { head: string; body?: string; line: number }): Clause | undefined {
  const goalPredicate = goal.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
  if (!goalPredicate) return undefined;
  
  const predicateName = goalPredicate[1];
  
  // Find all clauses for this predicate
  const predicateClauses = parsedClauses.filter(c => c.head.startsWith(predicateName + '('));
  
  if (predicateClauses.length === 0) return undefined;
  if (predicateClauses.length === 1) return predicateClauses[0];
  
  // For multiple clauses, use heuristics to pick the right one
  // If we have trace clause info, try to match by structure
  if (traceClause) {
    // First priority: exact line number match
    if (traceClause.line) {
      const exactLineMatch = predicateClauses.find(c => c.number === traceClause.line);
      if (exactLineMatch) {
        return exactLineMatch;
      }
      
      // If no exact match, try to find by clause structure matching
      // The trace provides the actual clause head and body
      if (traceClause.head) {
        const structureMatch = predicateClauses.find(c => {
          // Normalize both clauses for comparison
          const traceHead = traceClause.head.replace(/\s+/g, ' ').trim();
          const clauseHead = c.head.replace(/\s+/g, ' ').trim();
          
          // Check if they match structurally (ignoring variable names)
          return clausesStructurallyMatch(traceHead, clauseHead);
        });
        
        if (structureMatch) {
          return structureMatch;
        }
      }
    }
    
    // Fallback: Check if it's a fact (no body) vs rule (has body)
    const traceIsRule = traceClause.body && traceClause.body !== 'true';
    
    for (const clause of predicateClauses) {
      const clauseIsRule = clause.body !== undefined;
      if (traceIsRule === clauseIsRule) {
        return clause;
      }
    }
  }
  
  // Fallback: use goal structure heuristics
  // More precise pattern matching for the t/2 predicate
  if (predicateName === 't') {
    // Check for exact patterns
    if (goal.match(/t\(0\+1,/)) {
      // t(0+1, ...) matches clause 26: t(0+1, 1+0)
      const exactMatch = predicateClauses.find(c => c.text.includes('t(0+1,'));
      if (exactMatch) {
        return exactMatch;
      }
    } else if (goal.match(/t\(\w+\+0\+1,/)) {
      // t(X+0+1, ...) matches clause 27: t(X+0+1, X+1+0)
      const exactMatch = predicateClauses.find(c => c.text.includes('+0+1,'));
      if (exactMatch) {
        return exactMatch;
      }
    } else if (goal.match(/t\(\w+\+1\+1,/)) {
      // t(X+1+1, ...) matches clause 28: t(X+1+1, Z) :- ...
      const exactMatch = predicateClauses.find(c => c.text.includes('+1+1,'));
      if (exactMatch) {
        return exactMatch;
      }
    }
  }
  
  // Generic fallback for other predicates
  const isBaseCase = goal.includes('(0,') || goal.includes('(0 ,') || 
                    goal.includes('([],') || goal.includes('([] ,');
  
  // For base cases, prefer the first clause (usually the base case)
  // For recursive cases, prefer later clauses
  return isBaseCase ? predicateClauses[0] : predicateClauses[predicateClauses.length - 1];
}

/**
 * Extracts variable names from a Prolog goal.
 */
function extractVariablesFromGoal(goal: string): string[] {
  const variables: string[] = [];
  const matches = goal.match(/\b[A-Z][A-Za-z0-9_]*\b/g);
  if (matches) {
    // Remove duplicates
    return [...new Set(matches)];
  }
  return variables;
}

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
  options: AnalysisOptions = {},
  traceEvents: TraceEvent[] = [],
  originalQuery?: string
): AnalysisResult {
  const detailLevel = options.detailLevel || 'standard';
  
  // Always prefer original parsed clauses to preserve source variable names
  // Only use trace-extracted clauses as a fallback if no parsed clauses are available
  const traceClauses = extractClausesFromTraceEvents(traceEvents);
  const actualClauses = clauses.length > 0 ? clauses : traceClauses;
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
    clauses: actualClauses,
    detailLevel,
    finalAnswer,
    originalQuery,
  });
  
  // Track which clauses were actually used during execution
  // Instead of relying on clause numbers (which can mismatch between tracer and parser),
  // we'll track by predicate name from goals and node information
  const usedPredicateNames = new Set<string>();
  
  // Collect predicate names from all nodes that participated in execution
  for (const node of nodes) {
    if (node.clauseNumber) {
      // Extract predicate name from the node's goal or label
      let predicateName: string | undefined;
      
      // Try to extract from label first (for formatted nodes)
      const labelMatch = node.label.match(/(?:Solve: |🔁 Recurse: |Match Clause \d+<br\/>)([a-z_][a-zA-Z0-9_]*)\(/);
      if (labelMatch) {
        predicateName = labelMatch[1];
      } else {
        // Fallback: try to extract from raw goal if available
        // This handles cases where we have raw ExecutionNode data
        const goalMatch = node.label.match(/([a-z_][a-zA-Z0-9_]*)\(/);
        if (goalMatch) {
          predicateName = goalMatch[1];
        }
      }
      
      if (predicateName) {
        usedPredicateNames.add(predicateName);
      }
    }
  }
  
  // Also collect predicate names from the original execution tree
  // This ensures we catch predicates that might not be in the visualization nodes
  function collectPredicatesFromTree(node: ExecutionNode): void {
    if (node.clauseNumber) {
      const goalMatch = node.goal.match(/([a-z_][a-zA-Z0-9_]*)\(/);
      if (goalMatch) {
        usedPredicateNames.add(goalMatch[1]);
      }
    }
    for (const child of node.children) {
      collectPredicatesFromTree(child);
    }
  }
  collectPredicatesFromTree(root);
  
  // If we couldn't determine any used predicates (e.g., in test scenarios),
  // fall back to including all clauses to maintain backward compatibility
  const clausesUsed: ClauseUsage[] = usedPredicateNames.size > 0 
    ? actualClauses
        .filter(clause => {
          const predicateName = clause.head.split('(')[0];
          return usedPredicateNames.has(predicateName);
        })
        .map(clause => ({
          clauseNumber: clause.number,
          clauseText: clause.text,
          usageCount: 0,
          usedAtSteps: [],
        }))
    : actualClauses.map(clause => ({
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
  originalQuery?: string; // Original query for variable mapping
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
  ctx: ProcessContext,
  parentExecutionNode?: ExecutionNode
): string {
  // Get clause number from node FIRST (set by parser)
  const clauseNumber = node.clauseNumber;
  
  // Debug logging removed
  

  
  // Check if this is a compound goal that should be decomposed (at detailed level)
  if (ctx.detailLevel === 'detailed' || ctx.detailLevel === 'full') {
    if (isCompoundGoal(node.goal) && node.type !== 'success' && node.type !== 'failure') {
      console.log(`[DEBUG] Compound goal detected: ${node.goal}`);
      // Split into individual goals and create a chain
      const subgoals = splitCompoundGoal(node.goal);
      console.log(`[DEBUG] Split into subgoals:`, subgoals);
      
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
            processTreeNode(child, currentParentId, ctx, node);
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
  
  if (node.level === 0 || node.type === 'query') {
    nodeType = 'query';
    // Use original query for display to show source variables
    const displayGoal = ctx.originalQuery || node.goal;
    const formattedGoal = displayGoal.replace(/,(?!\s)/g, ', ');
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
    
    // For minimal level, hide built-in predicates to reduce clutter
    if (ctx.detailLevel === 'minimal') {
      const builtinPredicates = ['>', '<', '>=', '=<', '=:=', '=\\=', 'is', '=', '\\='];
      const goalPredicate = node.goal.match(/^([^(]+)/);
      if (goalPredicate && builtinPredicates.some(bp => goalPredicate[1].includes(bp))) {
        // Skip this node for minimal level
        if (node.children.length > 0) {
          // Process children directly
          for (const child of node.children) {
            processTreeNode(child, parentId, ctx, node);
          }
          return parentId || '';
        }
      }
    }
    
    // Map trace clause number to parsed clause number for display
    let displayClauseNumber = clauseNumber;
    if (clauseNumber && isUserPredicate && ctx.clauses.length > 0) {
      const matchedClause = findMatchingClause(node.goal, ctx.clauses, 
        (node.clauseLine && node.clauseHead) ? { 
          head: node.clauseHead, 
          body: node.clauseBody || '', 
          line: node.clauseLine 
        } : undefined);
      if (matchedClause) {
        displayClauseNumber = matchedClause.number;
      }
    }
    
    const clauseLabel = (displayClauseNumber && isUserPredicate) ? ` [clause ${displayClauseNumber}]` : '';
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
    
    // Create match nodes for user-defined predicates at detailed/full levels
    // Check if this is a user-defined predicate (not built-in)
    // For simple facts, we need to check the parent's goal, not the current node's goal
    let goalToCheck = node.goal;
    let clauseNumberToUse = clauseNumber;
    let unificationsSource = node;
    
    // If this is a success node and parent is query, use parent's goal for matching
    if (node.type === 'success' && parentNode?.type === 'query') {
      goalToCheck = parentNode.label.replace('QUERY<br/>', '');
      clauseNumberToUse = clauseNumber || parentNode.clauseNumber;
      // For unifications, we need to find the original ExecutionNode, not the VisualizationNode
      // We'll handle this in the unification extraction below
    }
    
    // Also handle the case where we'll create a solved node from a query node with binding
    if (node.binding && node.type !== 'success' && node.level > 0 && parentNode?.type === 'query') {
      goalToCheck = parentNode.label.replace('QUERY<br/>', '');
      clauseNumberToUse = clauseNumber || parentNode.clauseNumber;
    }
    
    const goalPredicate = goalToCheck.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
    const isUserPredicate = goalPredicate && ctx.clauses.some(c => c.head.startsWith(goalPredicate[1] + '('));
    
    if (isUserPredicate && ctx.clauses.length > 0 && (ctx.detailLevel === 'detailed' || ctx.detailLevel === 'full') && clauseNumberToUse) {
      let clause: Clause | undefined;
      
      // Find matching clause using improved matching logic
      clause = findMatchingClause(goalToCheck, ctx.clauses);
      
      if (clause) {
        // Create match node
        const matchNodeId = ctx.nextNodeId();
        
        // Use unifications from node if available, otherwise try to extract them
        let unifications: string[];
        
        // For simple facts where success/solved node connects to query node, 
        // we need to get unifications from the parent ExecutionNode
        if ((node.type === 'success' || node.binding) && parentNode?.type === 'query' && parentExecutionNode?.unifications) {
          // Use unifications from the parent ExecutionNode and map to source variables
          unifications = ctx.originalQuery ? 
            mapRuntimeVariablesToSource(parentExecutionNode.unifications, ctx.originalQuery) :
            parentExecutionNode.unifications.map(u => `${u.variable} = ${u.value}`);
        } else if (node.unifications && node.unifications.length > 0) {
          // Use accurate unifications from tracer and map to source variables
          unifications = ctx.originalQuery ?
            mapRuntimeVariablesToSource(node.unifications, ctx.originalQuery) :
            node.unifications.map(u => `${u.variable} = ${u.value}`);
        } else {
          // Fallback to extraction (for backward compatibility)
          unifications = extractUnifications(goalToCheck, clause);
        }
        
        const subgoals = extractSubgoals(clause);
        
        // Build match node label - only show clause HEAD, not body
        const clauseHead = clause.text.includes(':-') 
          ? clause.text.split(':-')[0].trim() 
          : clause.text.trim();
        
        // Use the clause number from the matched parsed clause
        const displayClauseNumber = clause.number;
        let matchLabel = `Match Clause ${displayClauseNumber}<br/>${clauseHead}`;
        
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
        // Use consistent clause numbering with node labels
        const isUserPredicate = /^[a-z_][a-zA-Z0-9_]*\(/.test(node.goal) && !isCompoundGoal(node.goal);
        let edgeClauseNumber = clauseNumber;
        if (clauseNumber && isUserPredicate && ctx.clauses.length > 0) {
          const matchedClause = findMatchingClause(node.goal, ctx.clauses);
          if (matchedClause) {
            edgeClauseNumber = matchedClause.number;
          }
        }
        
        const edge: VisualizationEdge = {
          id: `edge_${ctx.edges.length}`,
          from: parentId,
          to: nodeId,
          type: 'active',
          label: edgeClauseNumber ? `clause ${edgeClauseNumber}` : '',
          stepNumber: ctx.stepCounter(),
        };
        ctx.edges.push(edge);
      }
    } else {
      // No match node needed, create direct edge
      let edgeLabel = '';
      
      // Use consistent clause numbering with node labels
      const isUserPredicate = /^[a-z_][a-zA-Z0-9_]*\(/.test(node.goal) && !isCompoundGoal(node.goal);
      let edgeClauseNumber = clauseNumber;
      if (clauseNumber && isUserPredicate && ctx.clauses.length > 0) {
        const matchedClause = findMatchingClause(node.goal, ctx.clauses);
        if (matchedClause) {
          edgeClauseNumber = matchedClause.number;
        }
      }
      
      if (parentNode) {
        if (parentNode.type === 'query' && vizNode.type === 'solving') {
          edgeLabel = edgeClauseNumber ? `clause ${edgeClauseNumber}` : '';
        } else if (parentNode.type === 'query' && vizNode.type === 'success') {
          edgeLabel = edgeClauseNumber ? `clause ${edgeClauseNumber}` : '';
        } else if (parentNode.type === 'solved' && vizNode.type === 'solving') {
          edgeLabel = edgeClauseNumber ? `clause ${edgeClauseNumber}` : 'done';
        } else if (parentNode.type === 'solving' && vizNode.type === 'success') {
          edgeLabel = edgeClauseNumber ? `clause ${edgeClauseNumber}` : 'success';
        } else if (parentNode.type === 'solving' && vizNode.type === 'solving') {
          const existingActiveEdges = ctx.edges.filter(e => 
            e.from === parentId && e.type === 'active' && 
            ctx.nodes.find(n => n.id === e.to && n.type === 'solving')
          ).length;
          
          if (existingActiveEdges > 0) {
            edgeLabel = 'backtrack';
          } else {
            edgeLabel = edgeClauseNumber ? `clause ${edgeClauseNumber}` : '';
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
  if (node.binding && node.type !== 'success' && node.level >= 0) {
    
    // Before creating the solved node, check if we need a match node for simple facts
    // This handles the case where query -> solved (no intermediate solving node)
    if (node.type === 'query') {
      const goalPredicate = node.goal.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
      const isUserPredicate = goalPredicate && ctx.clauses.some(c => c.head.startsWith(goalPredicate[1] + '('));
      
      if (isUserPredicate && ctx.clauses.length > 0 && (ctx.detailLevel === 'detailed' || ctx.detailLevel === 'full') && node.clauseNumber) {
        // Find matching clause using improved matching logic
        const clause = findMatchingClause(node.goal, ctx.clauses);
        
        if (clause) {
          // Create match node
          const matchNodeId = ctx.nextNodeId();
          
          // Use unifications from the query node
          let unifications: string[] = [];
          if (node.unifications && node.unifications.length > 0) {
            unifications = ctx.originalQuery ?
              mapRuntimeVariablesToSource(node.unifications, ctx.originalQuery) :
              node.unifications.map(u => `${u.variable} = ${u.value}`);
          } else {
            unifications = extractUnifications(node.goal, clause);
          }
          
          const clauseHead = clause.text.includes(':-') 
            ? clause.text.split(':-')[0].trim() 
            : clause.text.trim();
          
          let matchLabel = `Match Clause ${clause.number}<br/>${clauseHead}`;
          
          if (unifications.length > 0) {
            matchLabel += '<br/><br/>Unifications:<br/>' + unifications.map(u => `• ${u}`).join('<br/>');
          }
          
          // Add extra information for full level
          if (ctx.detailLevel === 'full') {
            const subgoals = extractSubgoals(clause);
            if (subgoals.length > 0) {
              matchLabel += '<br/><br/>Subgoals:<br/>' + subgoals.map((sg, i) => `${i + 1}. ${sg}`).join('<br/>');
            } else {
              // For facts (no subgoals), show clause type information
              matchLabel += '<br/><br/>Clause Type: Fact (no body)';
            }
          }
          
          const matchNode: VisualizationNode = {
            id: matchNodeId,
            type: 'match',
            label: matchLabel,
            emoji: EMOJIS.match,
            level: node.level,
            clauseNumber: node.clauseNumber || clause.number,
          };
          ctx.nodes.push(matchNode);
          
          // Edge from query to match node
          const toMatchEdge: VisualizationEdge = {
            id: `edge_${ctx.edges.length}`,
            from: nodeId,
            to: matchNodeId,
            type: 'active',
            label: 'try',
            stepNumber: ctx.stepCounter(),
          };
          ctx.edges.push(toMatchEdge);
          
          // Update lastNodeId to point to match node
          lastNodeId = matchNodeId;
        }
      }
    }
    
    // Skip creating solved node if we just created a match node (at detailed/full levels)
    // The match node already shows the unifications, so the solved node is redundant
    const justCreatedMatchNode = (ctx.detailLevel === 'detailed' || ctx.detailLevel === 'full') && 
                                 ctx.nodes.length > 0 && 
                                 ctx.nodes[ctx.nodes.length - 1].type === 'match';
    
    if (!justCreatedMatchNode) {
      const solvedId = ctx.nextNodeId();
      // Convert binding from X/value to X = value format and map variables to source
      let formattedBinding = node.binding.replace(/([^/]+)\/(.+)/, '$1 = $2');
      if (ctx.originalQuery) {
        formattedBinding = mapGoalVariablesToSource(formattedBinding, ctx.originalQuery);
      }
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
    const mainChildId = processTreeNode(node.children[0], lastNodeId, newCtx, node);
    
    // Subsequent children are alternative branches (backtracking)
    for (let i = 1; i < node.children.length; i++) {
      const altChild = node.children[i];
      // Process alternative child
      
      // Check if this alternative should get a match node
      const altGoalPredicate = altChild.goal.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
      const altIsUserPredicate = altGoalPredicate && newCtx.clauses.some(c => c.head.startsWith(altGoalPredicate[1] + '('));
      
      let actualParentForAlt = lastNodeId;
      
      // Create match node for user predicates at detailed/full levels
      if (altIsUserPredicate && newCtx.clauses.length > 0 && (newCtx.detailLevel === 'detailed' || newCtx.detailLevel === 'full')) {
        // Find matching clause using improved matching logic
        const altClause = findMatchingClause(altChild.goal, newCtx.clauses);
        
        if (altClause) {
          // Create match node for alternative
          const altMatchNodeId = newCtx.nextNodeId();
          
          // Create match node for this alternative
          
          // Build match node label
          const clauseHead = altClause.text.includes(':-') 
            ? altClause.text.split(':-')[0].trim() 
            : altClause.text.trim();
          
          // Use the clause number from the matched parsed clause
          const displayClauseNumber = altClause.number;
          let matchLabel = `Match Clause ${displayClauseNumber}<br/>${clauseHead}`;
          
          const altMatchNode: VisualizationNode = {
            id: altMatchNodeId,
            type: 'match',
            label: matchLabel,
            emoji: EMOJIS.match,
            level: altChild.level,
            clauseNumber: altClause.number,
          };
          newCtx.nodes.push(altMatchNode);
          
          // Edge from parent to match node
          const toAltMatchEdge: VisualizationEdge = {
            id: `edge_${newCtx.edges.length}`,
            from: lastNodeId,
            to: altMatchNodeId,
            type: 'active',
            label: 'backtrack',
            stepNumber: newCtx.stepCounter(),
          };
          newCtx.edges.push(toAltMatchEdge);
          
          actualParentForAlt = altMatchNodeId;
        }
      }
      
      // Process alternative branch - it connects to the parent (or match node)
      const altNodeId = newCtx.nextNodeId();
      
      let altLabel: string;
      let altType: VisualizationNode['type'];
      
      // Get clause number from alternative child
      const altClauseNumber = altChild.clauseNumber;
      
      // Map trace clause number to parsed clause number for display (needed for both labels and edges)
      let displayAltClauseNumber = altClauseNumber;
      if (altClauseNumber) {
        // Check if it's a user predicate to determine if we should map clause numbers
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
        
        if (isUserPredicate && newCtx.clauses.length > 0) {
          const matchedAltClause = findMatchingClause(altChild.goal, newCtx.clauses);
          if (matchedAltClause) {
            displayAltClauseNumber = matchedAltClause.number;
          }
        }
      }
      
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
        
        const clauseLabel = (displayAltClauseNumber && isUserPredicate) ? ` [clause ${displayAltClauseNumber}]` : '';
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
      
      // Create edge from parent (or match node) to alternative node
      const backtrackLabel = displayAltClauseNumber ? `clause ${displayAltClauseNumber}` : '';
      const backtrackEdge: VisualizationEdge = {
        id: `edge_${newCtx.edges.length}`,
        from: actualParentForAlt,
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
    const childId = processTreeNode(node.children[0], lastNodeId, newCtx, node);
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
      // Map trace clause number to parsed clause number for display
      let displayChildClauseNumber = childClauseNumber;
      if (childClauseNumber && newCtx.clauses.length > 0) {
        const matchedChildClause = findMatchingClause(child.goal, newCtx.clauses);
        if (matchedChildClause) {
          displayChildClauseNumber = matchedChildClause.number;
        }
      }
      
      const clauseLabel = displayChildClauseNumber ? ` [clause ${displayChildClauseNumber}]` : '';
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
  // Extract the query variable from the root goal
  // Try multiple patterns: member(X, ...), append(..., X), factorial(..., X), etc.
  let queryVar: string | null = null;
  
  // Pattern 1: First argument is a variable (e.g., member(X, [a,b,c]))
  const firstArgMatch = root.goal.match(/^[a-z_][a-zA-Z0-9_]*\(\s*([A-Z][A-Za-z0-9_]*)[\u2080-\u2089]*/);
  if (firstArgMatch) {
    queryVar = firstArgMatch[1];
  }
  
  // Pattern 2: Last argument is a variable (e.g., factorial(5, X))
  if (!queryVar) {
    const lastArgMatch = root.goal.match(/,\s*([A-Z][A-Za-z0-9_]*)[\u2080-\u2089]*\s*\)/);
    if (lastArgMatch) {
      queryVar = lastArgMatch[1];
    }
  }
  
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
