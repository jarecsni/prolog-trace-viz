import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkDependencies } from './executor.js';

describe('Executor - Property Tests', () => {
  /**
   * **Feature: custom-tracer-integration, Property 10: Dependency independence**
   * **Validates: Requirements 4.1, 4.2**
   * 
   * For any execution, the system should not invoke sldnfdraw or require it to be installed.
   */
  it('Property 10: Dependency independence', async () => {
    // Check dependencies multiple times to ensure consistency
    fc.assert(
      await fc.asyncProperty(
        fc.constant(null), // Dummy arbitrary to make fast-check happy
        async () => {
          const status = await checkDependencies();
          
          // Verify that sldnfdraw is not checked or required
          expect(status).not.toHaveProperty('sldnfdrawInstalled');
          
          // If SWI-Prolog is installed, verify we only check for version
          if (status.swiplInstalled) {
            // Should have version info or no error
            expect(
              status.swiplVersion !== undefined || status.error === undefined
            ).toBe(true);
            
            // If there's an error, it should be about version, not sldnfdraw
            if (status.error) {
              expect(status.error.code).not.toBe('SLDNFDRAW_NOT_INSTALLED');
            }
          }
        }
      ),
      { numRuns: 10 } // Fewer runs since this is checking system state
    );
  });
});
