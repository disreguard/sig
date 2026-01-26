import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { sha256, formatHash } from './hash.js';
import { loadSig, listSigs } from './store.js';
import { logEvent } from './audit.js';
import { loadConfig, sigDir } from './config.js';
import { extractPlaceholders } from '../templates/engines.js';
import type { VerifyResult, CheckResult, TemplateEngine } from '../types.js';

export async function verifyFile(
  projectRoot: string,
  filePath: string
): Promise<VerifyResult> {
  const config = await loadConfig(projectRoot);
  const absPath = resolve(projectRoot, filePath);
  const relPath = relative(projectRoot, absPath);
  const dir = sigDir(projectRoot);

  const sig = await loadSig(dir, relPath);
  if (!sig) {
    await logEvent(dir, {
      event: 'verify-fail',
      file: relPath,
      detail: 'No signature found',
    });
    return {
      verified: false,
      file: relPath,
      error: 'No signature found for this file',
    };
  }

  let content: string;
  try {
    content = await readFile(absPath, 'utf8');
  } catch {
    await logEvent(dir, {
      event: 'verify-fail',
      file: relPath,
      detail: 'File not found',
    });
    return {
      verified: false,
      file: relPath,
      error: 'File not found',
    };
  }

  const currentHash = formatHash(sha256(content));
  const verified = currentHash === sig.hash;

  if (verified) {
    await logEvent(dir, {
      event: 'verify',
      file: relPath,
      hash: currentHash,
    });
  } else {
    await logEvent(dir, {
      event: 'verify-fail',
      file: relPath,
      hash: currentHash,
      detail: `Expected ${sig.hash}, got ${currentHash}`,
    });
  }

  const engines = config.templates?.engine
    ? (Array.isArray(config.templates.engine) ? config.templates.engine : [config.templates.engine])
    : (sig.templateEngine ? [sig.templateEngine as TemplateEngine] : undefined);

  const placeholders = verified && engines
    ? extractPlaceholders(content, engines, config.templates?.custom)
    : undefined;

  return {
    verified,
    file: relPath,
    template: verified ? content : undefined,
    hash: currentHash,
    signedBy: sig.signedBy,
    signedAt: sig.signedAt,
    error: verified ? undefined : 'Content has been modified since signing',
    placeholders: placeholders?.length ? placeholders : undefined,
  };
}

export async function checkFile(
  projectRoot: string,
  filePath: string
): Promise<CheckResult> {
  const absPath = resolve(projectRoot, filePath);
  const relPath = relative(projectRoot, absPath);
  const dir = sigDir(projectRoot);

  const sig = await loadSig(dir, relPath);
  if (!sig) {
    return { file: relPath, status: 'unsigned' };
  }

  let content: string;
  try {
    content = await readFile(absPath, 'utf8');
  } catch {
    return { file: relPath, status: 'modified', signature: sig };
  }

  const currentHash = formatHash(sha256(content));
  if (currentHash === sig.hash) {
    return { file: relPath, status: 'signed', signature: sig };
  }

  return { file: relPath, status: 'modified', signature: sig };
}

export async function checkAllSigned(projectRoot: string): Promise<CheckResult[]> {
  const dir = sigDir(projectRoot);
  const sigs = await listSigs(dir);
  const results: CheckResult[] = [];

  for (const sig of sigs) {
    const result = await checkFile(projectRoot, sig.file);
    results.push(result);
  }

  return results;
}
