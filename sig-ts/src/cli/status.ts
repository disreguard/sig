import { resolve } from 'node:path';
import fg from 'fast-glob';
import { checkFile, checkAllSigned } from '../core/verify.js';
import { findProjectRoot, loadConfig } from '../core/config.js';

export async function statusCommand(): Promise<void> {
  const projectRoot = await findProjectRoot();
  const config = await loadConfig(projectRoot);

  const signed = await checkAllSigned(projectRoot);

  let ok = 0;
  let modified = 0;
  for (const r of signed) {
    if (r.status === 'signed') ok++;
    else if (r.status === 'modified') modified++;
  }

  console.log(`${ok} signed, ${modified} modified`);

  if (config.sign?.include?.length) {
    const included = await fg(config.sign.include, {
      cwd: projectRoot,
      ignore: config.sign?.exclude,
      absolute: true,
    });

    const signedFiles = new Set(signed.map((s) => s.file));
    const unsigned = included.filter((f) => {
      const rel = f.replace(projectRoot + '/', '');
      return !signedFiles.has(rel);
    });

    if (unsigned.length > 0) {
      console.log(`${unsigned.length} unsigned (in include patterns)`);
    }
  }
}
