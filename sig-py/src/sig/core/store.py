from __future__ import annotations

import json
import os
from typing import NamedTuple

from ..types import Signature, to_json_dict, signature_from_dict
from .fs import SigContext, to_sig_context

SIGS_DIR = "sigs"
SIG_EXT = ".sig.json"
CONTENT_EXT = ".sig.content"


def _sig_path(ctx: SigContext, file_path: str) -> str:
    return os.path.join(ctx.sig_dir, SIGS_DIR, file_path + SIG_EXT)


def _content_path(ctx: SigContext, file_path: str) -> str:
    return os.path.join(ctx.sig_dir, SIGS_DIR, file_path + CONTENT_EXT)


class LoadSigResult(NamedTuple):
    signature: Signature | None
    error: str | None


def store_sig(ctx_or_sig_dir: SigContext | str, signature: Signature, content: str) -> None:
    """Write both .sig.json and .sig.content files."""
    ctx = to_sig_context(ctx_or_sig_dir)
    meta_path = _sig_path(ctx, signature.file)
    ctx.fs.mkdir(os.path.dirname(meta_path), parents=True)
    ctx.fs.write_file(
        meta_path,
        json.dumps(to_json_dict(signature), indent=2) + "\n",
    )
    ctx.fs.write_file(_content_path(ctx, signature.file), content)


def load_sig(ctx_or_sig_dir: SigContext | str, file_path: str) -> LoadSigResult:
    """Load a signature. Returns (signature, error) where error is None, 'not-found', or 'corrupted'."""
    ctx = to_sig_context(ctx_or_sig_dir)
    path = _sig_path(ctx, file_path)
    try:
        raw = ctx.fs.read_file(path)
    except Exception:
        return LoadSigResult(signature=None, error="not-found")
    try:
        d = json.loads(raw)
        return LoadSigResult(signature=signature_from_dict(d), error=None)
    except (json.JSONDecodeError, TypeError, KeyError):
        return LoadSigResult(signature=None, error="corrupted")


def load_signed_content(ctx_or_sig_dir: SigContext | str, file_path: str) -> str | None:
    """Load the stored signed content, or None if missing."""
    ctx = to_sig_context(ctx_or_sig_dir)
    try:
        return ctx.fs.read_file(_content_path(ctx, file_path))
    except Exception:
        return None


def delete_sig(ctx_or_sig_dir: SigContext | str, file_path: str) -> None:
    """Delete both signature and content files. Ignores missing files."""
    ctx = to_sig_context(ctx_or_sig_dir)
    for path in (_sig_path(ctx, file_path), _content_path(ctx, file_path)):
        try:
            ctx.fs.unlink(path)
        except Exception:
            pass


def list_sigs(ctx_or_sig_dir: SigContext | str) -> list[Signature]:
    """Walk .sig/sigs/ and load all valid .sig.json files."""
    ctx = to_sig_context(ctx_or_sig_dir)
    sigs_root = os.path.join(ctx.sig_dir, SIGS_DIR)
    if not ctx.fs.exists(sigs_root):
        return []

    sigs: list[Signature] = []
    _walk_dir(ctx, sigs_root, sigs)
    return sigs


def _walk_dir(ctx: SigContext, dir_path: str, sigs: list[Signature]) -> None:
    try:
        entries = ctx.fs.readdir(dir_path)
    except Exception:
        return

    for entry in entries:
        full_path = os.path.join(dir_path, entry.name)
        if entry.is_dir:
            _walk_dir(ctx, full_path, sigs)
            continue
        if not full_path.endswith(SIG_EXT):
            continue
        try:
            raw = ctx.fs.read_file(full_path)
            d = json.loads(raw)
            sigs.append(signature_from_dict(d))
        except Exception:
            pass
