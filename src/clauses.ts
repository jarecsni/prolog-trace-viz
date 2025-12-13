/**
 * Module for parsing Prolog clauses and matching them to execution traces.
 */

export interface Clause {
  number: number;
  head: string;
  body?: string;
  text: string;
}

/**
 * Parses a Prolog file and extracts clauses.
 * Filters out directives, comments, and non-predicate statements.
 */
export function parsePrologFile(content: string): Clause[] {
  const clauses: Clause[] = [];
  let inBlockComment = false;
  
  // First pass: remove comments, directives, and join multi-line statements
  const completeStatements: { text: string; lineNumber: number }[] = [];
  const lines = content.split('\n');
  let currentStatement = '';
  let statementStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Handle block comments
    if (trimmed.includes('/*')) {
      inBlockComment = true;
    }
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }
    
    // Skip line comments, empty lines, and directives
    if (trimmed.startsWith('%') || trimmed.length === 0 || trimmed.startsWith(':-')) {
      continue;
    }
    
    // Accumulate lines until we hit a period
    if (currentStatement) {
      currentStatement += ' ' + trimmed;
    } else {
      currentStatement = trimmed;
      statementStartLine = i + 1; // 1-based line numbers
    }
    
    // If line ends with period, we have a complete statement
    if (trimmed.endsWith('.')) {
      completeStatements.push({ text: currentStatement, lineNumber: statementStartLine });
      currentStatement = '';
      statementStartLine = 0;
    }
  }
  
  // Second pass: parse complete statements into clauses
  // Use actual line numbers to match tracer output
  for (const statement of completeStatements) {
    const statementText = statement.text;
    const lineNumber = statement.lineNumber;
    
    // Check if it's a rule (has :- but doesn't start with it)
    if (statementText.includes(':-') && !statementText.startsWith(':-')) {
      const parts = statementText.split(':-');
      const head = parts[0].trim();
      const bodyWithPeriod = parts.slice(1).join(':-').trim();
      const body = bodyWithPeriod.replace(/\.$/, '').trim();
      
      // Add all rules to clauses array (using line numbers for tracer compatibility)
      clauses.push({
        number: lineNumber,
        head,
        body,
        text: `${head} :- ${body}`,
      });
    } else {
      // Fact or other statement
      const head = statementText.replace(/\.$/, '').trim();
      
      // Add all facts to clauses array (using line numbers for tracer compatibility)
      clauses.push({
        number: lineNumber,
        head,
        text: head,
      });
    }
  }
  
  return clauses;
}


