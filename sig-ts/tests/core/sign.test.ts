import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { signFile } from '../../src/core/sign.js';
import { initProject } from '../../src/core/config.js';

describe('signFile', () => {
  let projectRoot: string;
  const testContent = 'Hello {{ name }}, welcome to {{ place }}.\n';

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'sig-test-'));
    await initProject(projectRoot);
    await mkdir(join(projectRoot, 'prompts'), { recursive: true });
    await writeFile(join(projectRoot, 'prompts', 'test.txt'), testContent);
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('signs a file and creates signature', async () => {
    const sig = await signFile(projectRoot, 'prompts/test.txt', { identity: 'alice' });

    expect(sig.file).toBe('prompts/test.txt');
    expect(sig.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(sig.algorithm).toBe('sha256');
    expect(sig.signedBy).toBe('alice');
    expect(sig.signedAt).toBeTruthy();
    expect(sig.contentLength).toBe(Buffer.byteLength(testContent, 'utf8'));
  });

  it('stores signature and content in .sig/sigs/', async () => {
    await signFile(projectRoot, 'prompts/test.txt', { identity: 'bob' });

    const sigPath = join(projectRoot, '.sig', 'sigs', 'prompts', 'test.txt.sig.json');
    const raw = await readFile(sigPath, 'utf8');
    const stored = JSON.parse(raw);
    expect(stored.file).toBe('prompts/test.txt');
    expect(stored.signedBy).toBe('bob');

    const contentPath = join(projectRoot, '.sig', 'sigs', 'prompts', 'test.txt.sig.content');
    const content = await readFile(contentPath, 'utf8');
    expect(content).toBe(testContent);
  });

  it('records template engine from config', async () => {
    await initProject(projectRoot, { engine: 'jinja' });
    const sig = await signFile(projectRoot, 'prompts/test.txt');

    expect(sig.templateEngine).toBe('jinja');
  });

  it('uses engine override from options', async () => {
    const sig = await signFile(projectRoot, 'prompts/test.txt', { engine: 'mustache' });

    expect(sig.templateEngine).toBe('mustache');
  });

  it('creates audit entry', async () => {
    await signFile(projectRoot, 'prompts/test.txt', { identity: 'eve' });

    const auditPath = join(projectRoot, '.sig', 'audit.jsonl');
    const raw = await readFile(auditPath, 'utf8');
    const entry = JSON.parse(raw.trim());

    expect(entry.event).toBe('sign');
    expect(entry.file).toBe('prompts/test.txt');
    expect(entry.identity).toBe('eve');
  });

  it('produces deterministic hash for same content', async () => {
    const sig1 = await signFile(projectRoot, 'prompts/test.txt');
    const sig2 = await signFile(projectRoot, 'prompts/test.txt');

    expect(sig1.hash).toBe(sig2.hash);
  });

  it('rejects paths that escape project root', async () => {
    await expect(signFile(projectRoot, '../../../etc/passwd'))
      .rejects.toThrow(/escapes project root/i);
  });

  it('uses byte length for non-ASCII content', async () => {
    await writeFile(join(projectRoot, 'prompts', 'emoji.txt'), 'Hello 🌍\n');
    const sig = await signFile(projectRoot, 'prompts/emoji.txt');

    // '🌍' is 4 bytes in UTF-8, so "Hello 🌍\n" = 11 bytes, not 9 JS chars
    expect(sig.contentLength).toBe(Buffer.byteLength('Hello 🌍\n', 'utf8'));
  });
});
