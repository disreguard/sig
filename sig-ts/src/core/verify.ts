import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256, formatHash } from './hash.js';
import { loadSig, loadSignedContent, listSigs } from './store.js';
import { logEvent } from './audit.js';
import { loadConfig, sigDir } from './config.js';
import { resolveContainedPath } from './paths.js';
import { extractPlaceholders } from '../templates/engines.js';
import type { VerifyResult, CheckResult, TemplateEngine } from '../types.js';

export async function verifyFile(
  projectRoot: string,
  filePath: string
): Promise<VerifyResult> {
  const config = await loadConfig(projectRoot);
  const relPath = resolveContainedPath(projectRoot, filePath);
  const dir = sigDir(projectRoot);

  const { signature: sig, error: loadError } = await loadSig(dir, relPath);

  if (!sig) {
    const detail = loadError === 'corrupted'
      ? 'Signature file is corrupted or tampered with'
      : 'No signature found';
    await logEvent(dir, {
      event: 'verify-fail',
      file: relPath,
      detail,
    });
    return {
      verified: false,
      file: relPath,
      error: detail,
    };
  }

  let content: string;
  try {
    content = await readFile(resolve(projectRoot, relPath), 'utf8');
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

  // Return the stored signed content, not the live file
  const signedContent = verified
    ? (await loadSignedContent(dir, relPath) ?? content)
    : undefined;

  const engines = config.templates?.engine
    ? (Array.isArray(config.templates.engine) ? config.templates.engine : [config.templates.engine])
    : (sig.templateEngine ? [sig.templateEngine as TemplateEngine] : undefined);

  const placeholders = verified && signedContent && engines
    ? extractPlaceholders(signedContent, engines, config.templates?.custom)
    : undefined;

  return {
    verified,
    file: relPath,
    template: signedContent,
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
  const relPath = resolveContainedPath(projectRoot, filePath);
  const dir = sigDir(projectRoot);

  const { signature: sig, error: loadError } = await loadSig(dir, relPath);
  if (!sig) {
    return {
      file: relPath,
      status: loadError === 'corrupted' ? 'corrupted' : 'unsigned',
    };
  }

  let content: string;
  try {
    content = await readFile(resolve(projectRoot, relPath), 'utf8');
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
