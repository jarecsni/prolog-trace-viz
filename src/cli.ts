import { createError, ErrorCode, ToolError } from './errors.js';

export interface CLIOptions {
  prologFile: string;
  query: string;
  output?: string;
  depth?: number;
  verbose: boolean;
  quiet: boolean;
}

export interface CLIResult {
  type: 'options' | 'help' | 'version' | 'error';
  options?: CLIOptions;
  error?: ToolError;
}

const VERSION = '1.0.0';

const HELP_TEXT = `
prolog-trace-viz - Generate visual trace diagrams for Prolog query execution

USAGE:
  prolog-trace-viz <prolog-file> <query> [options]

ARGUMENTS:
  <prolog-file>    Path to the Prolog source file
  <query>          Prolog query to trace (e.g., "t(1+0+1, X)")

OPTIONS:
  -o, --output <file>   Write output to file instead of stdout
  --depth <n>           Set maximum trace depth for sldnfdraw
  --verbose             Display detailed processing information
  --quiet               Suppress all non-error output except final result
  -h, --help            Show this help message
  -v, --version         Show version number

EXAMPLES:
  prolog-trace-viz program.pl "append([1,2], [3,4], X)"
  prolog-trace-viz program.pl "member(X, [a,b,c])" -o trace.md
  prolog-trace-viz program.pl "factorial(5, X)" --depth 10 --verbose
`.trim();

export function parseArgs(argv: string[]): CLIResult {
  const args = argv.slice(2); // Skip node and script path
  
  // Check for help flag first
  if (args.includes('-h') || args.includes('--help')) {
    return { type: 'help' };
  }
  
  // Check for version flag
  if (args.includes('-v') || args.includes('--version')) {
    return { type: 'version' };
  }
  
  const options: Partial<CLIOptions> = {
    verbose: false,
    quiet: false,
  };
  
  const positionalArgs: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-o' || arg === '--output') {
      const nextArg = args[++i];
      if (!nextArg || nextArg.startsWith('-')) {
        return {
          type: 'error',
          error: createError(ErrorCode.INVALID_ARGS, `${arg} requires a file path argument`),
        };
      }
      options.output = nextArg;
    } else if (arg === '--depth') {
      const nextArg = args[++i];
      if (!nextArg || nextArg.startsWith('-')) {
        return {
          type: 'error',
          error: createError(ErrorCode.INVALID_ARGS, '--depth requires a numeric argument'),
        };
      }
      const depth = parseInt(nextArg, 10);
      if (isNaN(depth) || depth < 1) {
        return {
          type: 'error',
          error: createError(ErrorCode.INVALID_ARGS, `Invalid depth value: ${nextArg}. Must be a positive integer.`),
        };
      }
      options.depth = depth;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--quiet') {
      options.quiet = true;
    } else if (arg.startsWith('-')) {
      return {
        type: 'error',
        error: createError(ErrorCode.INVALID_ARGS, `Unknown option: ${arg}`),
      };
    } else {
      positionalArgs.push(arg);
    }
  }
  
  // Validate required positional arguments
  if (positionalArgs.length < 2) {
    const missing = positionalArgs.length === 0 
      ? 'prolog file and query' 
      : 'query';
    return {
      type: 'error',
      error: createError(
        ErrorCode.INVALID_ARGS,
        `Missing required argument: ${missing}`,
      ),
    };
  }
  
  if (positionalArgs.length > 2) {
    return {
      type: 'error',
      error: createError(
        ErrorCode.INVALID_ARGS,
        `Too many arguments. Expected 2 positional arguments, got ${positionalArgs.length}`,
      ),
    };
  }
  
  // Validate verbose and quiet aren't both set
  if (options.verbose && options.quiet) {
    return {
      type: 'error',
      error: createError(
        ErrorCode.INVALID_ARGS,
        'Cannot use both --verbose and --quiet',
      ),
    };
  }
  
  return {
    type: 'options',
    options: {
      prologFile: positionalArgs[0],
      query: positionalArgs[1],
      output: options.output,
      depth: options.depth,
      verbose: options.verbose!,
      quiet: options.quiet!,
    },
  };
}

export function getHelpText(): string {
  return HELP_TEXT;
}

export function getVersion(): string {
  return VERSION;
}
