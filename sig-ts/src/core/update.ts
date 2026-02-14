import { resolve } from 'node:path';
import { sha256, formatHash } from './hash.js';
import { loadConfig } from './config.js';
import { createSigContext } from './fs.js';
import { loadSig, storeSig } from './store.js';
import { logEvent } from './audit.js';
import { resolveContainedPath } from './paths.js';
import { resolveFilePolicy, matchesIdentityPattern } from './policy.js';
import { appendChainEntry, readChain } from './chain.js';
import { verifyFile } from './verify.js';
import type { UpdateAndSignOptions, UpdateResult, Signature, ChainEntry } from '../types.js';

export async function updateAndSign(
  projectRoot: string,
  filePath: string,
  newContent: string,
  options: UpdateAndSignOptions
): Promise<UpdateResult> {
  const ctx = createSigContext(projectRoot, { fs: options.fs });
  const relPath = resolveContainedPath(projectRoot, filePath);
  const config = await loadConfig(projectRoot, { fs: ctx.fs });
  const policy = resolveFilePolicy(config, relPath);

  // 1. Check mutable
  if (!policy.mutable) {
    await logEvent(ctx, {
      event: 'update_denied',
      file: relPath,
      identity: options.identity,
      detail: 'File is not mutable',
      provenance: options.provenance,
    });
    return {
      approved: false,
      file: relPath,
      denial: {
        code: 'not_mutable',
        reason: 'File policy does not allow mutations',
      },
    };
  }

  // 2. Check currently signed
  const { signature: existingSig } = await loadSig(ctx, relPath);
  if (!existingSig) {
    await logEvent(ctx, {
      event: 'update_denied',
      file: relPath,
      identity: options.identity,
      detail: 'File has no existing signature',
      provenance: options.provenance,
    });
    return {
      approved: false,
      file: relPath,
      denial: {
        code: 'not_signed',
        reason: 'File must be initially signed via `sig sign` before it can be updated',
      },
    };
  }

  // 3. Check identity
  if (policy.authorizedIdentities && policy.authorizedIdentities.length > 0) {
    const authorized = policy.authorizedIdentities.some((pattern) =>
      matchesIdentityPattern(pattern, options.identity)
    );
    if (!authorized) {
      await logEvent(ctx, {
        event: 'update_denied',
        file: relPath,
        identity: options.identity,
        detail: `Identity not authorized. Allowed: ${policy.authorizedIdentities.join(', ')}`,
        provenance: options.provenance,
      });
      return {
        approved: false,
        file: relPath,
        denial: {
          code: 'unauthorized_identity',
          reason: `Identity "${options.identity}" is not authorized to update this file`,
        },
      };
    }
  }

  // 4. Validate provenance source
  if (policy.requireSignedSource) {
    const { sourceType, sourceId } = options.provenance;

    if (sourceType === 'signed_message') {
      if (!sourceId) {
        await logEvent(ctx, {
          event: 'update_denied',
          file: relPath,
          identity: options.identity,
          detail: 'No sourceId provided for signed_message provenance',
          provenance: options.provenance,
        });
        return {
          approved: false,
          file: relPath,
          denial: {
            code: 'unsigned_source',
            reason: 'sourceId is required when sourceType is signed_message',
          },
        };
      }

      if (options.contentStore) {
        const verifyResult = await options.contentStore.verify(sourceId);
        if (!verifyResult.verified) {
          await logEvent(ctx, {
            event: 'update_denied',
            file: relPath,
            identity: options.identity,
            detail: `ContentStore verification failed for sourceId: ${sourceId}`,
            provenance: options.provenance,
          });
          return {
            approved: false,
            file: relPath,
            denial: {
              code: 'source_verification_failed',
              reason: `Source message "${sourceId}" could not be verified`,
            },
          };
        }
      }
    } else if (sourceType === 'signed_template') {
      if (!sourceId) {
        await logEvent(ctx, {
          event: 'update_denied',
          file: relPath,
          identity: options.identity,
          detail: 'No sourceId provided for signed_template provenance',
          provenance: options.provenance,
        });
        return {
          approved: false,
          file: relPath,
          denial: {
            code: 'unsigned_source',
            reason: 'sourceId is required when sourceType is signed_template',
          },
        };
      }

      const templateResult = await verifyFile(projectRoot, sourceId, { fs: ctx.fs });
      if (!templateResult.verified) {
        await logEvent(ctx, {
          event: 'update_denied',
          file: relPath,
          identity: options.identity,
          detail: `Template verification failed for sourceId: ${sourceId}`,
          provenance: options.provenance,
        });
        return {
          approved: false,
          file: relPath,
          denial: {
            code: 'source_verification_failed',
            reason: `Source template "${sourceId}" could not be verified`,
          },
        };
      }
    }
  }

  // 5. All checks pass — perform the update
  const previousHash = existingSig.hash;
  const newHash = formatHash(sha256(newContent));

  const chainEntry: ChainEntry = {
    hash: newHash,
    previousHash,
    signedBy: options.identity,
    signedAt: new Date().toISOString(),
    contentLength: Buffer.byteLength(newContent, 'utf8'),
    provenance: options.provenance,
  };

  // Write the actual file
  await ctx.fs.writeFile(resolve(projectRoot, relPath), newContent, 'utf8');

  // Update the signature
  const newSig: Signature = {
    file: relPath,
    hash: newHash,
    algorithm: 'sha256',
    signedBy: options.identity,
    signedAt: chainEntry.signedAt,
    contentLength: chainEntry.contentLength,
    templateEngine: existingSig.templateEngine,
  };
  await storeSig(ctx, newSig, newContent);

  // Append to chain
  await appendChainEntry(ctx, relPath, chainEntry);

  // Get chain length
  const chain = await readChain(ctx, relPath);

  // Audit log
  await logEvent(ctx, {
    event: 'update',
    file: relPath,
    hash: newHash,
    identity: options.identity,
    detail: options.provenance.reason,
    provenance: options.provenance,
  });

  return {
    approved: true,
    file: relPath,
    hash: newHash,
    previousHash,
    chainLength: chain.length,
  };
}
