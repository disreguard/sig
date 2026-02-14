import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { logEvent, readAuditLog } from '../../src/core/audit.js';
import { createSigContext } from '../../src/core/fs.js';
import type { SigContext } from '../../src/types.js';

describe('audit', () => {
  let sigDir: string;
  let ctx: SigContext;

  beforeEach(async () => {
    sigDir = await mkdtemp(join(tmpdir(), 'sig-audit-'));
    ctx = createSigContext('.', { sigDir });
  });

  afterEach(async () => {
    await rm(sigDir, { recursive: true, force: true });
  });

  it('logs and reads events', async () => {
    await logEvent(ctx, { event: 'sign', file: 'test.txt', hash: 'sha256:abc', identity: 'alice' });
    await logEvent(ctx, { event: 'verify', file: 'test.txt', hash: 'sha256:abc' });

    const entries = await readAuditLog(ctx);
    expect(entries).toHaveLength(2);
    expect(entries[0].event).toBe('sign');
    expect(entries[0].ts).toBeTruthy();
    expect(entries[1].event).toBe('verify');
  });

  it('filters by file', async () => {
    await logEvent(ctx, { event: 'sign', file: 'a.txt' });
    await logEvent(ctx, { event: 'sign', file: 'b.txt' });

    const entries = await readAuditLog(ctx, 'a.txt');
    expect(entries).toHaveLength(1);
    expect(entries[0].file).toBe('a.txt');
  });

  it('returns empty for no log', async () => {
    const entries = await readAuditLog(ctx);
    expect(entries).toHaveLength(0);
  });

  it('accepts legacy string sigDir arguments', async () => {
    await logEvent(sigDir, { event: 'verify', file: 'legacy.txt' });
    const entries = await readAuditLog(sigDir, 'legacy.txt');
    expect(entries).toHaveLength(1);
    expect(entries[0].event).toBe('verify');
  });
});
