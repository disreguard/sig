import { dirname } from 'node:path';
import type { SigConfig, FilePolicy } from '../types.js';

const DEFAULT_POLICY: FilePolicy = { mutable: false };

/**
 * Match a file path against a pattern that supports `*` in the filename position.
 * Examples: "soul.md" matches exactly, "llm/prompts/*.txt" matches any .txt in that dir.
 */
export function matchesFilePattern(pattern: string, filePath: string): boolean {
  if (!pattern.includes('*')) {
    return pattern === filePath;
  }

  const patternDir = dirname(pattern);
  const fileDir = dirname(filePath);

  if (patternDir !== fileDir) {
    return false;
  }

  // Convert the filename glob to a regex (only * in filename position)
  const patternFilename = pattern.slice(patternDir === '.' ? 0 : patternDir.length + 1);
  const fileFilename = filePath.slice(fileDir === '.' ? 0 : fileDir.length + 1);

  const escaped = patternFilename.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(fileFilename);
}

/**
 * Resolve the file policy for a given path. Most-specific match wins (exact over glob).
 * Returns default immutable policy if no match.
 */
export function resolveFilePolicy(config: SigConfig, filePath: string): FilePolicy {
  if (!config.files) {
    return DEFAULT_POLICY;
  }

  // Check for exact match first
  if (config.files[filePath]) {
    return { ...DEFAULT_POLICY, ...config.files[filePath] };
  }

  // Check glob patterns — most specific (longest pattern) wins
  let bestMatch: FilePolicy | null = null;
  let bestLength = -1;

  for (const [pattern, policy] of Object.entries(config.files)) {
    if (!pattern.includes('*')) continue;
    if (matchesFilePattern(pattern, filePath) && pattern.length > bestLength) {
      bestMatch = policy;
      bestLength = pattern.length;
    }
  }

  if (bestMatch) {
    return { ...DEFAULT_POLICY, ...bestMatch };
  }

  return DEFAULT_POLICY;
}

/**
 * Check if an identity matches any of the authorized patterns.
 * Supports exact match and prefix wildcards (e.g., "owner:*" matches "owner:adam").
 */
export function matchesIdentityPattern(pattern: string, identity: string): boolean {
  if (!pattern.includes('*')) {
    return pattern === identity;
  }

  const prefix = pattern.slice(0, pattern.indexOf('*'));
  return identity.startsWith(prefix);
}
