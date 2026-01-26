import { resolve, relative } from 'node:path';

export function resolveContainedPath(projectRoot: string, filePath: string): string {
  const absPath = resolve(projectRoot, filePath);
  const relPath = relative(projectRoot, absPath);

  if (relPath.startsWith('..') || resolve(projectRoot, relPath) !== absPath) {
    throw new Error(`Path escapes project root: ${filePath}`);
  }

  return relPath;
}
