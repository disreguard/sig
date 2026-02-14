from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

TemplateEngine = Literal[
    "jinja",
    "mustache",
    "handlebars",
    "jsx",
    "js-template",
    "bash",
    "mlld",
    "claude",
    "erb",
    "go-template",
    "python-fstring",
]

# snake_case → camelCase field mapping
_SNAKE_TO_CAMEL = {
    "signed_by": "signedBy",
    "signed_at": "signedAt",
    "content_length": "contentLength",
    "template_engine": "templateEngine",
}

_CAMEL_TO_SNAKE = {v: k for k, v in _SNAKE_TO_CAMEL.items()}


@dataclass
class CustomPattern:
    name: str
    patterns: list[str]


@dataclass
class EngineDefinition:
    name: str
    description: str
    placeholders: list[str]  # regex pattern strings


@dataclass
class TemplatesConfig:
    engine: str | list[str] | None = None
    custom: list[CustomPattern] | None = None


@dataclass
class SignConfig:
    algorithm: str | None = None
    identity: str | None = None
    include: list[str] | None = None
    exclude: list[str] | None = None


@dataclass
class SigConfig:
    version: int = 1
    templates: TemplatesConfig | None = None
    sign: SignConfig | None = None


@dataclass
class Signature:
    file: str
    hash: str
    algorithm: str
    signed_by: str
    signed_at: str
    content_length: int
    template_engine: str | None = None


@dataclass
class VerifyResult:
    verified: bool
    file: str
    template: str | None = None
    hash: str | None = None
    signed_by: str | None = None
    signed_at: str | None = None
    error: str | None = None
    placeholders: list[str] | None = None


@dataclass
class CheckResult:
    file: str
    status: str  # "signed" | "modified" | "unsigned" | "corrupted"
    signature: Signature | None = None


@dataclass
class AuditEntry:
    ts: str
    event: str
    file: str
    hash: str | None = None
    identity: str | None = None
    detail: str | None = None


# Content signing types (for runtime/in-memory signing)


@dataclass
class ContentSignature:
    id: str
    hash: str
    algorithm: str
    signed_by: str
    signed_at: str
    content_length: int
    metadata: dict[str, str] | None = None


@dataclass
class SignContentOptions:
    id: str
    identity: str
    metadata: dict[str, str] | None = None


@dataclass
class PersistentSignOptions:
    id: str
    identity: str | None = None
    metadata: dict[str, str] | None = None


@dataclass
class ContentVerifyResult:
    verified: bool
    id: str
    content: str | None = None
    signature: ContentSignature | None = None
    error: str | None = None


def to_json_dict(obj: object) -> dict | list:
    """Convert a dataclass instance to a camelCase dict suitable for JSON serialization.
    Removes keys with None values. Handles nested dataclasses."""
    if isinstance(obj, list):
        return [to_json_dict(item) for item in obj]

    d = asdict(obj)
    result = {}
    for key, value in d.items():
        if value is None:
            continue
        json_key = _SNAKE_TO_CAMEL.get(key, key)
        result[json_key] = value
    return result


def signature_from_dict(d: dict) -> Signature:
    """Convert a camelCase JSON dict to a Signature dataclass."""
    kwargs = {}
    for key, value in d.items():
        py_key = _CAMEL_TO_SNAKE.get(key, key)
        kwargs[py_key] = value
    return Signature(**kwargs)


def content_signature_from_dict(d: dict) -> ContentSignature:
    """Convert a camelCase JSON dict to a ContentSignature dataclass."""
    kwargs = {}
    for key, value in d.items():
        py_key = _CAMEL_TO_SNAKE.get(key, key)
        kwargs[py_key] = value
    return ContentSignature(**kwargs)
