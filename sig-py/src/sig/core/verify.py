from __future__ import annotations

from pathlib import Path

from ..types import VerifyResult, CheckResult
from .hash import sha256, format_hash
from .store import load_sig, load_signed_content, list_sigs
from .audit import log_event
from .config import load_config
from .fs import SigFS, create_sig_context
from .paths import resolve_contained_path
from ..templates.engines import extract_placeholders


def verify_file(
    project_root: str,
    file_path: str,
    *,
    fs: SigFS | None = None,
) -> VerifyResult:
    ctx = create_sig_context(project_root, fs=fs)
    config = load_config(project_root, fs=ctx.fs)
    rel_path = resolve_contained_path(project_root, file_path)

    result = load_sig(ctx, rel_path)
    sig = result.signature
    load_error = result.error

    if sig is None:
        detail = (
            "Signature file is corrupted or tampered with"
            if load_error == "corrupted"
            else "No signature found"
        )
        log_event(ctx, event="verify-fail", file=rel_path, detail=detail)
        return VerifyResult(verified=False, file=rel_path, error=detail)

    try:
        content = ctx.fs.read_file(str(Path(project_root) / rel_path))
    except Exception:
        log_event(ctx, event="verify-fail", file=rel_path, detail="File not found")
        return VerifyResult(verified=False, file=rel_path, error="File not found")

    current_hash = format_hash(sha256(content))
    verified = current_hash == sig.hash

    if verified:
        log_event(ctx, event="verify", file=rel_path, hash=current_hash)
    else:
        log_event(
            ctx,
            event="verify-fail",
            file=rel_path,
            hash=current_hash,
            detail=f"Expected {sig.hash}, got {current_hash}",
        )

    signed_content: str | None = None
    if verified:
        signed_content = load_signed_content(ctx, rel_path) or content

    engines: list[str] | None = None
    if config.templates and config.templates.engine:
        eng = config.templates.engine
        engines = eng if isinstance(eng, list) else [eng]
    elif sig.template_engine:
        engines = [sig.template_engine]

    placeholders: list[str] | None = None
    if verified and signed_content and engines:
        custom = None
        if config.templates and config.templates.custom:
            custom = config.templates.custom
        found = extract_placeholders(signed_content, engines, custom)
        if found:
            placeholders = found

    return VerifyResult(
        verified=verified,
        file=rel_path,
        template=signed_content,
        hash=current_hash,
        signed_by=sig.signed_by,
        signed_at=sig.signed_at,
        error=None if verified else "Content has been modified since signing",
        placeholders=placeholders,
    )


def check_file(
    project_root: str,
    file_path: str,
    *,
    fs: SigFS | None = None,
) -> CheckResult:
    ctx = create_sig_context(project_root, fs=fs)
    rel_path = resolve_contained_path(project_root, file_path)

    result = load_sig(ctx, rel_path)
    sig = result.signature
    load_error = result.error

    if sig is None:
        status = "corrupted" if load_error == "corrupted" else "unsigned"
        return CheckResult(file=rel_path, status=status)

    try:
        content = ctx.fs.read_file(str(Path(project_root) / rel_path))
    except Exception:
        return CheckResult(file=rel_path, status="modified", signature=sig)

    current_hash = format_hash(sha256(content))
    if current_hash == sig.hash:
        return CheckResult(file=rel_path, status="signed", signature=sig)

    return CheckResult(file=rel_path, status="modified", signature=sig)


def check_all_signed(project_root: str, *, fs: SigFS | None = None) -> list[CheckResult]:
    ctx = create_sig_context(project_root, fs=fs)
    sigs = list_sigs(ctx)
    results: list[CheckResult] = []
    for sig in sigs:
        r = check_file(project_root, sig.file, fs=ctx.fs)
        results.append(r)
    return results
