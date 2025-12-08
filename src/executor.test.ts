import { describe, it, expect, beforeAll } from 'vitest';
import { checkDependencies, executeTracer } from './executor.js';
import { createTempWrapper } from './wrapper.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

describe('Executor - Unit Tests', () => {
  let tracerPath: string;

  beforeAll(async () => {
    // Get absolute path to tracer.pl in project root
    tracerPath = path.resolve(process.cwd(), 'tracer.pl');
    
    // Verify tracer.pl exists
    try {
      await fs.access(tracerPath);
    } catch {
      throw new Error(`tracer.pl not found at ${tracerPath}`);
    }
  });

  describe('checkDependencies', () => {
    it('should check if SWI-Prolog is installed', async () => {
      const status = await checkDependencies();
      
      expect(status).toHaveProperty('swiplInstalled');
      expect(typeof status.swiplInstalled).toBe('boolean');
    });

    it('should not check for sldnfdraw', async () => {
      const status = await checkDependencies();
      
      expect(status).not.toHaveProperty('sldnfdrawInstalled');
    });

    it('should include version info if SWI-Prolog is installed', async () => {
      const status = await checkDependencies();
      
      if (status.swiplInstalled) {
        // Version might be undefined if we can't parse it, but should be present
        expect(status).toHaveProperty('swiplVersion');
      }
    });

    it('should return error if SWI-Prolog is not installed', async () => {
      const status = await checkDependencies();
      
      if (!status.swiplInstalled) {
        expect(status.error).toBeDefined();
        expect(status.error?.code).toBe('PROLOG_NOT_INSTALLED');
      }
    });

    it('should check SWI-Prolog version requirement', async () => {
      const status = await checkDependencies();
      
      if (status.swiplInstalled && status.swiplVersion) {
        const major = parseInt(status.swiplVersion.split('.')[0]);
        
        if (major < 7) {
          expect(status.error).toBeDefined();
          expect(status.error?.code).toBe('PROLOG_VERSION_TOO_OLD');
        } else {
          expect(status.error).toBeUndefined();
        }
      }
    });
  });

  describe('executeTracer', () => {
    it('should execute successfully with valid Prolog code', async () => {
      const tempWrapper = await createTempWrapper({
        prologContent: 'test(1).\ntest(2).',
        query: 'test(X)',
        tracerPath,
      });

      try {
        const result = await executeTracer(tempWrapper.path);
        
        expect(result.exitCode).toBe(0);
        expect(result.json).toBeTruthy();
        expect(result.json.length).toBeGreaterThan(0);
        
        // Verify it's valid JSON
        expect(() => JSON.parse(result.json)).not.toThrow();
      } finally {
        await tempWrapper.cleanup();
      }
    });

    it('should handle query failure vs execution error', async () => {
      // Query that fails (no solution)
      const tempWrapper = await createTempWrapper({
        prologContent: 'test(1).',
        query: 'test(2)',
        tracerPath,
      });

      try {
        const result = await executeTracer(tempWrapper.path);
        
        // Query failure should still exit with code 0 (execution succeeded)
        expect(result.exitCode).toBe(0);
        // JSON might be empty or contain trace events depending on tracer behavior
        expect(result).toHaveProperty('json');
      } finally {
        await tempWrapper.cleanup();
      }
    });

    it('should handle syntax errors in Prolog code', async () => {
      const tempWrapper = await createTempWrapper({
        prologContent: 'test(X :- invalid syntax.',
        query: 'test(X)',
        tracerPath,
      });

      try {
        const result = await executeTracer(tempWrapper.path);
        
        // Syntax errors are caught by the wrapper's error handling
        // The wrapper completes successfully but may have stderr output
        expect(result).toHaveProperty('exitCode');
        expect(result).toHaveProperty('stderr');
        // Either exit code is non-zero OR stderr contains error info
        expect(
          result.exitCode !== 0 || result.stderr.length > 0
        ).toBe(true);
      } finally {
        await tempWrapper.cleanup();
      }
    });

    it('should return JSON output in result', async () => {
      const tempWrapper = await createTempWrapper({
        prologContent: 'factorial(0, 1).\nfactorial(N, F) :- N > 0.',
        query: 'factorial(0, X)',
        tracerPath,
      });

      try {
        const result = await executeTracer(tempWrapper.path);
        
        expect(result).toHaveProperty('json');
        expect(result).not.toHaveProperty('latex');
        expect(typeof result.json).toBe('string');
      } finally {
        await tempWrapper.cleanup();
      }
    });

    it('should capture stderr output', async () => {
      const tempWrapper = await createTempWrapper({
        prologContent: 'test.',
        query: 'test',
        tracerPath,
      });

      try {
        const result = await executeTracer(tempWrapper.path);
        
        expect(result).toHaveProperty('stderr');
        expect(typeof result.stderr).toBe('string');
      } finally {
        await tempWrapper.cleanup();
      }
    });

    it('should handle empty JSON output gracefully', async () => {
      // Create a wrapper that might produce no trace events
      const tempWrapper = await createTempWrapper({
        prologContent: '',
        query: 'true',
        tracerPath,
      });

      try {
        const result = await executeTracer(tempWrapper.path);
        
        // Should complete successfully even with minimal output
        expect(result.exitCode).toBe(0);
        expect(result).toHaveProperty('json');
      } finally {
        await tempWrapper.cleanup();
      }
    });
  });
});
