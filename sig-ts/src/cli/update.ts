import { updateAndSign } from '../core/update.js';
import { findProjectRoot } from '../core/config.js';
import type { UpdateProvenance } from '../types.js';

export async function updateCommand(
  file: string,
  opts: { by: string; reason: string; sourceType?: string; sourceId?: string }
): Promise<void> {
  const projectRoot = await findProjectRoot();

  // Read new content from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const newContent = Buffer.concat(chunks).toString('utf8');

  if (!opts.sourceType) {
    console.error('--source-type is required (signed_message or signed_template)');
    process.exit(1);
  }

  const provenance: UpdateProvenance = {
    sourceType: opts.sourceType as UpdateProvenance['sourceType'],
    sourceId: opts.sourceId,
    reason: opts.reason,
  };

  const result = await updateAndSign(projectRoot, file, newContent, {
    identity: opts.by,
    provenance,
  });

  if (result.approved) {
    console.log(`updated ${result.file}`);
    console.log(`  hash:          ${result.hash}`);
    console.log(`  previousHash:  ${result.previousHash}`);
    console.log(`  chainLength:   ${result.chainLength}`);
  } else {
    console.error(`DENIED ${result.file}: [${result.denial?.code}] ${result.denial?.reason}`);
    process.exit(1);
  }
}
