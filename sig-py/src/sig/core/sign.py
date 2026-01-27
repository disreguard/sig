from __future__ import annotations

import getpass
import os
from datetime import datetime, timezone
from pathlib import Path

from ..types import Signature
from .hash import sha256, format_hash
from .store import store_sig
from .audit import log_event
from .config import load_config, sig_dir
from .paths import resolve_contained_path


def sign_file(
    project_root: str,
    file_path: str,
    *,
    identity: str | None = None,
    engine: str | None = None,
) -> Signature:
    config = load_config(project_root)
    rel_path = resolve_contained_path(project_root, file_path)
    abs_path = Path(project_root) / rel_path
    content = abs_path.read_text("utf-8")
    hex_digest = sha256(content)

    resolved_identity = (
        identity
        or (config.sign.identity if config.sign else None)
        or _default_identity()
    )

    now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    sig = Signature(
        file=rel_path,
        hash=format_hash(hex_digest),
        algorithm="sha256",
        signed_by=resolved_identity,
        signed_at=now,
        content_length=len(content.encode("utf-8")),
    )

    engine_name = engine
    if engine_name is None and config.templates and config.templates.engine:
        eng = config.templates.engine
        engine_name = eng[0] if isinstance(eng, list) else eng
    if engine_name:
        sig.template_engine = engine_name

    sdir = sig_dir(project_root)
    store_sig(sdir, sig, content)
    log_event(
        sdir,
        event="sign",
        file=rel_path,
        hash=sig.hash,
        identity=sig.signed_by,
    )

    return sig


def _default_identity() -> str:
    try:
        return getpass.getuser()
    except Exception:
        return os.environ.get("USER", os.environ.get("USERNAME", "unknown"))
