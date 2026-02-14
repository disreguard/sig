import { join, dirname } from 'node:path';
import type { AuditEntry, SigContext } from '../types.js';
import { toSigContext } from './fs.js';

const AUDIT_FILE = 'audit.jsonl';

function auditPath(ctx: SigContext): string {
  return join(ctx.sigDir, AUDIT_FILE);
}

export async function logEvent(
  ctxOrSigDir: SigContext | string,
  entry: Omit<AuditEntry, 'ts'>
): Promise<void> {
  const ctx = toSigContext(ctxOrSigDir);
  const path = auditPath(ctx);
  await ctx.fs.mkdir(dirname(path), { recursive: true });

  const full: AuditEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };

  await ctx.fs.appendFile(path, JSON.stringify(full) + '\n', 'utf8');
}

export async function readAuditLog(
  ctxOrSigDir: SigContext | string,
  file?: string
): Promise<AuditEntry[]> {
  const ctx = toSigContext(ctxOrSigDir);
  const path = auditPath(ctx);
  try {
    const raw = await ctx.fs.readFile(path, 'utf8');
    const entries = raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEntry);

    if (file) {
      return entries.filter((e) => e.file === file);
    }
    return entries;
  } catch {
    return [];
  }
}
