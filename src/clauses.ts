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
 */
export function parsePrologFile(content: string): Clause[] {
  const clauses: Clause[] = [];
  const lines = content.split('\n');
  let clauseNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('%') || line.length === 0) {
      continue;
    }
    
    // Check if it's a fact or rule
    if (line.includes(':-')) {
      // Rule: head :- body
      const parts = line.split(':-');
      const head = parts[0].trim();
      let body = parts[1].trim();
      
      // Handle multi-line rules
      while (!body.endsWith('.') && i + 1 < lines.length) {
        i++;
        body += ' ' + lines[i].trim();
      }
      
      // Remove trailing period
      body = body.replace(/\.$/, '').trim();
      
      clauses.push({
        number: clauseNumber++,
        head,
        body,
        text: `${head} :- ${body}`,
      });
    } else if (line.endsWith('.')) {
      // Fact
      const head = line.replace(/\.$/, '').trim();
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
 */
export function instrumentPrologCode(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let clauseNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Pass through comments and empty lines
    if (trimmed.startsWith('%') || trimmed.length === 0) {
      result.push(line);
      continue;
    }
    
    // Extract predicate name from clause head
    const predicateMatch = trimmed.match(/^([a-z_][a-zA-Z0-9_]*)\(/);
    if (!predicateMatch) {
      result.push(line);
      continue;
    }
    
    const predicateName = predicateMatch[1];
    
    // Check if it's a rule or fact
    if (trimmed.includes(':-')) {
      // Rule: head :- body
      const parts = trimmed.split(':-');
      const head = parts[0].trim();
      let body = parts[1].trim();
      
      // Handle multi-line rules
      let fullLine = line;
      while (!body.endsWith('.') && i + 1 < lines.length) {
        i++;
        fullLine += '\n' + lines[i];
        body += ' ' + lines[i].trim();
      }
      
      // Remove trailing period from body
      body = body.replace(/\.$/, '').trim();
      
      // Insert clause marker as first goal in body
      const instrumentedBody = `clause_marker(${predicateName}, ${clauseNumber}), ${body}`;
      
      // Reconstruct the clause with proper indentation
      const indent = line.match(/^\s*/)?.[0] || '';
      result.push(`${indent}${head} :- ${instrumentedBody}.`);
      
      clauseNumber++;
    } else if (trimmed.endsWith('.')) {
      // Fact: convert to rule with just the marker
      const head = trimmed.replace(/\.$/, '').trim();
      const indent = line.match(/^\s*/)?.[0] || '';
      result.push(`${indent}${head} :- clause_marker(${predicateName}, ${clauseNumber}).`);
      
      clauseNumber++;
    } else {
      // Not a complete clause yet, pass through
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
