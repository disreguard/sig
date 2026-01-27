from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class EngineDefinition:
    name: str
    description: str
    placeholders: list[str]  # regex pattern strings


ENGINES: dict[str, EngineDefinition] = {
    "jinja": EngineDefinition(
        name="jinja",
        description="Jinja2 / Nunjucks",
        placeholders=[r"\{\{.*?\}\}", r"\{%.*?%\}", r"\{#.*?#\}"],
    ),
    "mustache": EngineDefinition(
        name="mustache",
        description="Mustache",
        placeholders=[r"\{\{\{.*?\}\}\}", r"\{\{[#/^>]?.*?\}\}"],
    ),
    "handlebars": EngineDefinition(
        name="handlebars",
        description="Handlebars",
        placeholders=[r"\{\{\{.*?\}\}\}", r"\{\{[#/^>~]?.*?\}\}"],
    ),
    "jsx": EngineDefinition(
        name="jsx",
        description="JSX / React expressions",
        placeholders=[r"\{[^}]+\}"],
    ),
    "js-template": EngineDefinition(
        name="js-template",
        description="JavaScript template literals",
        placeholders=[r"\$\{[^}]+\}"],
    ),
    "bash": EngineDefinition(
        name="bash",
        description="Bash / Shell variables",
        placeholders=[r"\$\{[^}]+\}", r"\$[A-Z_][A-Z0-9_]*"],
    ),
    "mlld": EngineDefinition(
        name="mlld",
        description="mlld style (@var, <file>)",
        placeholders=[r"@[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)*", r"<[a-zA-Z][\w./-]*>"],
    ),
    "claude": EngineDefinition(
        name="claude",
        description="Claude artifacts ({{var}}, @file)",
        placeholders=[r"\{\{[a-zA-Z_]\w*\}\}", r"@[a-zA-Z][\w/-]*"],
    ),
    "erb": EngineDefinition(
        name="erb",
        description="Ruby ERB",
        placeholders=[r"<%=?-?\s.*?-?%>"],
    ),
    "go-template": EngineDefinition(
        name="go-template",
        description="Go text/template",
        placeholders=[r"\{\{.*?\}\}"],
    ),
    "python-fstring": EngineDefinition(
        name="python-fstring",
        description="Python f-strings",
        placeholders=[r"\{[^}]+\}"],
    ),
}


def extract_placeholders(
    content: str,
    engine: str | list[str] | None = None,
    custom: list[dict] | None = None,
) -> list[str]:
    """Returns deduplicated list of matched placeholders."""
    found: set[str] = set()

    engines: list[str] = []
    if engine is not None:
        engines = engine if isinstance(engine, list) else [engine]

    for eng_name in engines:
        defn = ENGINES.get(eng_name)
        if defn is None:
            continue
        for pattern_str in defn.placeholders:
            for match in re.finditer(pattern_str, content):
                found.add(match.group(0))

    if custom:
        for cp in custom:
            patterns = cp.get("patterns", []) if isinstance(cp, dict) else cp.patterns
            for pat_str in patterns:
                for match in re.finditer(pat_str, content):
                    found.add(match.group(0))

    return list(found)


def get_engine_names() -> list[str]:
    return list(ENGINES.keys())
