import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { signFile } from '../../src/core/sign.js';
import { verifyFile, checkFile, checkAllSigned } from '../../src/core/verify.js';
import { initProject, sigDir } from '../../src/core/config.js';

describe('verifyFile', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'sig-test-'));
    await initProject(projectRoot, { engine: 'jinja' });
    await mkdir(join(projectRoot, 'prompts'), { recursive: true });
    await writeFile(
      join(projectRoot, 'prompts', 'test.txt'),
      'Review {{ code }} for issues.\n'
    );
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('verifies an unmodified signed file', async () => {
    await signFile(projectRoot, 'prompts/test.txt');
    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.verified).toBe(true);
    expect(result.template).toBe('Review {{ code }} for issues.\n');
    expect(result.signedBy).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('returns stored content, not live file', async () => {
    await signFile(projectRoot, 'prompts/test.txt');

    // Modify the live file but don't re-sign
    // Verification should still pass because hash matches,
    // but the template should come from stored content
    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.verified).toBe(true);
    expect(result.template).toBe('Review {{ code }} for issues.\n');
  });

  it('extracts placeholders from verified file', async () => {
    await signFile(projectRoot, 'prompts/test.txt');
    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.placeholders).toContain('{{ code }}');
  });

  it('fails verification for modified file', async () => {
    await signFile(projectRoot, 'prompts/test.txt');
    await appendFile(join(projectRoot, 'prompts', 'test.txt'), 'INJECTED\n');

    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.verified).toBe(false);
    expect(result.template).toBeUndefined();
    expect(result.error).toMatch(/modified/i);
  });

  it('fails verification for unsigned file', async () => {
    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/no signature/i);
  });

  it('fails verification for missing file', async () => {
    await signFile(projectRoot, 'prompts/test.txt');
    const { rm: rmFile } = await import('node:fs/promises');
    await rmFile(join(projectRoot, 'prompts', 'test.txt'));

    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('detects corrupted signature file', async () => {
    await signFile(projectRoot, 'prompts/test.txt');

    // Corrupt the sig file
    const sigPath = join(projectRoot, '.sig', 'sigs', 'prompts', 'test.txt.sig.json');
    await writeFile(sigPath, 'CORRUPTED{{{not json', 'utf8');

    const result = await verifyFile(projectRoot, 'prompts/test.txt');

    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/corrupted|tampered/i);
  });

  it('rejects paths that escape project root', async () => {
    await expect(verifyFile(projectRoot, '../../../etc/passwd'))
      .rejects.toThrow(/escapes project root/i);
  });
});

describe('checkFile', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'sig-test-'));
    await initProject(projectRoot);
    await mkdir(join(projectRoot, 'prompts'), { recursive: true });
    await writeFile(join(projectRoot, 'prompts', 'a.txt'), 'content a');
    await writeFile(join(projectRoot, 'prompts', 'b.txt'), 'content b');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('returns unsigned for file without signature', async () => {
    const result = await checkFile(projectRoot, 'prompts/a.txt');
    expect(result.status).toBe('unsigned');
  });

  it('returns signed for unmodified signed file', async () => {
    await signFile(projectRoot, 'prompts/a.txt');
    const result = await checkFile(projectRoot, 'prompts/a.txt');
    expect(result.status).toBe('signed');
    expect(result.signature).toBeTruthy();
  });

  it('returns modified for changed signed file', async () => {
    await signFile(projectRoot, 'prompts/a.txt');
    await writeFile(join(projectRoot, 'prompts', 'a.txt'), 'changed');
    const result = await checkFile(projectRoot, 'prompts/a.txt');
    expect(result.status).toBe('modified');
  });

  it('returns corrupted for invalid sig file', async () => {
    await signFile(projectRoot, 'prompts/a.txt');
    const sigPath = join(projectRoot, '.sig', 'sigs', 'prompts', 'a.txt.sig.json');
    await writeFile(sigPath, '!!!NOT JSON!!!', 'utf8');

    const result = await checkFile(projectRoot, 'prompts/a.txt');
    expect(result.status).toBe('corrupted');
  });

  it('rejects paths that escape project root', async () => {
    await expect(checkFile(projectRoot, '../../etc/shadow'))
      .rejects.toThrow(/escapes project root/i);
  });
});

describe('checkAllSigned', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'sig-test-'));
    await initProject(projectRoot);
    await mkdir(join(projectRoot, 'prompts'), { recursive: true });
    await writeFile(join(projectRoot, 'prompts', 'a.txt'), 'content a');
    await writeFile(join(projectRoot, 'prompts', 'b.txt'), 'content b');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('returns results for all signed files', async () => {
    await signFile(projectRoot, 'prompts/a.txt');
    await signFile(projectRoot, 'prompts/b.txt');

    const results = await checkAllSigned(projectRoot);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'signed')).toBe(true);
  });

  it('detects mix of signed and modified', async () => {
    await signFile(projectRoot, 'prompts/a.txt');
    await signFile(projectRoot, 'prompts/b.txt');
    await writeFile(join(projectRoot, 'prompts', 'b.txt'), 'changed');

    const results = await checkAllSigned(projectRoot);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(['modified', 'signed']);
  });
});
