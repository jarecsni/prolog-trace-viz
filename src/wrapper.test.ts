import { describe, it, expect } from 'vitest';
import { generateWrapper, parseWrapper, WrapperConfig } from './wrapper.js';

describe('Wrapper Generator - Unit Tests', () => {
  describe('generateWrapper', () => {
    it('should generate wrapper with tracer loading', () => {
      const config: WrapperConfig = {
        prologContent: 'factorial(0, 1).',
        query: 'factorial(3, X)',
        tracerPath: '/path/to/tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain(":- ['/path/to/tracer.pl'].");
    });

    it('should include user Prolog content without instrumentation', () => {
      const config: WrapperConfig = {
        prologContent: 'factorial(0, 1).\nfactorial(N, F) :- N > 0.',
        query: 'factorial(3, X)',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain('factorial(0, 1).');
      expect(wrapper).toContain('factorial(N, F) :- N > 0.');
      expect(wrapper).not.toContain('trace_call');
      expect(wrapper).not.toContain('clause_marker');
    });

    it('should include query in catch block', () => {
      const config: WrapperConfig = {
        prologContent: 'test(X).',
        query: 'test(Y)',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain('catch(');
      expect(wrapper).toContain('test(Y)');
      expect(wrapper).toContain("export_trace_json('trace.json')");
    });

    it('should include tracer lifecycle calls', () => {
      const config: WrapperConfig = {
        prologContent: 'test.',
        query: 'test',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain('install_tracer');
      expect(wrapper).toContain('remove_tracer');
    });

    it('should include error handling', () => {
      const config: WrapperConfig = {
        prologContent: 'test.',
        query: 'test',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain('catch(');
      expect(wrapper).toContain('Error');
      expect(wrapper).toContain("format('Error: ~w~n', [Error])");
    });

    it('should include execution directives', () => {
      const config: WrapperConfig = {
        prologContent: 'test.',
        query: 'test',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain(':- run_trace.');
      expect(wrapper).toContain(':- halt.');
    });

    it('should handle queries with commas', () => {
      const config: WrapperConfig = {
        prologContent: 'test(X, Y).',
        query: 'test(1, 2), test(3, 4)',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain('test(1, 2), test(3, 4)');
    });

    it('should handle empty Prolog content', () => {
      const config: WrapperConfig = {
        prologContent: '',
        query: 'true',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain('install_tracer');
      expect(wrapper).toContain('true');
    });
  });

  describe('parseWrapper', () => {
    it('should parse valid wrapper back to config', () => {
      const original: WrapperConfig = {
        prologContent: 'factorial(0, 1).',
        query: 'factorial(3, X)',
        tracerPath: '/path/to/tracer.pl',
      };

      const wrapper = generateWrapper(original);
      const parsed = parseWrapper(wrapper);

      expect(parsed).not.toBeNull();
      expect(parsed!.prologContent).toBe(original.prologContent);
      expect(parsed!.query).toBe(original.query);
      expect(parsed!.tracerPath).toBe(original.tracerPath);
    });

    it('should handle multi-line Prolog content', () => {
      const original: WrapperConfig = {
        prologContent: 'factorial(0, 1).\nfactorial(N, F) :- N > 0, N1 is N - 1.',
        query: 'factorial(5, X)',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(original);
      const parsed = parseWrapper(wrapper);

      expect(parsed).not.toBeNull();
      expect(parsed!.prologContent).toBe(original.prologContent);
    });

    it('should handle queries with commas', () => {
      const original: WrapperConfig = {
        prologContent: 'test(X).',
        query: 'test(1), test(2), test(3)',
        tracerPath: 'tracer.pl',
      };

      const wrapper = generateWrapper(original);
      const parsed = parseWrapper(wrapper);

      expect(parsed).not.toBeNull();
      expect(parsed!.query).toBe(original.query);
    });

    it('should return null for invalid wrapper format', () => {
      const invalidWrapper = 'This is not a valid wrapper';
      const parsed = parseWrapper(invalidWrapper);

      expect(parsed).toBeNull();
    });

    it('should return null for wrapper missing tracer path', () => {
      const invalidWrapper = `
% User's Prolog code (no instrumentation)
test.

% Run trace with error handling
run_trace :-
    install_tracer.
`;
      const parsed = parseWrapper(invalidWrapper);

      expect(parsed).toBeNull();
    });
  });

  describe('tracer path resolution', () => {
    it('should handle absolute tracer paths', () => {
      const config: WrapperConfig = {
        prologContent: 'test.',
        query: 'test',
        tracerPath: '/absolute/path/to/tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain(":- ['/absolute/path/to/tracer.pl'].");
    });

    it('should handle relative tracer paths', () => {
      const config: WrapperConfig = {
        prologContent: 'test.',
        query: 'test',
        tracerPath: './tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain(":- ['./tracer.pl'].");
    });

    it('should handle parent directory tracer paths', () => {
      const config: WrapperConfig = {
        prologContent: 'test.',
        query: 'test',
        tracerPath: '../tracer.pl',
      };

      const wrapper = generateWrapper(config);

      expect(wrapper).toContain(":- ['../tracer.pl'].");
    });
  });
});
