from __future__ import annotations

import json
from pathlib import Path

from ..types import SigConfig, TemplatesConfig, SignConfig
from .fs import SigFS, PathLibFS

SIG_DIR = ".sig"
CONFIG_FILE = "config.json"


def sig_dir(project_root: str) -> str:
    return str(Path(project_root) / SIG_DIR)


def config_path(project_root: str) -> str:
    return str(Path(project_root) / SIG_DIR / CONFIG_FILE)


def load_config(project_root: str, *, fs: SigFS | None = None) -> SigConfig:
    """Load config from .sig/config.json. Returns default on any error."""
    filesystem = fs or PathLibFS()
    try:
        raw = filesystem.read_file(config_path(project_root))
        d = json.loads(raw)
        config = SigConfig(version=d.get("version", 1))
        if "templates" in d:
            t = d["templates"]
            config.templates = TemplatesConfig(
                engine=t.get("engine"),
                custom=t.get("custom"),
            )
        if "sign" in d:
            s = d["sign"]
            config.sign = SignConfig(
                algorithm=s.get("algorithm"),
                identity=s.get("identity"),
                include=s.get("include"),
                exclude=s.get("exclude"),
            )
        return config
    except Exception:
        return SigConfig()


def save_config(project_root: str, config: SigConfig, *, fs: SigFS | None = None) -> None:
    """Write config as JSON with 2-space indent + trailing newline."""
    filesystem = fs or PathLibFS()
    d: dict = {"version": config.version}
    if config.templates is not None:
        t: dict = {}
        if config.templates.engine is not None:
            t["engine"] = config.templates.engine
        if config.templates.custom is not None:
            t["custom"] = config.templates.custom
        if t:
            d["templates"] = t
    if config.sign is not None:
        s: dict = {}
        if config.sign.identity is not None:
            s["identity"] = config.sign.identity
        if config.sign.algorithm is not None:
            s["algorithm"] = config.sign.algorithm
        if config.sign.include is not None:
            s["include"] = config.sign.include
        if config.sign.exclude is not None:
            s["exclude"] = config.sign.exclude
        if s:
            d["sign"] = s

    path = config_path(project_root)
    filesystem.mkdir(str(Path(path).parent), parents=True)
    filesystem.write_file(path, json.dumps(d, indent=2) + "\n")


def init_project(
    project_root: str,
    engine: str | list[str] | None = None,
    identity: str | None = None,
    *,
    fs: SigFS | None = None,
) -> SigConfig:
    """Create .sig/ structure and config."""
    filesystem = fs or PathLibFS()
    sig = Path(project_root) / SIG_DIR
    filesystem.mkdir(str(sig / "sigs"), parents=True)

    config = SigConfig(version=1)
    if engine is not None:
        config.templates = TemplatesConfig(engine=engine)
    if identity is not None:
        config.sign = SignConfig(identity=identity)

    save_config(project_root, config, fs=filesystem)
    return config


def find_project_root(start_dir: str | None = None) -> str:
    """Walk up looking for .sig/. Returns start_dir if not found."""
    import os

    start = Path(start_dir or os.getcwd()).resolve()
    current = start

    while True:
        if (current / SIG_DIR).exists():
            return str(current)
        parent = current.parent
        if parent == current:
            break
        current = parent

    return str(start)
