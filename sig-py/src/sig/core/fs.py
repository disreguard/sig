from __future__ import annotations

from pathlib import Path
from typing import NamedTuple, Protocol

SIG_DIR = ".sig"


class DirEntry(NamedTuple):
    name: str
    is_dir: bool


class SigFS(Protocol):
    def read_file(self, path: str) -> str: ...

    def write_file(self, path: str, content: str) -> None: ...

    def append_file(self, path: str, content: str) -> None: ...

    def mkdir(self, path: str, *, parents: bool = False) -> None: ...

    def readdir(self, path: str) -> list[DirEntry]: ...

    def unlink(self, path: str) -> None: ...

    def exists(self, path: str) -> bool: ...


class SigContext(NamedTuple):
    sig_dir: str
    fs: SigFS


class PathLibFS:
    def read_file(self, path: str) -> str:
        return Path(path).read_text("utf-8")

    def write_file(self, path: str, content: str) -> None:
        Path(path).write_text(content, encoding="utf-8")

    def append_file(self, path: str, content: str) -> None:
        with open(path, "a", encoding="utf-8") as file:
            file.write(content)

    def mkdir(self, path: str, *, parents: bool = False) -> None:
        Path(path).mkdir(parents=parents, exist_ok=parents)

    def readdir(self, path: str) -> list[DirEntry]:
        return [
            DirEntry(name=entry.name, is_dir=entry.is_dir())
            for entry in Path(path).iterdir()
        ]

    def unlink(self, path: str) -> None:
        Path(path).unlink()

    def exists(self, path: str) -> bool:
        return Path(path).exists()


def create_sig_context(
    project_root: str,
    *,
    fs: SigFS | None = None,
    sig_dir: str | None = None,
) -> SigContext:
    return SigContext(
        sig_dir=sig_dir if sig_dir is not None else str(Path(project_root) / SIG_DIR),
        fs=fs or PathLibFS(),
    )


def to_sig_context(ctx_or_sig_dir: SigContext | str) -> SigContext:
    if isinstance(ctx_or_sig_dir, str):
        return SigContext(sig_dir=ctx_or_sig_dir, fs=PathLibFS())
    return ctx_or_sig_dir
