"""Sign and verify prompt templates for AI agent security."""

from .types import (
    SigConfig,
    TemplatesConfig,
    SignConfig,
    CustomPattern,
    EngineDefinition,
    Signature,
    VerifyResult,
    CheckResult,
    AuditEntry,
    TemplateEngine,
    to_json_dict,
    signature_from_dict,
    ContentSignature,
    SignContentOptions,
    ContentVerifyResult,
)
from .core.hash import sha256, format_hash, parse_hash
from .core.config import load_config, save_config, init_project, find_project_root, sig_dir
from .core.store import store_sig, load_sig, load_signed_content, delete_sig, list_sigs
from .core.sign import sign_file
from .core.verify import verify_file, check_file, check_all_signed
from .core.audit import log_event, read_audit_log
from .core.paths import resolve_contained_path
from .templates.engines import ENGINES, extract_placeholders, get_engine_names
from .core.content import sign_content, verify_content, ContentStore, create_content_store

__all__ = [
    "SigConfig",
    "TemplatesConfig",
    "SignConfig",
    "CustomPattern",
    "EngineDefinition",
    "Signature",
    "VerifyResult",
    "CheckResult",
    "AuditEntry",
    "TemplateEngine",
    "to_json_dict",
    "signature_from_dict",
    "ContentSignature",
    "SignContentOptions",
    "ContentVerifyResult",
    "sha256",
    "format_hash",
    "parse_hash",
    "load_config",
    "save_config",
    "init_project",
    "find_project_root",
    "sig_dir",
    "store_sig",
    "load_sig",
    "load_signed_content",
    "delete_sig",
    "list_sigs",
    "sign_file",
    "verify_file",
    "check_file",
    "check_all_signed",
    "log_event",
    "read_audit_log",
    "resolve_contained_path",
    "ENGINES",
    "extract_placeholders",
    "get_engine_names",
    "sign_content",
    "verify_content",
    "ContentStore",
    "create_content_store",
]
