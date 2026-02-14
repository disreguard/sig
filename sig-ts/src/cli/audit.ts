import { readAuditLog } from '../core/audit.js';
import { findProjectRoot } from '../core/config.js';
import { createSigContext } from '../core/fs.js';

export async function auditCommand(file?: string): Promise<void> {
  const projectRoot = await findProjectRoot();
  const ctx = createSigContext(projectRoot);
  const entries = await readAuditLog(ctx, file);

  if (entries.length === 0) {
    console.log(file ? `No audit entries for ${file}` : 'No audit entries');
    return;
  }

  for (const entry of entries) {
    const parts = [entry.ts, entry.event.padEnd(12), entry.file];
    if (entry.identity) parts.push(`by ${entry.identity}`);
    if (entry.hash) parts.push(entry.hash.slice(0, 15) + '...');
    if (entry.detail) parts.push(entry.detail);
    console.log(parts.join('  '));
  }
}
