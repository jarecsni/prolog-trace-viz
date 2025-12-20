import { describe, it, expect } from 'vitest';
import { analyzeTree, DetailLevel } from './analyzer.js';
import { ExecutionNode } from './parser.js';
import { Clause } from './clauses.js';

describe('Analyzer Simple Facts', () => {
  // Test case for simple fact matching like t(0+1, A)
  const createSimpleFactTree = (): ExecutionNode => ({
    id: 'root',
    type: 'query',
    goal: 't(0+1, A)',
    level: 0,
    clauseNumber: 30,
    binding: 'A/1+0',
    children: [
      {
        id: 'success1',
        type: 'success',
        goal: 'true',
        level: 1,
        children: []
      }
    ]
  });

  const operatorClauses: Clause[] = [
    {
      number: 30,
      head: 't(0+1, 1+0)',
      text: 't(0+1, 1+0)'
    },
    {
      number: 31,
      head: 't(X+0+1, X+1+0)',
      text: 't(X+0+1, X+1+0)'
    },
    {
      number: 32,
      head: 't(X+1+1, Z)',
      body: 't(X+1, X1), t(X1+1, Z)',
      text: 't(X+1+1, Z) :- t(X+1, X1), t(X1+1, Z)'
    }
  ];

  describe('Simple Fact Matching', () => {
    it('should show clause matching for simple facts at detailed level', () => {
      const tree = createSimpleFactTree();
      
      const detailed = analyzeTree(tree, operatorClauses, { detailLevel: 'detailed' });
      
      // Should have match nodes at detailed level
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Match node should reference the correct clause
      const matchNode = matchNodes[0];
      expect(matchNode.label).toContain('Match Clause 30');
      expect(matchNode.label).toContain('t(0+1, 1+0)');
      expect(matchNode.clauseNumber).toBe(30);
    });

    it('should show clause matching for simple facts at full level', () => {
      const tree = createSimpleFactTree();
      
      const full = analyzeTree(tree, operatorClauses, { detailLevel: 'full' });
      
      // Should have match nodes at full level
      const matchNodes = full.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      // Match node should reference the correct clause
      const matchNode = matchNodes[0];
      expect(matchNode.label).toContain('Match Clause 30');
      expect(matchNode.label).toContain('t(0+1, 1+0)');
      expect(matchNode.clauseNumber).toBe(30);
    });

    it('should NOT show clause matching at minimal level', () => {
      const tree = createSimpleFactTree();
      
      const minimal = analyzeTree(tree, operatorClauses, { detailLevel: 'minimal' });
      
      // Should NOT have match nodes at minimal level
      const matchNodes = minimal.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBe(0);
    });

    it('should NOT show clause matching at standard level', () => {
      const tree = createSimpleFactTree();
      
      const standard = analyzeTree(tree, operatorClauses, { detailLevel: 'standard' });
      
      // Should NOT have match nodes at standard level
      const matchNodes = standard.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBe(0);
    });

    it('should show unification information in match nodes', () => {
      const tree = createSimpleFactTree();
      
      const detailed = analyzeTree(tree, operatorClauses, { detailLevel: 'detailed' });
      
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      const matchNode = matchNodes[0];
      // Should show unification A = 1+0
      expect(matchNode.label).toContain('Unifications');
      expect(matchNode.label).toContain('A = 1+0');
    });
  });

  describe('Detail Level Differences', () => {
    it('should produce different outputs for standard vs full', () => {
      const tree = createSimpleFactTree();
      
      const standard = analyzeTree(tree, operatorClauses, { detailLevel: 'standard' });
      const full = analyzeTree(tree, operatorClauses, { detailLevel: 'full' });

      // Convert to comparable format
      const standardStr = JSON.stringify(standard.nodes.map(n => ({ 
        type: n.type, 
        label: n.label.replace(/\s+/g, ' ').trim() 
      })));
      const fullStr = JSON.stringify(full.nodes.map(n => ({ 
        type: n.type, 
        label: n.label.replace(/\s+/g, ' ').trim() 
      })));
      
      // They should be different
      expect(standardStr).not.toBe(fullStr);
      
      // Full should have at least as many nodes as standard (due to match nodes)
      // Note: Recent optimizations may make them equal in some cases
      expect(full.nodes.length).toBeGreaterThanOrEqual(standard.nodes.length);
    });

    it('should produce different outputs for detailed vs full', () => {
      const tree = createSimpleFactTree();
      
      const detailed = analyzeTree(tree, operatorClauses, { detailLevel: 'detailed' });
      const full = analyzeTree(tree, operatorClauses, { detailLevel: 'full' });

      // Convert to comparable format
      const detailedStr = JSON.stringify(detailed.nodes.map(n => ({ 
        type: n.type, 
        label: n.label.replace(/\s+/g, ' ').trim() 
      })));
      const fullStr = JSON.stringify(full.nodes.map(n => ({ 
        type: n.type, 
        label: n.label.replace(/\s+/g, ' ').trim() 
      })));
      
      // They should be different (even if subtly)
      expect(detailedStr).not.toBe(fullStr);
    });
  });

  describe('Edge Cases', () => {
    it('should handle facts without variables', () => {
      const simpleTree: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 't(0+1, 1+0)',
        level: 0,
        clauseNumber: 30,
        children: [
          {
            id: 'success1',
            type: 'success',
            goal: 'true',
            level: 1,
            children: []
          }
        ]
      };
      
      const detailed = analyzeTree(simpleTree, operatorClauses, { detailLevel: 'detailed' });
      
      // Should still create match nodes
      const matchNodes = detailed.nodes.filter(n => n.type === 'match');
      expect(matchNodes.length).toBeGreaterThan(0);
      
      const matchNode = matchNodes[0];
      expect(matchNode.label).toContain('Match Clause 30');
    });

    it('should handle missing clause information gracefully', () => {
      const treeWithoutClause: ExecutionNode = {
        id: 'root',
        type: 'query',
        goal: 't(0+1, A)',
        level: 0,
        // No clauseNumber
        children: [
          {
            id: 'success1',
            type: 'success',
            goal: 'true',
            level: 1,
            binding: 'A/1+0',
            children: []
          }
        ]
      };
      
      expect(() => {
        analyzeTree(treeWithoutClause, operatorClauses, { detailLevel: 'detailed' });
      }).not.toThrow();
    });
  });
});