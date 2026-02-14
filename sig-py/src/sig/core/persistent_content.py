from __future__ import annotations

import json
import os

from ..types import (
    ContentSignature,
    ContentVerifyResult,
    PersistentSignOptions,
    SignContentOptions,
    content_signature_from_dict,
    to_json_dict,
)
from .audit import log_event
from .content import sign_content, verify_content
from .fs import SigContext
from .hash import format_hash, sha256

CONTENT_DIR = "content"
META_EXT = ".sig.json"
CONTENT_EXT = ".sig.content"
CONFIG_FILE = "config.json"


def ensure_valid_id(id: str) -> None:
    if not id:
        raise ValueError("Content ID cannot be empty")
    if "/" in id or "\\" in id or ".." in id or "\0" in id:
        raise ValueError(f"Invalid content ID: {id}")


def default_identity() -> str:
    return os.environ.get("USER") or os.environ.get("USERNAME") or "unknown"


class PersistentContentStore:
    def __init__(self, ctx: SigContext):
        self._ctx = ctx

    def sign(self, content: str, *, options: PersistentSignOptions) -> ContentSignature:
        ensure_valid_id(options.id)
        identity = self._resolve_identity(options)
        signature = sign_content(
            content,
            SignContentOptions(
                id=options.id,
                identity=identity,
                metadata=options.metadata,
            ),
        )

        meta_path = self._meta_path(options.id)
        self._ctx.fs.mkdir(os.path.dirname(meta_path), parents=True)
        self._ctx.fs.write_file(
            meta_path,
            json.dumps(to_json_dict(signature), indent=2) + "\n",
        )
        self._ctx.fs.write_file(self._content_path(options.id), content)

        log_event(
            self._ctx,
            event="sign",
            file=self._audit_file(options.id),
            hash=signature.hash,
            identity=signature.signed_by,
        )

        return signature

    def verify(
        self,
        id: str,
        *,
        content: str | None = None,
        detail: str | None = None,
    ) -> ContentVerifyResult:
        ensure_valid_id(id)
        signature = self.load(id)
        if signature is None:
            self._log_verify_failure(id, "No signature found for id", detail)
            return ContentVerifyResult(verified=False, id=id, error="No signature found for id")

        stored_content = self.load_content(id)
        if stored_content is None:
            self._log_verify_failure(id, "No content found for id", detail)
            return ContentVerifyResult(verified=False, id=id, error="No content found for id")

        stored_check = verify_content(stored_content, signature)
        if not stored_check["verified"]:
            message = stored_check.get("error") or "Stored content verification failed"
            self._log_verify_failure(id, message, detail)
            return ContentVerifyResult(verified=False, id=id, error=message)

        if content is not None:
            input_check = verify_content(content, signature)
            if not input_check["verified"]:
                message = input_check.get("error") or "Content hash mismatch"
                self._log_verify_failure(id, message, detail)
                return ContentVerifyResult(verified=False, id=id, error=message)

        log_event(
            self._ctx,
            event="verify",
            file=self._audit_file(id),
            hash=signature.hash,
            detail=detail,
        )

        return ContentVerifyResult(
            verified=True,
            id=id,
            content=stored_content,
            signature=signature,
        )

    def sign_if_changed(
        self,
        content: str,
        *,
        options: PersistentSignOptions,
    ) -> ContentSignature:
        ensure_valid_id(options.id)
        existing = self.load(options.id)
        next_hash = format_hash(sha256(content))
        if existing and existing.hash == next_hash:
            existing_content = self.load_content(options.id)
            if existing_content is None:
                self._ctx.fs.mkdir(os.path.dirname(self._content_path(options.id)), parents=True)
                self._ctx.fs.write_file(self._content_path(options.id), content)
            return existing
        return self.sign(content, options=options)

    def load(self, id: str) -> ContentSignature | None:
        ensure_valid_id(id)
        try:
            raw = self._ctx.fs.read_file(self._meta_path(id))
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                return None
            signature = content_signature_from_dict(parsed)
            if (
                not isinstance(signature.id, str)
                or not isinstance(signature.hash, str)
                or signature.algorithm != "sha256"
                or not isinstance(signature.signed_by, str)
                or not isinstance(signature.signed_at, str)
                or not isinstance(signature.content_length, int)
            ):
                return None
            return signature
        except Exception:
            return None

    def load_content(self, id: str) -> str | None:
        ensure_valid_id(id)
        try:
            return self._ctx.fs.read_file(self._content_path(id))
        except Exception:
            return None

    def delete(self, id: str) -> bool:
        ensure_valid_id(id)
        had_sig = self.has(id)
        try:
            self._ctx.fs.unlink(self._meta_path(id))
        except Exception:
            pass
        try:
            self._ctx.fs.unlink(self._content_path(id))
        except Exception:
            pass
        return had_sig

    def list(self) -> list[ContentSignature]:
        dir_path = os.path.join(self._ctx.sig_dir, CONTENT_DIR)
        if not self._ctx.fs.exists(dir_path):
            return []

        try:
            entries = self._ctx.fs.readdir(dir_path)
        except Exception:
            return []

        signatures: list[ContentSignature] = []
        for entry in entries:
            if entry.is_dir or not entry.name.endswith(META_EXT):
                continue
            id = entry.name[: -len(META_EXT)]
            signature = self.load(id)
            if signature:
                signatures.append(signature)
        return signatures

    def has(self, id: str) -> bool:
        ensure_valid_id(id)
        return self._ctx.fs.exists(self._meta_path(id))

    def _resolve_identity(self, options: PersistentSignOptions) -> str:
        if options.identity:
            return options.identity
        config_identity = self._load_config_identity()
        return config_identity or default_identity()

    def _load_config_identity(self) -> str | None:
        try:
            raw = self._ctx.fs.read_file(os.path.join(self._ctx.sig_dir, CONFIG_FILE))
            parsed = json.loads(raw)
            sign = parsed.get("sign") if isinstance(parsed, dict) else None
            identity = sign.get("identity") if isinstance(sign, dict) else None
            return identity if isinstance(identity, str) else None
        except Exception:
            return None

    def _meta_path(self, id: str) -> str:
        return os.path.join(self._ctx.sig_dir, CONTENT_DIR, id + META_EXT)

    def _content_path(self, id: str) -> str:
        return os.path.join(self._ctx.sig_dir, CONTENT_DIR, id + CONTENT_EXT)

    def _audit_file(self, id: str) -> str:
        return f"content:{id}"

    def _log_verify_failure(self, id: str, reason: str, detail: str | None) -> None:
        log_event(
            self._ctx,
            event="verify-fail",
            file=self._audit_file(id),
            detail=f"{detail}: {reason}" if detail else reason,
        )
