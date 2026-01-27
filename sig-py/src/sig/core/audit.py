from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..types import AuditEntry

AUDIT_FILE = "audit.jsonl"


def _audit_path(sig_dir: str) -> Path:
    return Path(sig_dir) / AUDIT_FILE


def _now_iso() -> str:
    """ISO 8601 timestamp with millisecond precision and Z suffix."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def log_event(
    sig_dir: str,
    *,
    event: str,
    file: str,
    hash: str | None = None,
    identity: str | None = None,
    detail: str | None = None,
) -> None:
    """Append one JSON line to the audit log."""
    path = _audit_path(sig_dir)
    path.parent.mkdir(parents=True, exist_ok=True)

    entry: dict = {"ts": _now_iso(), "event": event, "file": file}
    if hash is not None:
        entry["hash"] = hash
    if identity is not None:
        entry["identity"] = identity
    if detail is not None:
        entry["detail"] = detail

    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def read_audit_log(sig_dir: str, file: str | None = None) -> list[AuditEntry]:
    """Read the audit log, optionally filtering by file. Returns empty list if no log exists."""
    path = _audit_path(sig_dir)
    try:
        raw = path.read_text("utf-8")
    except (FileNotFoundError, OSError):
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
