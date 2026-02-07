export type {
  SigConfig,
  TemplateEngine,
  CustomPattern,
  EngineDefinition,
  Signature,
  VerifyResult,
  AuditEntry,
  CheckResult,
  ContentSignature,
  SignContentOptions,
  ContentVerifyResult,
  FilePolicy,
  ChainEntry,
  UpdateProvenance,
  UpdateAndSignOptions,
  UpdateResult,
} from './types.js';

export { sha256, formatHash, parseHash } from './core/hash.js';
export { loadConfig, saveConfig, initProject, findProjectRoot, sigDir } from './core/config.js';
export { storeSig, loadSig, loadSignedContent, deleteSig, listSigs } from './core/store.js';
export { signFile } from './core/sign.js';
export { verifyFile, checkFile, checkAllSigned } from './core/verify.js';
export { logEvent, readAuditLog } from './core/audit.js';
export { resolveContainedPath } from './core/paths.js';
export { ENGINES, extractPlaceholders, getEngineNames } from './templates/engines.js';
export { signContent, verifyContent, ContentStore, createContentStore } from './core/content.js';
export { resolveFilePolicy, matchesFilePattern } from './core/policy.js';
export { updateAndSign } from './core/update.js';
export { appendChainEntry, readChain, getChainHead, validateChain } from './core/chain.js';
