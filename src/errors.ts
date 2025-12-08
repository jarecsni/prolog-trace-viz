export enum ErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PROLOG_NOT_INSTALLED = 'PROLOG_NOT_INSTALLED',
  PROLOG_VERSION_TOO_OLD = 'PROLOG_VERSION_TOO_OLD',
  SLDNFDRAW_NOT_INSTALLED = 'SLDNFDRAW_NOT_INSTALLED',
  INVALID_QUERY = 'INVALID_QUERY',
  PARSE_ERROR = 'PARSE_ERROR',
  IO_ERROR = 'IO_ERROR',
  INVALID_ARGS = 'INVALID_ARGS',
}

export interface ToolError {
  code: ErrorCode;
  message: string;
  details?: string;
  suggestion?: string;
}

const ERROR_MESSAGES: Record<ErrorCode, { message: string; suggestion?: string }> = {
  [ErrorCode.FILE_NOT_FOUND]: {
    message: 'File not found',
    suggestion: 'Check that the file path is correct and the file exists',
  },
  [ErrorCode.PROLOG_NOT_INSTALLED]: {
    message: 'SWI-Prolog is not installed',
    suggestion: 'Install SWI-Prolog from https://www.swi-prolog.org/Download.html',
  },
  [ErrorCode.PROLOG_VERSION_TOO_OLD]: {
    message: 'SWI-Prolog version is too old',
    suggestion: 'Upgrade to SWI-Prolog 7.0 or later from https://www.swi-prolog.org/Download.html',
  },
  [ErrorCode.SLDNFDRAW_NOT_INSTALLED]: {
    message: 'The sldnfdraw pack is not installed',
    suggestion: 'Install it by running: swipl -g "pack_install(sldnfdraw)" -t halt',
  },
  [ErrorCode.INVALID_QUERY]: {
    message: 'Invalid Prolog query syntax',
    suggestion: 'Check your query syntax and ensure it is valid Prolog',
  },
  [ErrorCode.PARSE_ERROR]: {
    message: 'Failed to parse LaTeX output',
    suggestion: 'This may indicate an issue with sldnfdraw output format',
  },
  [ErrorCode.IO_ERROR]: {
    message: 'I/O error occurred',
    suggestion: 'Check file permissions and disk space',
  },
  [ErrorCode.INVALID_ARGS]: {
    message: 'Invalid command-line arguments',
    suggestion: 'Run with --help for usage information',
  },
};

export function createError(code: ErrorCode, details?: string): ToolError {
  const errorInfo = ERROR_MESSAGES[code];
  return {
    code,
    message: errorInfo.message,
    details,
    suggestion: errorInfo.suggestion,
  };
}

export function formatError(error: ToolError): string {
  const lines: string[] = [];
  
  lines.push(`Error: [${error.code}] ${error.message}`);
  
  if (error.details) {
    lines.push(`Details: ${error.details}`);
  }
  
  if (error.suggestion) {
    lines.push(`Suggestion: ${error.suggestion}`);
  }
  
  return lines.join('\n');
}
