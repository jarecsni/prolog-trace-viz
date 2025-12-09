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
  let clauseNumber = 1;
  let inBlockComment = false;
  
  // First pass: remove comments, directives, and join multi-line statements
  const completeStatements: string[] = [];
  const lines = content.split('\n');
  let currentStatement = '';
  
  for (const line of lines) {
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
    }
    
    // If line ends with period, we have a complete statement
    if (trimmed.endsWith('.')) {
      completeStatements.push(currentStatement);
      currentStatement = '';
    }
  }
  
  // Second pass: parse complete statements into clauses
  for (const statement of completeStatements) {
    // Check if it's a rule (has :- but doesn't start with it)
    if (statement.includes(':-') && !statement.startsWith(':-')) {
      const parts = statement.split(':-');
      const head = parts[0].trim();
      const bodyWithPeriod = parts.slice(1).join(':-').trim();
      const body = bodyWithPeriod.replace(/\.$/, '').trim();
      
      // Only process if head looks like a predicate
      if (!/^[a-z_][a-zA-Z0-9_]*\(/.test(head)) {
        continue;
      }
      
      clauses.push({
        number: clauseNumber++,
        head,
        body,
        text: `${head} :- ${body}`,
      });
    } else {
      // Fact
      const head = statement.replace(/\.$/, '').trim();
      
      // Only process if it looks like a predicate
      if (!/^[a-z_][a-zA-Z0-9_]*\(/.test(head)) {
        continue;
      }
      
      clauses.push({
        number: clauseNumber++,
        head,
        text: head,
      });
    }
  }
  
  return clauses;
}


