#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { readFileSync } from 'fs';

// Read package.json for version
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

// Get git commit hash (short)
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Warning: Could not get git commit hash');
}

// Get git branch
let gitBranch = 'unknown';
try {
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Warning: Could not get git branch');
}

// Generate build timestamp
const buildTimestamp = new Date().toISOString();

// Create build info object
const buildInfo = {
  version: packageJson.version,
  name: packageJson.name,
  description: packageJson.description,
  author: packageJson.author,
  license: packageJson.license,
  buildTimestamp,
  gitCommit,
  gitBranch,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch
};

// Write to TypeScript file
const tsContent = `// This file is auto-generated during build
// Do not edit manually - regenerated on each build

export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)} as const;

export const COPYRIGHT_NOTICE = \`
Prolog Trace Visualiser (ptv) v\${BUILD_INFO.version}
Copyright (c) 2024 Johnny Recsni <johnny@recsni.com>

Licensed under the MIT License.
Built on \${BUILD_INFO.buildTimestamp} from commit \${BUILD_INFO.gitCommit} (\${BUILD_INFO.gitBranch})

This tool generates enhanced visual trace diagrams for Prolog query execution.
For more information, visit: https://github.com/jarecsni/prolog-trace-viz
\`;
`;

writeFileSync('src/build-info.ts', tsContent);
console.log('✅ Generated build info for commit:', gitCommit, 'on branch:', gitBranch);