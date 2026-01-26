import { verifyFile } from '../core/verify.js';
import { findProjectRoot } from '../core/config.js';

export async function verifyCommand(file: string): Promise<void> {
  const projectRoot = await findProjectRoot();
  const result = await verifyFile(projectRoot, file);

  if (result.verified) {
    console.log(`verified ${result.file}`);
    console.log(`  hash:      ${result.hash}`);
    console.log(`  signed by: ${result.signedBy}`);
    console.log(`  signed at: ${result.signedAt}`);
    if (result.placeholders?.length) {
      console.log(`  placeholders: ${result.placeholders.join(', ')}`);
    }
    console.log();
    console.log(result.template);
  } else {
    console.error(`FAILED ${result.file}: ${result.error}`);
    process.exit(1);
  }
}
