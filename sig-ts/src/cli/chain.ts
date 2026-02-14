import { readChain, validateChain } from '../core/chain.js';
import { findProjectRoot } from '../core/config.js';
import { createSigContext } from '../core/fs.js';
import { resolveContainedPath } from '../core/paths.js';

export async function chainCommand(file: string, opts: { verify?: boolean }): Promise<void> {
  const projectRoot = await findProjectRoot();
  const relPath = resolveContainedPath(projectRoot, file);
  const ctx = createSigContext(projectRoot);

  if (opts.verify) {
    const result = await validateChain(ctx, relPath);
    if (result.length === 0) {
      console.log(`No update chain for ${relPath}`);
      return;
    }
    if (result.valid) {
      console.log(`Chain valid: ${result.length} entries`);
    } else {
      console.error(`Chain INVALID: ${result.error}`);
      process.exit(1);
    }
    return;
  }

  const entries = await readChain(ctx, relPath);
  if (entries.length === 0) {
    console.log(`No update chain for ${relPath}`);
    return;
  }

  console.log(`Update chain for ${relPath} (${entries.length} entries):\n`);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    console.log(`  #${i + 1}  ${entry.signedAt}  by ${entry.signedBy}`);
    console.log(`       hash: ${entry.hash.slice(0, 15)}...`);
    console.log(`       prev: ${entry.previousHash.slice(0, 15)}...`);
    console.log(`       reason: ${entry.provenance.reason}`);
    console.log(`       source: ${entry.provenance.sourceType}${entry.provenance.sourceId ? ` (${entry.provenance.sourceId})` : ''}`);
    console.log();
  }
}
