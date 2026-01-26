import { checkAllSigned } from '../core/verify.js';
import { findProjectRoot } from '../core/config.js';

export async function listCommand(): Promise<void> {
  const projectRoot = await findProjectRoot();
  const results = await checkAllSigned(projectRoot);

  if (results.length === 0) {
    console.log('No signed files');
    return;
  }

  for (const r of results) {
    const status = r.status === 'signed' ? 'ok' : 'MODIFIED';
    const by = r.signature?.signedBy ? ` (by ${r.signature.signedBy})` : '';
    console.log(`  ${status}  ${r.file}${by}`);
  }
}
