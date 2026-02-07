import { loadConfig, findProjectRoot } from '../core/config.js';
import { resolveFilePolicy } from '../core/policy.js';
import { resolveContainedPath } from '../core/paths.js';

export async function policyCommand(file?: string): Promise<void> {
  const projectRoot = await findProjectRoot();
  const config = await loadConfig(projectRoot);

  if (file) {
    const relPath = resolveContainedPath(projectRoot, file);
    const policy = resolveFilePolicy(config, relPath);
    console.log(`Policy for ${relPath}:`);
    console.log(`  mutable:              ${policy.mutable ?? false}`);
    console.log(`  authorizedIdentities: ${policy.authorizedIdentities?.join(', ') || '(none)'}`);
    console.log(`  requireSignedSource:  ${policy.requireSignedSource ?? false}`);
    console.log(`  requireApproval:      ${policy.requireApproval ?? false}`);
    return;
  }

  // Show all file policies
  if (!config.files || Object.keys(config.files).length === 0) {
    console.log('No file policies configured');
    return;
  }

  for (const [pattern, policy] of Object.entries(config.files)) {
    console.log(`${pattern}:`);
    console.log(`  mutable:              ${policy.mutable ?? false}`);
    console.log(`  authorizedIdentities: ${policy.authorizedIdentities?.join(', ') || '(none)'}`);
    console.log(`  requireSignedSource:  ${policy.requireSignedSource ?? false}`);
    console.log(`  requireApproval:      ${policy.requireApproval ?? false}`);
    console.log();
  }
}
