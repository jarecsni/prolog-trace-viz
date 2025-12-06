import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createError, ErrorCode, ToolError } from './errors.js';

export interface ExecutionResult {
  latex?: string;  // Legacy field for backward compatibility
  json?: string;   // New field for JSON trace output
  exitCode: number;
  stderr: string;
}

export interface DependencyStatus {
  swiplInstalled: boolean;
  sldnfdrawInstalled: boolean;
  error?: ToolError;
}

/**
 * Checks if SWI-Prolog is installed and accessible.
 */
async function checkSwipl(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('swipl', ['--version']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Checks if sldnfdraw pack is installed.
 */
async function checkSldnfdraw(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('swipl', ['-g', 'use_module(library(sldnfdraw))', '-g', 'halt']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Checks all required dependencies.
 */
export async function checkDependencies(): Promise<DependencyStatus> {
  const swiplInstalled = await checkSwipl();
  
  if (!swiplInstalled) {
    return {
      swiplInstalled: false,
      sldnfdrawInstalled: false,
      error: createError(ErrorCode.PROLOG_NOT_INSTALLED),
    };
  }
  
  const sldnfdrawInstalled = await checkSldnfdraw();
  
  if (!sldnfdrawInstalled) {
    return {
      swiplInstalled: true,
      sldnfdrawInstalled: false,
      error: createError(ErrorCode.SLDNFDRAW_NOT_INSTALLED),
    };
  }
  
  return {
    swiplInstalled: true,
    sldnfdrawInstalled: true,
  };
}

/**
 * Executes sldnfdraw with the given wrapper file and captures the LaTeX output.
 */
export async function executeSldnfdraw(wrapperPath: string): Promise<ExecutionResult> {
  const wrapperDir = path.dirname(wrapperPath);
  const wrapperName = path.basename(wrapperPath, '.pl');
  const texPath = path.join(wrapperDir, `${wrapperName}.tex`);
  
  return new Promise((resolve, reject) => {
    const proc = spawn('swipl', ['-g', `[${wrapperName}]`, '-g', `draw_goal("${wrapperName}.tex")`, '-g', 'halt'], {
      cwd: wrapperDir,
    });
    
    let stderr = '';
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('error', (err) => {
      reject(createError(ErrorCode.PROLOG_NOT_INSTALLED, err.message));
    });
    
    proc.on('close', async (code) => {
      if (code !== 0) {
        resolve({
          latex: '',
          exitCode: code ?? 1,
          stderr,
        });
        return;
      }
      
      // Read the generated .tex file
      try {
        const latex = await fs.readFile(texPath, 'utf-8');
        resolve({
          latex,
          exitCode: 0,
          stderr,
        });
      } catch (err) {
        // .tex file might not exist if sldnfdraw failed silently
        resolve({
          latex: '',
          exitCode: 0,
          stderr: stderr || 'No LaTeX output generated',
        });
      }
    });
  });
}
