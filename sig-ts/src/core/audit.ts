import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { AuditEntry } from '../types.js';

const AUDIT_FILE = 'audit.jsonl';

function auditPath(sigDir: string): string {
  return join(sigDir, AUDIT_FILE);
}

export async function logEvent(sigDir: string, entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const path = auditPath(sigDir);
  await mkdir(dirname(path), { recursive: true });

  const full: AuditEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };

  await appendFile(path, JSON.stringify(full) + '\n', 'utf8');
}

export async function readAuditLog(sigDir: string, file?: string): Promise<AuditEntry[]> {
  const path = auditPath(sigDir);
  try {
    const raw = await readFile(path, 'utf8');
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
