from pathlib import Path


def resolve_contained_path(project_root: str, file_path: str) -> str:
    """Resolve file_path relative to project_root. Raises if it escapes root."""
    root = Path(project_root).resolve()
    abs_path = (root / file_path).resolve()

    try:
        rel = abs_path.relative_to(root)
    except ValueError:
        raise ValueError(f"Path escapes project root: {file_path}")

    return rel.as_posix()
