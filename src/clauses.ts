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

/**
 * Instruments Prolog code by adding clause_marker/2 calls to track which clauses are used.
 * Each clause gets a marker as the first goal in its body.
 * Uses the same filtering logic as parsePrologFile to ensure clause numbers match.
 */
export function instrumentPrologCode(content: string): string {
  // First, parse to get the filtered clauses with their numbers
  const clauses = parsePrologFile(content);
  
  // Create a map of clause text to clause number
  const clauseMap = new Map<string, number>();
  for (const clause of clauses) {
    clauseMap.set(clause.text, clause.number);
  }
  
  // Now instrument the original content, but only add markers to clauses in our map
  const lines = content.split('\n');
  const result: string[] = [];
  let inBlockComment = false;
  let currentStatement = '';
  let currentStatementStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Handle block comments
    if (trimmed.includes('/*')) {
      inBlockComment = true;
    }
    if (inBlockComment) {
      result.push(line);
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }
    
    // Pass through comments, empty lines, and directives as-is
    if (trimmed.startsWith('%') || trimmed.length === 0 || trimmed.startsWith(':-')) {
      result.push(line);
      continue;
    }
    
    // Accumulate lines until we hit a period
    if (!currentStatement) {
      currentStatementStartLine = i;
      currentStatement = trimmed;
    } else {
      currentStatement += ' ' + trimmed;
    }
    
    // If line ends with period, we have a complete statement
    if (trimmed.endsWith('.')) {
      // Check if this statement is in our clause map
      const statementWithoutPeriod = currentStatement.replace(/\.$/, '').trim();
      
      // Try to match as-is first
      let clauseNumber = clauseMap.get(statementWithoutPeriod);
      
      // If not found, try matching with normalized spacing
      if (!clauseNumber) {
        for (const [clauseText, num] of clauseMap.entries()) {
          if (clauseText.replace(/\s+/g, ' ') === statementWithoutPeriod.replace(/\s+/g, ' ')) {
            clauseNumber = num;
            break;
          }
        }
      }
      
      if (clauseNumber) {
        // This is a clause we want to instrument
        const predicateMatch = currentStatement.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
        const predicateName = predicateMatch ? predicateMatch[1] : 'unknown';
        
        if (currentStatement.includes(':-') && !currentStatement.startsWith(':-')) {
          // Rule: add marker to body
          const parts = currentStatement.split(':-');
          const head = parts[0].trim();
          const bodyWithPeriod = parts.slice(1).join(':-').trim();
          const body = bodyWithPeriod.replace(/\.$/, '').trim();
          
          const instrumentedBody = `clause_marker(${predicateName}, ${clauseNumber}), ${body}`;
          const indent = lines[currentStatementStartLine].match(/^\s*/)?.[0] || '';
          result.push(`${indent}${head} :- ${instrumentedBody}.`);
        } else {
          // Fact: convert to rule with marker
          const head = currentStatement.replace(/\.$/, '').trim();
          const indent = lines[currentStatementStartLine].match(/^\s*/)?.[0] || '';
          result.push(`${indent}${head} :- clause_marker(${predicateName}, ${clauseNumber}).`);
        }
      } else {
        // Not a clause we're tracking, pass through as-is
        result.push(line);
      }
      
      currentStatement = '';
    } else if (currentStatement) {
      // Multi-line statement in progress, don't output this line yet
      // (it will be output when we complete the statement)
    } else {
      // Shouldn't reach here, but pass through just in case
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * Matches a binding to a clause - returns null since we can't reliably determine
 * which clause was used without proper unification.
 */
export function matchBindingToClause(
  binding: string,
  goal: string,
  clauses: Clause[]
): { clause: Clause; substitution: string } | null {
  // Without proper Prolog unification, we can't reliably match bindings to clauses
  // Return null to indicate we don't know which clause was used
  return null;
}

/**
 * Determines which clause was used - returns null since sldnfdraw doesn't provide
 * clause information and we can't reliably infer it without proper unification.
 */
export function inferClauseFromGoal(
  goal: string,
  hasBinding: boolean,
  binding: string | undefined,
  clauses: Clause[]
): { clause: Clause; substitution: string } | null {
  // sldnfdraw doesn't provide clause numbers in its output
  // Without proper Prolog unification, we can't reliably determine which clause matched
  // Return null to indicate we don't have this information
  return null;
}
