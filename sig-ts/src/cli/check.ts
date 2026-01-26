import { resolve, relative } from 'node:path';
import fg from 'fast-glob';
import { checkFile, checkAllSigned } from '../core/verify.js';
import { findProjectRoot } from '../core/config.js';
import type { CheckResult } from '../types.js';

export async function checkCommand(patterns?: string[]): Promise<void> {
  const projectRoot = await findProjectRoot();

  let results: CheckResult[];

  if (!patterns || patterns.length === 0) {
    results = await checkAllSigned(projectRoot);
  } else {
    const files = await resolveFiles(projectRoot, patterns);
    results = [];
    for (const file of files) {
      const relPath = relative(projectRoot, resolve(file));
      results.push(await checkFile(projectRoot, relPath));
    }
  }

  if (results.length === 0) {
    console.log('No signed files found');
    return;
  }

  let hasIssues = false;
  for (const r of results) {
    const icon = r.status === 'signed' ? 'ok' : r.status === 'modified' ? 'MODIFIED' : 'unsigned';
    console.log(`  ${icon}  ${r.file}`);
    if (r.status === 'modified') hasIssues = true;
  }

  if (hasIssues) {
    process.exit(1);
  }
}

async function resolveFiles(projectRoot: string, patterns: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes('*') || pattern.includes('{')) {
      const matched = await fg(pattern, { cwd: projectRoot, absolute: true });
      results.push(...matched);
    } else {
      results.push(resolve(projectRoot, pattern));
    }
  }
  return [...new Set(results)];
}
