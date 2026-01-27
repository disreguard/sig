from __future__ import annotations

import json
from pathlib import Path
from typing import NamedTuple

from ..types import Signature, to_json_dict, signature_from_dict

SIGS_DIR = "sigs"
SIG_EXT = ".sig.json"
CONTENT_EXT = ".sig.content"


def _sig_path(sig_dir: str, file_path: str) -> Path:
    return Path(sig_dir) / SIGS_DIR / (file_path + SIG_EXT)


def _content_path(sig_dir: str, file_path: str) -> Path:
    return Path(sig_dir) / SIGS_DIR / (file_path + CONTENT_EXT)


class LoadSigResult(NamedTuple):
    signature: Signature | None
    error: str | None


def store_sig(sig_dir: str, signature: Signature, content: str) -> None:
    """Write both .sig.json and .sig.content files."""
    meta_path = _sig_path(sig_dir, signature.file)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(
        json.dumps(to_json_dict(signature), indent=2) + "\n",
        encoding="utf-8",
    )
    _content_path(sig_dir, signature.file).write_text(content, encoding="utf-8")


def load_sig(sig_dir: str, file_path: str) -> LoadSigResult:
    """Load a signature. Returns (signature, error) where error is None, 'not-found', or 'corrupted'."""
    path = _sig_path(sig_dir, file_path)
    try:
        raw = path.read_text("utf-8")
    except (FileNotFoundError, OSError):
        return LoadSigResult(signature=None, error="not-found")
    try:
        d = json.loads(raw)
        return LoadSigResult(signature=signature_from_dict(d), error=None)
    except (json.JSONDecodeError, TypeError, KeyError):
        return LoadSigResult(signature=None, error="corrupted")


def load_signed_content(sig_dir: str, file_path: str) -> str | None:
    """Load the stored signed content, or None if missing."""
    try:
        return _content_path(sig_dir, file_path).read_text("utf-8")
    except (FileNotFoundError, OSError):
        return None


def delete_sig(sig_dir: str, file_path: str) -> None:
    """Delete both signature and content files. Ignores missing files."""
    for path in (_sig_path(sig_dir, file_path), _content_path(sig_dir, file_path)):
        try:
            path.unlink()
        except (FileNotFoundError, OSError):
            pass


def list_sigs(sig_dir: str) -> list[Signature]:
    """Walk .sig/sigs/ and load all valid .sig.json files."""
    sigs_root = Path(sig_dir) / SIGS_DIR
    if not sigs_root.exists():
        return []

    sigs: list[Signature] = []
    for path in sigs_root.rglob("*" + SIG_EXT):
        try:
            raw = path.read_text("utf-8")
            d = json.loads(raw)
            sigs.append(signature_from_dict(d))
        except Exception:
            pass
    return sigs
