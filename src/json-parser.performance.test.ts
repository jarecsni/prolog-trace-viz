import { describe, it, expect } from 'vitest';
import { parseTraceJson, benchmarkParser } from './parser.js';

describe('JSON Parser Performance Tests', () => {
  /**
   * Performance test for large trace files
   * Tests parsing speed and memory usage with substantial trace data
   */
  it('handles large trace files efficiently', () => {
    const numEvents = 10000;
    const events = [];
    
    // Generate large trace with nested calls
    for (let i = 0; i < numEvents / 2; i++) {
      events.push({
        port: 'call',
        level: i % 100, // Vary levels to create realistic nesting
        goal: `goal_${i}(X${i})`,
        predicate: `goal_${i}/1`,
      });
    }
    
    // Generate matching exits in reverse order
    for (let i = (numEvents / 2) - 1; i >= 0; i--) {
      events.push({
        port: 'exit',
        level: i % 100,
        goal: `goal_${i}(X${i})`,
        predicate: `goal_${i}/1`,
        arguments: [i],
      });
    }
    
    const json = JSON.stringify(events);
    
    // Measure parsing time
    const startTime = performance.now();
    const tree = parseTraceJson(json);
    const endTime = performance.now();
    
    const parseTime = endTime - startTime;
    
    // Should complete within reasonable time (less than 2 seconds for 10k events)
    expect(parseTime).toBeLessThan(2000);
    
    // Should produce valid tree
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    console.log(`Large trace parsing: ${parseTime.toFixed(2)}ms for ${numEvents} events`);
  });

  /**
   * Benchmark tree building speed with various trace sizes
   */
  it('benchmarks tree building speed across different sizes', () => {
    const sizes = [100, 500, 1000, 2500, 5000];
    const results: { size: number; time: number; eventsPerMs: number }[] = [];
    
    for (const size of sizes) {
      const events = [];
      
      // Generate balanced call/exit sequence
      for (let i = 0; i < size / 2; i++) {
        events.push({
          port: 'call',
          level: i % 20, // Reasonable nesting depth
          goal: `benchmark_${i}(X)`,
          predicate: `benchmark_${i}/1`,
        });
      }
      
      for (let i = (size / 2) - 1; i >= 0; i--) {
        events.push({
          port: 'exit',
          level: i % 20,
          goal: `benchmark_${i}(X)`,
          predicate: `benchmark_${i}/1`,
          arguments: [`result_${i}`],
        });
      }
      
      const json = JSON.stringify(events);
      
      // Warm up
      parseTraceJson(json);
      
      // Measure performance
      const startTime = performance.now();
      const tree = parseTraceJson(json);
      const endTime = performance.now();
      
      const parseTime = endTime - startTime;
      const eventsPerMs = size / parseTime;
      
      results.push({ size, time: parseTime, eventsPerMs });
      
      // Verify correctness
      expect(tree.type).toBe('query');
      expect(tree.children.length).toBeGreaterThan(0);
    }
    
    // Log benchmark results
    console.log('Tree building performance benchmark:');
    results.forEach(result => {
      console.log(`  ${result.size} events: ${result.time.toFixed(2)}ms (${result.eventsPerMs.toFixed(1)} events/ms)`);
    });
    
    // Performance should scale reasonably (not exponentially)
    // Larger traces should still maintain reasonable throughput
    const largestResult = results[results.length - 1];
    expect(largestResult.eventsPerMs).toBeGreaterThan(1); // At least 1 event per millisecond
  });

  /**
   * Test memory usage patterns with deep recursion
   */
  it('manages memory efficiently with deep recursion', () => {
    const depth = 1000;
    const events = [];
    
    // Generate deep recursive sequence
    for (let level = 0; level < depth; level++) {
      events.push({
        port: 'call',
        level,
        goal: `deep_recursive(${depth - level})`,
        predicate: 'deep_recursive/1',
        clause: {
          head: 'deep_recursive(N)',
          body: 'N > 0, N1 is N-1, deep_recursive(N1)',
          line: level + 1,
        },
      });
    }
    
    // Generate matching exits
    for (let level = depth - 1; level >= 0; level--) {
      events.push({
        port: 'exit',
        level,
        goal: `deep_recursive(${depth - level})`,
        predicate: 'deep_recursive/1',
        arguments: [depth - level],
      });
    }
    
    const json = JSON.stringify(events);
    
    // Measure memory before parsing
    const initialMemory = process.memoryUsage();
    
    const startTime = performance.now();
    const tree = parseTraceJson(json);
    const endTime = performance.now();
    
    // Measure memory after parsing
    const finalMemory = process.memoryUsage();
    
    const parseTime = endTime - startTime;
    const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryUsedMB = memoryUsed / (1024 * 1024);
    
    // Should handle deep recursion efficiently
    expect(parseTime).toBeLessThan(1000); // Less than 1 second
    expect(memoryUsedMB).toBeLessThan(50); // Less than 50MB for 1000 levels
    
    // Should produce valid deep tree
    expect(tree.type).toBe('query');
    expect(tree.level).toBe(0);
    
    // Verify tree depth
    function getMaxDepth(node: any): number {
      if (node.children.length === 0) return node.level;
      return Math.max(...node.children.map(getMaxDepth));
    }
    
    const maxDepth = getMaxDepth(tree);
    expect(maxDepth).toBeGreaterThanOrEqual(depth - 1);
    
    console.log(`Deep recursion: ${parseTime.toFixed(2)}ms, ${memoryUsedMB.toFixed(2)}MB for ${depth} levels`);
  });

  /**
   * Test performance with complex unification extraction
   */
  it('handles complex unification extraction efficiently', () => {
    const numGoals = 100; // Reduced for more realistic test
    const events = [];
    
    // Generate main query
    events.push({
      port: 'call',
      level: 0,
      goal: 'main_complex_test(Result)',
      predicate: 'main_complex_test/1',
    });
    
    // Generate goals with complex arguments requiring unification
    for (let i = 0; i < numGoals; i++) {
      const complexArgs = [
        `Var${i}`,
        `[${Array.from({length: 5}, (_, j) => `Item${j}`).join(',')}]`,
        `Value${i}`,
      ];
      
      events.push({
        port: 'call',
        level: 1,
        goal: `complex_goal_${i}(${complexArgs.join(',')})`,
        predicate: `complex_goal_${i}/3`,
      });
      
      events.push({
        port: 'exit',
        level: 1,
        goal: `complex_goal_${i}(${complexArgs.join(',')})`,
        predicate: `complex_goal_${i}/3`,
        arguments: [
          `result_${i}`,
          Array.from({length: 5}, (_, j) => `ProcessedItem${j}`),
          `ProcessedValue${i}`,
        ],
      });
    }
    
    // Complete main query
    events.push({
      port: 'exit',
      level: 0,
      goal: 'main_complex_test(Result)',
      predicate: 'main_complex_test/1',
      arguments: ['completed'],
    });
    
    const json = JSON.stringify(events);
    
    const startTime = performance.now();
    const tree = parseTraceJson(json);
    const endTime = performance.now();
    
    const parseTime = endTime - startTime;
    
    // Should handle complex unifications efficiently
    expect(parseTime).toBeLessThan(1000); // Less than 1 second for complex goals
    
    // Should produce valid tree with unifications
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Verify unifications were extracted
    let totalUnifications = 0;
    function countUnifications(node: any): void {
      if (node.unifications) {
        totalUnifications += node.unifications.length;
      }
      for (const child of node.children) {
        countUnifications(child);
      }
    }
    
    countUnifications(tree);
    expect(totalUnifications).toBeGreaterThan(0);
    
    console.log(`Complex unification: ${parseTime.toFixed(2)}ms for ${numGoals} goals with ${totalUnifications} unifications`);
  });

  /**
   * Test performance with backtracking scenarios
   */
  it('handles backtracking scenarios efficiently', () => {
    const numChoicePoints = 50; // Reduced for more realistic test
    const solutionsPerChoice = 3;
    const events = [];
    
    // Generate main query
    events.push({
      port: 'call',
      level: 0,
      goal: 'main_backtrack_test(Results)',
      predicate: 'main_backtrack_test/1',
    });
    
    // Generate backtracking scenarios with multiple solutions
    for (let i = 0; i < numChoicePoints; i++) {
      events.push({
        port: 'call',
        level: 1,
        goal: `choice_point_${i}(X)`,
        predicate: `choice_point_${i}/1`,
      });
      
      // Generate multiple solutions with redo events
      for (let sol = 0; sol < solutionsPerChoice; sol++) {
        if (sol > 0) {
          events.push({
            port: 'redo',
            level: 1,
            goal: `choice_point_${i}(X)`,
            predicate: `choice_point_${i}/1`,
          });
        }
        
        events.push({
          port: 'exit',
          level: 1,
          goal: `choice_point_${i}(X)`,
          predicate: `choice_point_${i}/1`,
          arguments: [`solution_${i}_${sol}`],
        });
      }
    }
    
    // Complete main query
    events.push({
      port: 'exit',
      level: 0,
      goal: 'main_backtrack_test(Results)',
      predicate: 'main_backtrack_test/1',
      arguments: [Array.from({length: numChoicePoints}, (_, i) => `solution_${i}_2`)],
    });
    
    const json = JSON.stringify(events);
    
    const startTime = performance.now();
    const tree = parseTraceJson(json);
    const endTime = performance.now();
    
    const parseTime = endTime - startTime;
    const totalEvents = events.length;
    
    // Should handle backtracking efficiently
    expect(parseTime).toBeLessThan(1000); // Less than 1 second
    
    // Should produce valid tree
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    // Find choice point children and verify they have final solutions
    let choicePointsFound = 0;
    function findChoicePoints(node: any): void {
      if (node.goal && node.goal.includes('choice_point_')) {
        choicePointsFound++;
        expect(node.unifications).toBeDefined();
        if (node.unifications) {
          const xUnification = node.unifications.find(u => u.variable === 'X');
          expect(xUnification?.value).toMatch(/solution_\d+_2/); // Last solution (index 2)
        }
      }
      for (const child of node.children) {
        findChoicePoints(child);
      }
    }
    
    findChoicePoints(tree);
    expect(choicePointsFound).toBe(numChoicePoints);
    
    console.log(`Backtracking: ${parseTime.toFixed(2)}ms for ${totalEvents} events (${numChoicePoints} choice points)`);
  });

  /**
   * Test performance with error recovery scenarios
   */
  it('handles error recovery efficiently', () => {
    const numErrors = 1000;
    const events = [];
    
    // Generate various error scenarios
    for (let i = 0; i < numErrors; i++) {
      const errorType = i % 4;
      
      switch (errorType) {
        case 0:
          // Unmatched exit event
          events.push({
            port: 'exit',
            level: i % 10,
            goal: `orphan_exit_${i}(X)`,
            predicate: `orphan_exit_${i}/1`,
            arguments: [`value_${i}`],
          });
          break;
          
        case 1:
          // Unmatched fail event
          events.push({
            port: 'fail',
            level: i % 10,
            goal: `orphan_fail_${i}(X)`,
            predicate: `orphan_fail_${i}/1`,
          });
          break;
          
        case 2:
          // Unmatched redo event
          events.push({
            port: 'redo',
            level: i % 10,
            goal: `orphan_redo_${i}(X)`,
            predicate: `orphan_redo_${i}/1`,
          });
          break;
          
        case 3:
          // Normal call-exit pair for comparison
          events.push({
            port: 'call',
            level: i % 10,
            goal: `normal_${i}(X)`,
            predicate: `normal_${i}/1`,
          });
          events.push({
            port: 'exit',
            level: i % 10,
            goal: `normal_${i}(X)`,
            predicate: `normal_${i}/1`,
            arguments: [`result_${i}`],
          });
          break;
      }
    }
    
    const json = JSON.stringify(events);
    
    // Capture warnings to verify error handling
    const originalWarn = console.warn;
    let warningCount = 0;
    console.warn = () => { warningCount++; };
    
    const startTime = performance.now();
    const tree = parseTraceJson(json);
    const endTime = performance.now();
    
    // Restore console
    console.warn = originalWarn;
    
    const parseTime = endTime - startTime;
    
    // Should handle errors efficiently without crashing
    expect(parseTime).toBeLessThan(1000); // Less than 1 second
    
    // Should have generated warnings for error conditions
    expect(warningCount).toBeGreaterThan(0);
    
    // Should produce valid tree despite errors
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    console.log(`Error recovery: ${parseTime.toFixed(2)}ms for ${numErrors} error scenarios (${warningCount} warnings)`);
  });

  /**
   * Stress test with mixed workload
   */
  it('handles mixed workload stress test', () => {
    const events = [];
    let eventId = 0;
    
    // Generate mixed workload: deep recursion + backtracking + errors
    
    // 1. Deep recursion chain
    const recursionDepth = 200;
    for (let level = 0; level < recursionDepth; level++) {
      events.push({
        port: 'call',
        level,
        goal: `recursive_chain(${recursionDepth - level})`,
        predicate: 'recursive_chain/1',
      });
    }
    
    for (let level = recursionDepth - 1; level >= 0; level--) {
      events.push({
        port: 'exit',
        level,
        goal: `recursive_chain(${recursionDepth - level})`,
        predicate: 'recursive_chain/1',
        arguments: [recursionDepth - level],
      });
    }
    
    // 2. Backtracking scenarios
    for (let i = 0; i < 100; i++) {
      events.push({
        port: 'call',
        level: 0,
        goal: `backtrack_${i}(X)`,
        predicate: `backtrack_${i}/1`,
      });
      
      // Multiple solutions
      for (let sol = 0; sol < 3; sol++) {
        if (sol > 0) {
          events.push({
            port: 'redo',
            level: 0,
            goal: `backtrack_${i}(X)`,
            predicate: `backtrack_${i}/1`,
          });
        }
        
        events.push({
          port: 'exit',
          level: 0,
          goal: `backtrack_${i}(X)`,
          predicate: `backtrack_${i}/1`,
          arguments: [`solution_${sol}`],
        });
      }
    }
    
    // 3. Error scenarios
    for (let i = 0; i < 50; i++) {
      events.push({
        port: 'exit',
        level: i % 5,
        goal: `error_${i}(X)`,
        predicate: `error_${i}/1`,
        arguments: [`error_value_${i}`],
      });
    }
    
    // 4. Complex unifications
    for (let i = 0; i < 100; i++) {
      events.push({
        port: 'call',
        level: 1,
        goal: `complex_${i}(Var, [a,b,c], {key: Value})`,
        predicate: `complex_${i}/3`,
      });
      
      events.push({
        port: 'exit',
        level: 1,
        goal: `complex_${i}(Var, [a,b,c], {key: Value})`,
        predicate: `complex_${i}/3`,
        arguments: [`bound_${i}`, ['x', 'y', 'z'], { key: `processed_${i}` }],
      });
    }
    
    const json = JSON.stringify(events);
    const totalEvents = events.length;
    
    // Measure memory before
    const initialMemory = process.memoryUsage();
    
    const startTime = performance.now();
    const tree = parseTraceJson(json);
    const endTime = performance.now();
    
    const finalMemory = process.memoryUsage();
    
    const parseTime = endTime - startTime;
    const memoryUsed = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
    const eventsPerMs = totalEvents / parseTime;
    
    // Should handle mixed workload efficiently
    expect(parseTime).toBeLessThan(3000); // Less than 3 seconds for complex mixed workload
    expect(memoryUsed).toBeLessThan(100); // Less than 100MB
    
    // Should produce valid tree
    expect(tree.type).toBe('query');
    expect(tree.children.length).toBeGreaterThan(0);
    
    console.log(`Mixed workload stress test:`);
    console.log(`  ${totalEvents} events: ${parseTime.toFixed(2)}ms (${eventsPerMs.toFixed(1)} events/ms)`);
    console.log(`  Memory used: ${memoryUsed.toFixed(2)}MB`);
    console.log(`  Tree nodes: ${countNodes(tree)}`);
  });

  /**
   * Comprehensive performance benchmark using the built-in benchmark function
   */
  it('runs comprehensive performance benchmark', () => {
    const events = [];
    
    // Generate a realistic mixed workload
    // 1. Main query
    events.push({
      port: 'call',
      level: 0,
      goal: 'comprehensive_benchmark(Result)',
      predicate: 'comprehensive_benchmark/1',
    });
    
    // 2. Nested recursive calls
    for (let depth = 1; depth <= 50; depth++) {
      events.push({
        port: 'call',
        level: depth,
        goal: `recursive_${depth}(N)`,
        predicate: `recursive_${depth}/1`,
      });
    }
    
    // 3. Complex unification scenarios
    for (let i = 0; i < 100; i++) {
      events.push({
        port: 'call',
        level: 51,
        goal: `complex_unify_${i}(Var${i}, [a,b,c], {key: Value${i}})`,
        predicate: `complex_unify_${i}/3`,
      });
      
      events.push({
        port: 'exit',
        level: 51,
        goal: `complex_unify_${i}(Var${i}, [a,b,c], {key: Value${i}})`,
        predicate: `complex_unify_${i}/3`,
        arguments: [`bound_${i}`, ['x', 'y', 'z'], { key: `processed_${i}` }],
      });
    }
    
    // 4. Backtracking scenarios
    for (let i = 0; i < 20; i++) {
      events.push({
        port: 'call',
        level: 52,
        goal: `backtrack_${i}(X)`,
        predicate: `backtrack_${i}/1`,
      });
      
      // Multiple solutions
      for (let sol = 0; sol < 3; sol++) {
        if (sol > 0) {
          events.push({
            port: 'redo',
            level: 52,
            goal: `backtrack_${i}(X)`,
            predicate: `backtrack_${i}/1`,
          });
        }
        
        events.push({
          port: 'exit',
          level: 52,
          goal: `backtrack_${i}(X)`,
          predicate: `backtrack_${i}/1`,
          arguments: [`solution_${i}_${sol}`],
        });
      }
    }
    
    // 5. Unwind the recursion
    for (let depth = 50; depth >= 1; depth--) {
      events.push({
        port: 'exit',
        level: depth,
        goal: `recursive_${depth}(N)`,
        predicate: `recursive_${depth}/1`,
        arguments: [depth],
      });
    }
    
    // 6. Complete main query
    events.push({
      port: 'exit',
      level: 0,
      goal: 'comprehensive_benchmark(Result)',
      predicate: 'comprehensive_benchmark/1',
      arguments: ['completed'],
    });
    
    const json = JSON.stringify(events);
    
    // Use the imported benchmark function
    
    // Run benchmark
    const result = benchmarkParser(json);
    
    // Verify performance expectations
    expect(result.parseTime).toBeLessThan(100); // Less than 100ms
    expect(result.eventsPerSecond).toBeGreaterThan(1000); // At least 1000 events/sec
    expect(result.memoryUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    expect(result.nodeCount).toBeGreaterThan(0);
    expect(result.maxDepth).toBeGreaterThanOrEqual(52);
    
    console.log('Comprehensive benchmark results:');
    console.log(`  Parse time: ${result.parseTime.toFixed(2)}ms`);
    console.log(`  Events/sec: ${result.eventsPerSecond.toFixed(0)}`);
    console.log(`  Memory used: ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Node count: ${result.nodeCount}`);
    console.log(`  Max depth: ${result.maxDepth}`);
    console.log(`  Total events: ${events.length}`);
  });

  /**
   * Helper function to count total nodes in tree
   */
  function countNodes(node: any): number {
    let count = 1;
    for (const child of node.children) {
      count += countNodes(child);
    }
    return count;
  }
});