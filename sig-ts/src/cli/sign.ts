import { resolve, relative } from 'node:path';
import fg from 'fast-glob';
import { signFile } from '../core/sign.js';
import { findProjectRoot } from '../core/config.js';

export async function signCommand(
  patterns: string[],
  options: { by?: string; engine?: string }
): Promise<void> {
  const projectRoot = await findProjectRoot();

  const files = await resolveFiles(projectRoot, patterns);
  if (files.length === 0) {
    console.error('No files matched');
    process.exit(1);
  }

  for (const file of files) {
    const relPath = relative(projectRoot, resolve(file));
    const sig = await signFile(projectRoot, relPath, {
      identity: options.by,
      engine: options.engine,
    });
    console.log(`signed ${sig.file} (${sig.hash.slice(0, 15)}... by ${sig.signedBy})`);
  }

  if (files.length > 1) {
    console.log(`\n${files.length} files signed`);
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
