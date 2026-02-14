import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject, saveConfig } from '../../src/core/config.js';
import { createSigContext } from '../../src/core/fs.js';
import { PersistentContentStore } from '../../src/core/persistent-content.js';
import { readAuditLog } from '../../src/core/audit.js';

describe('PersistentContentStore', () => {
  let projectRoot: string;
  let store: PersistentContentStore;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'sig-persistent-content-'));
    await initProject(projectRoot);
    store = new PersistentContentStore(createSigContext(projectRoot));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('signs and verifies stored content', async () => {
    const signature = await store.sign('Review @input', {
      id: 'auditPrompt',
      identity: 'security-team',
    });

    expect(signature.id).toBe('auditPrompt');
    expect(signature.signedBy).toBe('security-team');
    expect(signature.hash.startsWith('sha256:')).toBe(true);

    const result = await store.verify('auditPrompt');
    expect(result.verified).toBe(true);
    expect(result.content).toBe('Review @input');
    expect(result.signature?.hash).toBe(signature.hash);
  });

  it('reuses signatures when content is unchanged', async () => {
    const first = await store.signIfChanged('same content', {
      id: 'prompt',
      identity: 'alice',
    });

    const second = await store.signIfChanged('same content', {
      id: 'prompt',
      identity: 'bob',
    });

    expect(second.hash).toBe(first.hash);
    expect(second.signedAt).toBe(first.signedAt);
    expect(second.signedBy).toBe(first.signedBy);

    const third = await store.signIfChanged('new content', {
      id: 'prompt',
      identity: 'bob',
    });
    expect(third.hash).not.toBe(first.hash);
    expect(await store.loadContent('prompt')).toBe('new content');
  });

  it('fails verification when provided content does not match', async () => {
    await store.sign('trusted content', { id: 'message1', identity: 'alice' });

    const result = await store.verify('message1', { content: 'tampered content' });
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/mismatch/i);
  });

  it('fails verification when no signature exists', async () => {
    const result = await store.verify('missing-message');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/no signature/i);
  });

  it('rejects invalid IDs', async () => {
    const invalidIds = ['../msg', 'a/b', 'a\\b', '..', 'bad\0id', ''];

    for (const id of invalidIds) {
      await expect(store.sign('x', { id, identity: 'alice' })).rejects.toThrow(/invalid|empty/i);
      await expect(store.verify(id)).rejects.toThrow(/invalid|empty/i);
    }
  });

  it('resolves identity via option, config, env, and unknown fallback', async () => {
    const previousUser = process.env.USER;
    const previousUsername = process.env.USERNAME;

    try {
      process.env.USER = 'env-user';
      process.env.USERNAME = 'env-username';

      const explicit = await store.sign('explicit', {
        id: 'id-explicit',
        identity: 'explicit-user',
      });
      expect(explicit.signedBy).toBe('explicit-user');

      await saveConfig(projectRoot, { version: 1, sign: { identity: 'config-user' } });
      const fromConfig = await store.sign('config', { id: 'id-config' });
      expect(fromConfig.signedBy).toBe('config-user');

      await saveConfig(projectRoot, { version: 1 });
      const fromEnv = await store.sign('env', { id: 'id-env' });
      expect(fromEnv.signedBy).toBe('env-user');

      process.env.USER = '';
      process.env.USERNAME = '';
      const unknown = await store.sign('unknown', { id: 'id-unknown' });
      expect(unknown.signedBy).toBe('unknown');
    } finally {
      if (previousUser === undefined) {
        delete process.env.USER;
      } else {
        process.env.USER = previousUser;
      }
      if (previousUsername === undefined) {
        delete process.env.USERNAME;
      } else {
        process.env.USERNAME = previousUsername;
      }
    }
  });

  it('records caller detail on verify audit events', async () => {
    const ctx = createSigContext(projectRoot);
    await store.sign('signed value', { id: 'audit-msg', identity: 'alice' });
    await store.verify('audit-msg', { detail: 'directive:verify' });

    const entries = await readAuditLog(ctx, 'content:audit-msg');
    const verifyEntry = entries.find((entry) => entry.event === 'verify');
    expect(verifyEntry).toBeTruthy();
    expect(verifyEntry?.detail).toBe('directive:verify');
  });
});
