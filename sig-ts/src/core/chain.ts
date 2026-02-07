import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ChainEntry } from '../types.js';

const CHAINS_DIR = 'chains';
const CHAIN_EXT = '.chain.jsonl';

function chainPath(sigDir: string, filePath: string): string {
  return join(sigDir, CHAINS_DIR, filePath + CHAIN_EXT);
}

/** Append an entry to a file's update chain */
export async function appendChainEntry(sigDir: string, filePath: string, entry: ChainEntry): Promise<void> {
  const path = chainPath(sigDir, filePath);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
}

/** Read all chain entries for a file */
export async function readChain(sigDir: string, filePath: string): Promise<ChainEntry[]> {
  const path = chainPath(sigDir, filePath);
  try {
    const raw = await readFile(path, 'utf8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ChainEntry);
  } catch {
    return [];
  }
}

/** Get the head (most recent) chain entry. Returns null if no chain exists. */
export async function getChainHead(sigDir: string, filePath: string): Promise<ChainEntry | null> {
  const entries = await readChain(sigDir, filePath);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/** Validate chain integrity: each entry's previousHash matches the prior entry's hash */
export async function validateChain(
  sigDir: string,
  filePath: string
): Promise<{ valid: boolean; length: number; error?: string }> {
  const entries = await readChain(sigDir, filePath);

  if (entries.length === 0) {
    return { valid: true, length: 0 };
  }

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previousHash !== entries[i - 1].hash) {
      return {
        valid: false,
        length: entries.length,
        error: `Chain broken at entry ${i}: expected previousHash ${entries[i - 1].hash}, got ${entries[i].previousHash}`,
      };
    }
  }

  return { valid: true, length: entries.length };
}
