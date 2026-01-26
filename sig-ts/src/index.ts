export type {
  SigConfig,
  TemplateEngine,
  CustomPattern,
  EngineDefinition,
  Signature,
  VerifyResult,
  AuditEntry,
  CheckResult,
} from './types.js';

export { sha256, formatHash, parseHash } from './core/hash.js';
export { loadConfig, saveConfig, initProject, findProjectRoot, sigDir } from './core/config.js';
export { storeSig, loadSig, loadSignedContent, deleteSig, listSigs } from './core/store.js';
export { signFile } from './core/sign.js';
export { verifyFile, checkFile, checkAllSigned } from './core/verify.js';
export { logEvent, readAuditLog } from './core/audit.js';
export { resolveContainedPath } from './core/paths.js';
export { ENGINES, extractPlaceholders, getEngineNames } from './templates/engines.js';
