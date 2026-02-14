import { join, dirname } from 'node:path';
import type { ChainEntry, SigContext } from '../types.js';
import { toSigContext } from './fs.js';

const CHAINS_DIR = 'chains';
const CHAIN_EXT = '.chain.jsonl';

function chainPath(ctx: SigContext, filePath: string): string {
  return join(ctx.sigDir, CHAINS_DIR, filePath + CHAIN_EXT);
}

/** Append an entry to a file's update chain */
export async function appendChainEntry(
  ctxOrSigDir: SigContext | string,
  filePath: string,
  entry: ChainEntry
): Promise<void> {
  const ctx = toSigContext(ctxOrSigDir);
  const path = chainPath(ctx, filePath);
  await ctx.fs.mkdir(dirname(path), { recursive: true });
  await ctx.fs.appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
}

/** Read all chain entries for a file */
export async function readChain(ctxOrSigDir: SigContext | string, filePath: string): Promise<ChainEntry[]> {
  const ctx = toSigContext(ctxOrSigDir);
  const path = chainPath(ctx, filePath);
  try {
    const raw = await ctx.fs.readFile(path, 'utf8');
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
export async function getChainHead(
  ctxOrSigDir: SigContext | string,
  filePath: string
): Promise<ChainEntry | null> {
  const ctx = toSigContext(ctxOrSigDir);
  const entries = await readChain(ctx, filePath);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/** Validate chain integrity: each entry's previousHash matches the prior entry's hash */
export async function validateChain(
  ctxOrSigDir: SigContext | string,
  filePath: string
): Promise<{ valid: boolean; length: number; error?: string }> {
  const ctx = toSigContext(ctxOrSigDir);
  const entries = await readChain(ctx, filePath);

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
