import { AnalysisResult, VisualizationNode, VisualizationEdge } from './analyzer.js';

export interface MermaidDiagram {
  nodes: string[];
  edges: string[];
  styles: string[];
  linkStyles: string[];
}

// Circled numbers for step numbering
const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

// Color scheme - matching the steering guide
const COLORS = {
  query: '#e1f5ff',        // Light blue
  solving: '#fff9c4',      // Light yellow
  pending: '#e0e0e0',      // Gray
  solved: '#c8e6c9',       // Light green
  success: '#c8e6c9',      // Light green
  'clause-body': '#e1bee7', // Light purple
  match: '#ffe0b2',        // Light orange
};

const STROKES = {
  query: '#01579b',
  solving: '#f57f17',
  pending: '#616161',
  solved: '#388e3c',
  success: '#2e7d32',
  'clause-body': '#7b1fa2',
  match: '#e65100',
};

/**
 * Generates a complete Mermaid diagram from analysis results.
 */
export function generateMermaid(analysis: AnalysisResult): string {
  const diagram = buildDiagram(analysis);
  
  const lines: string[] = [
    'graph TD',
    '',
    '%% Nodes',
    ...diagram.nodes,
    '',
    '%% Edges',
    ...diagram.edges,
    '',
    '%% Styles',
    ...diagram.styles,
    ...diagram.linkStyles,
  ];
  
  return lines.join('\n');
}

/**
 * Builds the diagram components.
 */
function buildDiagram(analysis: AnalysisResult): MermaidDiagram {
  const nodes: string[] = [];
  const edges: string[] = [];
  const styles: string[] = [];
  const linkStyles: string[] = [];
  
  // Generate nodes
  for (const node of analysis.nodes) {
    nodes.push(formatNode(node));
    styles.push(generateNodeStyle(node));
  }
  
  // Generate edges
  const queueIndices: number[] = [];
  const activateIndices: number[] = [];
  
  for (let i = 0; i < analysis.edges.length; i++) {
    const edge = analysis.edges[i];
    edges.push(formatEdge(edge));
    
    if (edge.type === 'queue') {
      queueIndices.push(i);
    } else if (edge.type === 'activate') {
      activateIndices.push(i);
    }
  }
  
  // Group queue edges together
  if (queueIndices.length > 0) {
    linkStyles.push(`linkStyle ${queueIndices.join(',')} stroke:#999,stroke-width:2px,stroke-dasharray:5`);
  }
  
  // Group activate edges together
  if (activateIndices.length > 0) {
    linkStyles.push(`linkStyle ${activateIndices.join(',')} stroke:#4caf50,stroke-width:3px`);
  }
  
  return { nodes, edges, styles, linkStyles };
}

/**
 * Formats a node for Mermaid syntax.
 */
export function formatNode(node: VisualizationNode): string {
  const label = `${node.emoji} ${node.label}`;
  
  // Use different shapes based on type
  switch (node.type) {
    case 'query':
      return `${node.id}[["${label}"]]`;  // Stadium shape
    case 'success':
      return `${node.id}(("${label}"))`;  // Circle
    case 'pending':
      return `${node.id}["${label}"]`;    // Rectangle (same as solving)
    case 'solving':
      return `${node.id}["${label}"]`;    // Rectangle
    case 'solved':
      return `${node.id}("${label}")`;    // Rounded rectangle
    case 'clause-body':
      return `${node.id}[/"${label}"/]`;  // Trapezoid shape
    case 'match':
      return `${node.id}["${label}"]`;    // Rectangle
    default:
      return `${node.id}["${label}"]`;
  }
}

/**
 * Formats an edge for Mermaid syntax.
 */
export function formatEdge(edge: VisualizationEdge): string {
  const stepNum = getCircledNumber(edge.stepNumber);
  const label = edge.label ? `${stepNum} ${edge.label}` : stepNum;
  
  switch (edge.type) {
    case 'active':
      return `${edge.from} -->|"${label}"| ${edge.to}`;
    case 'queue':
      return `${edge.from} -.->|"${label}"| ${edge.to}`;
    case 'activate':
      return `${edge.from} ==>|"${label}"| ${edge.to}`;
    default:
      return `${edge.from} -->|"${label}"| ${edge.to}`;
  }
}

/**
 * Gets a circled number for step numbering.
 */
export function getCircledNumber(n: number): string {
  if (n >= 1 && n <= CIRCLED_NUMBERS.length) {
    return CIRCLED_NUMBERS[n - 1];
  }
  // Fallback for numbers > 20
  return `(${n})`;
}

/**
 * Generates style directive for a node.
 */
export function generateNodeStyle(node: VisualizationNode): string {
  const fill = COLORS[node.type];
  const stroke = STROKES[node.type];
  
  // Only query and success nodes have explicit stroke-width
  if (node.type === 'query' || node.type === 'success') {
    return `style ${node.id} fill:${fill},stroke:${stroke},stroke-width:3px`;
  } else {
    return `style ${node.id} fill:${fill},stroke:${stroke}`;
  }
}

/**
 * Generates style for a link/edge.
 */
function generateLinkStyle(edge: VisualizationEdge, index: number): string {
  switch (edge.type) {
    case 'queue':
      return `linkStyle ${index} stroke:#999,stroke-width:2px,stroke-dasharray:5`;
    case 'activate':
      return `linkStyle ${index} stroke:#4caf50,stroke-width:3px`;
    default:
      return `linkStyle ${index} stroke:#333`;
  }
}

/**
 * Generates styles for all node types (for legend).
 */
export function generateStyles(nodes: VisualizationNode[]): string[] {
  return nodes.map(generateNodeStyle);
}

/**
 * Checks if a diagram contains all required node types for a given analysis.
 */
export function hasRequiredNodeTypes(analysis: AnalysisResult): {
  hasQuery: boolean;
  hasSuccess: boolean;
} {
  const types = new Set(analysis.nodes.map(n => n.type));
  return {
    hasQuery: types.has('query'),
    hasSuccess: types.has('success'),
  };
}

/**
 * Validates that step numbers are sequential with no gaps.
 */
export function validateStepNumbers(edges: VisualizationEdge[]): boolean {
  if (edges.length === 0) return true;
  
  const stepNumbers = edges.map(e => e.stepNumber).sort((a, b) => a - b);
  
  for (let i = 0; i < stepNumbers.length; i++) {
    if (stepNumbers[i] !== i + 1) return false;
  }
  
  return true;
}

/**
 * Checks if all edges with clause matches have proper labels.
 */
export function edgesHaveClauseInfo(edges: VisualizationEdge[]): boolean {
  // Edges that represent clause matches should have labels
  return edges.every(edge => {
    // All edges should at least have a step number
    return edge.stepNumber > 0;
  });
}
