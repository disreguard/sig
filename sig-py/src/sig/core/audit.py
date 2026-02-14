from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from ..types import AuditEntry
from .fs import SigContext, to_sig_context

AUDIT_FILE = "audit.jsonl"


def _audit_path(ctx: SigContext) -> str:
    return os.path.join(ctx.sig_dir, AUDIT_FILE)


def _now_iso() -> str:
    """ISO 8601 timestamp with millisecond precision and Z suffix."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def log_event(
    ctx_or_sig_dir: SigContext | str,
    *,
    event: str,
    file: str,
    hash: str | None = None,
    identity: str | None = None,
    detail: str | None = None,
) -> None:
    """Append one JSON line to the audit log."""
    ctx = to_sig_context(ctx_or_sig_dir)
    path = _audit_path(ctx)
    ctx.fs.mkdir(os.path.dirname(path), parents=True)

    entry: dict = {"ts": _now_iso(), "event": event, "file": file}
    if hash is not None:
        entry["hash"] = hash
    if identity is not None:
        entry["identity"] = identity
    if detail is not None:
        entry["detail"] = detail

    ctx.fs.append_file(path, json.dumps(entry) + "\n")


def read_audit_log(ctx_or_sig_dir: SigContext | str, file: str | None = None) -> list[AuditEntry]:
    """Read the audit log, optionally filtering by file. Returns empty list if no log exists."""
    ctx = to_sig_context(ctx_or_sig_dir)
    path = _audit_path(ctx)
    try:
        raw = ctx.fs.read_file(path)
    except Exception:
        return []

    entries: list[AuditEntry] = []
    for line in raw.strip().split("\n"):
        if not line:
            continue
        try:
            d = json.loads(line)
            entry = AuditEntry(
                ts=d["ts"],
                event=d["event"],
                file=d["file"],
                hash=d.get("hash"),
                identity=d.get("identity"),
                detail=d.get("detail"),
            )
            if file is None or entry.file == file:
                entries.append(entry)
        except (json.JSONDecodeError, KeyError):
            continue

    return entries
