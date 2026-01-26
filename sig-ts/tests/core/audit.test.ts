import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { logEvent, readAuditLog } from '../../src/core/audit.js';

describe('audit', () => {
  let sigDir: string;

  beforeEach(async () => {
    sigDir = await mkdtemp(join(tmpdir(), 'sig-audit-'));
  });

  afterEach(async () => {
    await rm(sigDir, { recursive: true, force: true });
  });

  it('logs and reads events', async () => {
    await logEvent(sigDir, { event: 'sign', file: 'test.txt', hash: 'sha256:abc', identity: 'alice' });
    await logEvent(sigDir, { event: 'verify', file: 'test.txt', hash: 'sha256:abc' });

    const entries = await readAuditLog(sigDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].event).toBe('sign');
    expect(entries[0].ts).toBeTruthy();
    expect(entries[1].event).toBe('verify');
  });

  it('filters by file', async () => {
    await logEvent(sigDir, { event: 'sign', file: 'a.txt' });
    await logEvent(sigDir, { event: 'sign', file: 'b.txt' });

    const entries = await readAuditLog(sigDir, 'a.txt');
    expect(entries).toHaveLength(1);
    expect(entries[0].file).toBe('a.txt');
  });

  it('returns empty for no log', async () => {
    const entries = await readAuditLog(sigDir);
    expect(entries).toHaveLength(0);
  });
});
