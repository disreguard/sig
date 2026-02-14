import { resolve } from 'node:path';
import { sha256, formatHash } from './hash.js';
import { loadSig, loadSignedContent, listSigs } from './store.js';
import { logEvent } from './audit.js';
import { loadConfig } from './config.js';
import { createSigContext } from './fs.js';
import { resolveContainedPath } from './paths.js';
import { extractPlaceholders } from '../templates/engines.js';
import { validateChain, getChainHead } from './chain.js';
import type { CheckResult, SigFS, TemplateEngine, VerifyResult } from '../types.js';

export async function verifyFile(
  projectRoot: string,
  filePath: string,
  options?: { fs?: SigFS }
): Promise<VerifyResult> {
  const ctx = createSigContext(projectRoot, { fs: options?.fs });
  const config = await loadConfig(projectRoot, { fs: ctx.fs });
  const relPath = resolveContainedPath(projectRoot, filePath);

  const { signature: sig, error: loadError } = await loadSig(ctx, relPath);

  if (!sig) {
    const detail = loadError === 'corrupted'
      ? 'Signature file is corrupted or tampered with'
      : 'No signature found';
    await logEvent(ctx, {
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
    content = await ctx.fs.readFile(resolve(projectRoot, relPath), 'utf8');
  } catch {
    await logEvent(ctx, {
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
    await logEvent(ctx, {
      event: 'verify',
      file: relPath,
      hash: currentHash,
    });
  } else {
    await logEvent(ctx, {
      event: 'verify-fail',
      file: relPath,
      hash: currentHash,
      detail: `Expected ${sig.hash}, got ${currentHash}`,
    });
  }

  // Return the stored signed content, not the live file
  const signedContent = verified
    ? (await loadSignedContent(ctx, relPath) ?? content)
    : undefined;

  const engines = config.templates?.engine
    ? (Array.isArray(config.templates.engine) ? config.templates.engine : [config.templates.engine])
    : (sig.templateEngine ? [sig.templateEngine as TemplateEngine] : undefined);

  const placeholders = verified && signedContent && engines
    ? extractPlaceholders(signedContent, engines, config.templates?.custom)
    : undefined;

  // Check for update chain
  const chainValidation = await validateChain(ctx, relPath);
  let chain: VerifyResult['chain'] = undefined;
  if (chainValidation.length > 0) {
    const head = await getChainHead(ctx, relPath);
    chain = {
      length: chainValidation.length,
      valid: chainValidation.valid,
      lastUpdatedBy: head?.signedBy,
      lastUpdatedAt: head?.signedAt,
    };
  }

  return {
    verified,
    file: relPath,
    template: signedContent,
    hash: currentHash,
    signedBy: sig.signedBy,
    signedAt: sig.signedAt,
    error: verified ? undefined : 'Content has been modified since signing',
    placeholders: placeholders?.length ? placeholders : undefined,
    chain,
  };
}

export async function checkFile(
  projectRoot: string,
  filePath: string,
  options?: { fs?: SigFS }
): Promise<CheckResult> {
  const ctx = createSigContext(projectRoot, { fs: options?.fs });
  const relPath = resolveContainedPath(projectRoot, filePath);

  const { signature: sig, error: loadError } = await loadSig(ctx, relPath);
  if (!sig) {
    return {
      file: relPath,
      status: loadError === 'corrupted' ? 'corrupted' : 'unsigned',
    };
  }

  let content: string;
  try {
    content = await ctx.fs.readFile(resolve(projectRoot, relPath), 'utf8');
  } catch {
    return { file: relPath, status: 'modified', signature: sig };
  }

  const currentHash = formatHash(sha256(content));
  if (currentHash === sig.hash) {
    return { file: relPath, status: 'signed', signature: sig };
  }

  return { file: relPath, status: 'modified', signature: sig };
}

export async function checkAllSigned(projectRoot: string, options?: { fs?: SigFS }): Promise<CheckResult[]> {
  const ctx = createSigContext(projectRoot, { fs: options?.fs });
  const sigs = await listSigs(ctx);
  const results: CheckResult[] = [];

  for (const sig of sigs) {
    const result = await checkFile(projectRoot, sig.file, { fs: ctx.fs });
    results.push(result);
  }

  return results;
}
