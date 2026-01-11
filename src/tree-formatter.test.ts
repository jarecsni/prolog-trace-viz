import { describe, it, expect } from 'vitest';
import { formatTreeAsMermaid, TreeFormatterOptions } from './tree-formatter.js';
import { TreeNode } from './tree.js';

describe('Tree Formatter', () => {
  // Helper to create a minimal tree node
  function createNode(overrides: Partial<TreeNode> = {}): TreeNode {
    return {
      id: 'A',
      goal: 't(1+0+1,_1234)',
      callStep: 1,
      status: 'success',
      children: [],
      clauseHead: 't(X+0+1, X+1+0)',
      clauseNumber: 27,
      ...overrides,
    };
  }

  describe('pattern output display', () => {
    it('shows full pattern X+1+0 instead of ellipsis in result', () => {
      const node = createNode({
        goal: 't(1+0+1,_1234)',
        clauseHead: 't(X+0+1, X+1+0)',
        finalBinding: '_1234=1+1+0',
      });

      const output = formatTreeAsMermaid(node, { showInternalVars: false });
      
      // Should show full pattern X+1+0, not X+... ellipsis
      expect(output).toContain('X+1+0=1+1+0');
      // Should NOT contain ellipsis
      expect(output).not.toContain('X+...');
    });

    it('shows simple variable Z when clause has simple output variable', () => {
      const node = createNode({
        goal: 't(1+0+1+1+1,_2008)',
        clauseHead: 't(X+1+1, Z)',
        clauseNumber: 28,
        finalBinding: '_2008=1+1+1+1+0',
      });

      const output = formatTreeAsMermaid(node, { showInternalVars: false });
      
      // Should use Z instead of internal variable
      expect(output).toContain('Z=1+1+1+1+0');
    });

    it('shows internal variable when showInternalVars is true', () => {
      const node = createNode({
        goal: 't(1+0+1,_1234)',
        clauseHead: 't(X+0+1, X+1+0)',
        finalBinding: '_1234=1+1+0',
      });

      const output = formatTreeAsMermaid(node, { showInternalVars: true });
      
      // Should show internal variable name
      expect(output).toContain('_1234=1+1+0');
    });
  });

  describe('tree structure', () => {
    it('generates valid mermaid graph structure', () => {
      const node = createNode();
      const output = formatTreeAsMermaid(node);
      
      expect(output).toContain('graph TD');
      expect(output).toContain('%% Nodes');
      expect(output).toContain('%% Edges');
      expect(output).toContain('%% Styles');
    });

    it('handles null root gracefully', () => {
      const output = formatTreeAsMermaid(null);
      
      expect(output).toContain('No execution tree');
    });

    it('generates edges for child nodes', () => {
      const child = createNode({
        id: 'B',
        goal: 't(1+0+1,_5678)',
        callStep: 2,
      });

      const parent = createNode({
        id: 'A',
        goal: 't(1+0+1+1,_1234)',
        callStep: 1,
        children: [child],
        subgoals: [{ label: '[1.1]', goal: 't(X+1, X1)' }],
      });

      const output = formatTreeAsMermaid(parent);
      
      // Should have edge from parent to child
      expect(output).toContain('A -->');
      expect(output).toContain('B');
    });
  });

  describe('node styling', () => {
    it('applies root style to first node', () => {
      const node = createNode();
      const output = formatTreeAsMermaid(node);
      
      // Root should have blue styling
      expect(output).toContain('style A fill:#e1f5ff');
    });

    it('applies success style to successful child nodes', () => {
      const child = createNode({
        id: 'B',
        status: 'success',
      });

      const parent = createNode({
        children: [child],
        subgoals: [{ label: '[1.1]', goal: 't(X+1, X1)' }],
      });

      const output = formatTreeAsMermaid(parent);
      
      // Child should have green success styling
      expect(output).toContain('style B fill:#c8e6c9');
    });

    it('applies failure style to failed nodes', () => {
      const child = createNode({
        id: 'B',
        status: 'failure',
      });

      const parent = createNode({
        children: [child],
        subgoals: [{ label: '[1.1]', goal: 't(X+1, X1)' }],
      });

      const output = formatTreeAsMermaid(parent);
      
      // Failed node should have red styling
      expect(output).toContain('style B fill:#ffcdd2');
    });
  });
});
