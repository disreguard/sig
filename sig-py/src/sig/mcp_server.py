from __future__ import annotations

import os

from fastmcp import FastMCP

from .core.config import find_project_root
from .core.verify import verify_file, check_file, check_all_signed
from .types import to_json_dict

mcp = FastMCP("sig")


@mcp.tool
def verify(file: str | None = None) -> dict | list:
    """Verify the signature of a signed template file.
    Returns the authenticated template content if valid.
    If SIG_VERIFY env var is set, verifies those files and ignores the file parameter.
    Otherwise falls back to the file parameter."""

    project_root = find_project_root()

    env_files = os.environ.get("SIG_VERIFY")
    if env_files:
        files = [f.strip() for f in env_files.split(",") if f.strip()]
    elif file:
        files = [file]
    else:
        return {"error": "No file specified. Provide a file parameter or set SIG_VERIFY env var."}

    results = [verify_file(project_root, f) for f in files]
    if len(results) == 1:
        return to_json_dict(results[0])
    return [to_json_dict(r) for r in results]


@mcp.tool
def list_signed() -> list[dict]:
    """List all signed files and their current status."""
    project_root = find_project_root()
    results = check_all_signed(project_root)
    return [to_json_dict(r) for r in results]


@mcp.tool
def check(file: str) -> dict:
    """Check if a specific file is signed and whether it has been modified since signing."""
    project_root = find_project_root()
    result = check_file(project_root, file)
    return to_json_dict(result)


def main():
    mcp.run()


if __name__ == "__main__":
    main()
