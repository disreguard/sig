"""Content signing API for runtime message verification."""

from __future__ import annotations

from datetime import datetime, timezone

from .hash import sha256, format_hash
from ..types import ContentSignature, SignContentOptions, ContentVerifyResult


def sign_content(content: str, options: SignContentOptions) -> ContentSignature:
    """Sign arbitrary content and return a signature.

    This is a stateless function - the caller is responsible for storing the signature.
    """
    hex_hash = sha256(content)
    return ContentSignature(
        id=options.id,
        hash=format_hash(hex_hash),
        algorithm="sha256",
        signed_by=options.identity,
        signed_at=datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        content_length=len(content.encode("utf-8")),
        metadata=options.metadata,
    )


def verify_content(content: str, signature: ContentSignature) -> dict:
    """Verify content against a signature.

    This is a stateless function - compare current content hash against stored signature.
    Returns dict with 'verified' and optional 'error' keys.
    """
    current_hash = format_hash(sha256(content))
    if current_hash != signature.hash:
        return {"verified": False, "error": "Content hash mismatch"}
    return {"verified": True}


class ContentStore:
    """In-memory store for signed content.

    Used for session-scoped signing of ephemeral content like chat messages.
    """

    def __init__(self) -> None:
        self._signatures: dict[str, ContentSignature] = {}
        self._contents: dict[str, str] = {}

    def sign(self, content: str, options: SignContentOptions) -> ContentSignature:
        """Sign content and store it in the store. Returns the signature."""
        signature = sign_content(content, options)
        self._signatures[options.id] = signature
        self._contents[options.id] = content
        return signature

    def verify(self, id: str) -> ContentVerifyResult:
        """Verify content by ID. Returns the stored content and signature if verified."""
        signature = self._signatures.get(id)
        if signature is None:
            return ContentVerifyResult(verified=False, id=id, error="No signature found for id")

        content = self._contents.get(id)
        if content is None:
            return ContentVerifyResult(verified=False, id=id, error="No content found for id")

        result = verify_content(content, signature)
        if not result["verified"]:
            return ContentVerifyResult(verified=False, id=id, error=result.get("error"))

        return ContentVerifyResult(
            verified=True,
            id=id,
            content=content,
            signature=signature,
        )

    def get(self, id: str) -> ContentSignature | None:
        """Get a signature by ID without verifying."""
        return self._signatures.get(id)

    def list(self) -> list[ContentSignature]:
        """List all signatures in the store."""
        return list(self._signatures.values())

    def delete(self, id: str) -> bool:
        """Delete a signature by ID. Returns True if the signature existed and was deleted."""
        had_sig = id in self._signatures
        self._signatures.pop(id, None)
        self._contents.pop(id, None)
        return had_sig

    def clear(self) -> None:
        """Clear all signatures from the store."""
        self._signatures.clear()
        self._contents.clear()

    def has(self, id: str) -> bool:
        """Check if a signature exists for the given ID."""
        return id in self._signatures

    @property
    def size(self) -> int:
        """Get the number of signatures in the store."""
        return len(self._signatures)


def create_content_store() -> ContentStore:
    """Factory function for creating session-scoped content stores."""
    return ContentStore()
