from __future__ import annotations

import glob as globmod
import os
import sys
from pathlib import Path

import click

from .core.config import find_project_root, init_project, load_config, sig_dir
from .core.sign import sign_file
from .core.verify import verify_file, check_file, check_all_signed
from .core.audit import read_audit_log
from .templates.engines import get_engine_names


@click.group()
@click.version_option("0.3.0")
def cli():
    """Sign and verify prompt templates for AI agent security."""


@cli.command()
@click.option("--engine", help="Template engine(s), comma-separated")
@click.option("--by", "identity", help="Default signing identity")
def init(engine, identity):
    """Initialize .sig/ directory with config."""
    cwd = os.getcwd()

    parsed_engine = None
    if engine:
        parsed_engine = _parse_engines(engine)

    config = init_project(cwd, engine=parsed_engine, identity=identity)

    click.echo("Initialized .sig/ directory")
    if config.templates and config.templates.engine:
        engines = config.templates.engine
        if not isinstance(engines, list):
            engines = [engines]
        click.echo(f"Template engine(s): {', '.join(engines)}")
    if config.sign and config.sign.identity:
        click.echo(f"Default identity: {config.sign.identity}")


@cli.command()
@click.argument("files", nargs=-1, required=True)
@click.option("--by", "identity", help="Signing identity")
@click.option("--engine", help="Template engine override")
def sign(files, identity, engine):
    """Sign file(s)."""
    project_root = find_project_root()
    resolved = _resolve_files(project_root, files)

    if not resolved:
        click.echo("No files matched", err=True)
        sys.exit(1)

    for file_path in resolved:
        rel_path = os.path.relpath(file_path, project_root)
        sig = sign_file(project_root, rel_path, identity=identity, engine=engine)
        click.echo(f"signed {sig.file} ({sig.hash[:15]}... by {sig.signed_by})")

    if len(resolved) > 1:
        click.echo(f"\n{len(resolved)} files signed")


@cli.command()
@click.argument("file")
def verify(file):
    """Verify a signed file and print its content."""
    project_root = find_project_root()
    result = verify_file(project_root, file)

    if result.verified:
        click.echo(f"verified {result.file}")
        click.echo(f"  hash:      {result.hash}")
        click.echo(f"  signed by: {result.signed_by}")
        click.echo(f"  signed at: {result.signed_at}")
        if result.placeholders:
            click.echo(f"  placeholders: {', '.join(result.placeholders)}")
        click.echo()
        click.echo(result.template)
    else:
        click.echo(f"FAILED {result.file}: {result.error}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("files", nargs=-1)
def check(files):
    """Check signing status of file(s)."""
    project_root = find_project_root()

    if files:
        resolved = _resolve_files(project_root, files)
        results = []
        for file_path in resolved:
            rel_path = os.path.relpath(file_path, project_root)
            results.append(check_file(project_root, rel_path))
    else:
        results = check_all_signed(project_root)

    if not results:
        click.echo("No signed files found")
        return

    has_issues = False
    for r in results:
        if r.status == "signed":
            icon = "ok"
        elif r.status == "modified":
            icon = "MODIFIED"
        else:
            icon = "unsigned"
        click.echo(f"  {icon}  {r.file}")
        if r.status == "modified":
            has_issues = True

    if has_issues:
        sys.exit(1)


@cli.command("list")
def list_cmd():
    """List all signed files."""
    project_root = find_project_root()
    results = check_all_signed(project_root)

    if not results:
        click.echo("No signed files")
        return

    for r in results:
        status = "ok" if r.status == "signed" else "MODIFIED"
        by = f" (by {r.signature.signed_by})" if r.signature and r.signature.signed_by else ""
        click.echo(f"  {status}  {r.file}{by}")


@cli.command()
def status():
    """Overview of signed/modified/unsigned files."""
    project_root = find_project_root()
    config = load_config(project_root)
    signed_results = check_all_signed(project_root)

    ok = sum(1 for r in signed_results if r.status == "signed")
    modified = sum(1 for r in signed_results if r.status == "modified")
    click.echo(f"{ok} signed, {modified} modified")

    if config.sign and config.sign.include:
        signed_files = {r.file for r in signed_results}
        included: list[str] = []
        for pattern in config.sign.include:
            included.extend(
                globmod.glob(pattern, root_dir=project_root, recursive=True)
            )
        # Normalize to posix-style relative paths
        included_set = set()
        for f in included:
            p = Path(f)
            if not p.is_absolute():
                included_set.add(p.as_posix())
            else:
                included_set.add(os.path.relpath(f, project_root).replace(os.sep, "/"))

        if config.sign.exclude:
            excluded: set[str] = set()
            for pattern in config.sign.exclude:
                for f in globmod.glob(pattern, root_dir=project_root, recursive=True):
                    p = Path(f)
                    if not p.is_absolute():
                        excluded.add(p.as_posix())
                    else:
                        excluded.add(os.path.relpath(f, project_root).replace(os.sep, "/"))
            included_set -= excluded

        unsigned = included_set - signed_files
        if unsigned:
            click.echo(f"{len(unsigned)} unsigned (in include patterns)")


@cli.command()
@click.argument("file", required=False)
def audit(file):
    """Show audit log."""
    project_root = find_project_root()
    sdir = sig_dir(project_root)
    entries = read_audit_log(sdir, file)

    if not entries:
        if file:
            click.echo(f"No audit entries for {file}")
        else:
            click.echo("No audit entries")
        return

    for entry in entries:
        parts = [entry.ts, entry.event.ljust(12), entry.file]
        if entry.identity:
            parts.append(f"by {entry.identity}")
        if entry.hash:
            parts.append(entry.hash[:15] + "...")
        if entry.detail:
            parts.append(entry.detail)
        click.echo("  ".join(parts))


def _parse_engines(input_str: str) -> str | list[str]:
    valid = set(get_engine_names())
    engines = [s.strip() for s in input_str.split(",")]
    for e in engines:
        if e not in valid:
            click.echo(f"Unknown template engine: {e}", err=True)
            click.echo(f"Available: {', '.join(sorted(valid))}", err=True)
            sys.exit(1)
    return engines[0] if len(engines) == 1 else engines


def _resolve_files(project_root: str, patterns: tuple[str, ...] | list[str]) -> list[str]:
    results: list[str] = []
    for pattern in patterns:
        if "*" in pattern or "{" in pattern:
            matched = globmod.glob(pattern, root_dir=project_root, recursive=True)
            for m in matched:
                results.append(str(Path(project_root) / m))
        else:
            results.append(str((Path(project_root) / pattern).resolve()))
    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for f in results:
        if f not in seen:
            seen.add(f)
            deduped.append(f)
    return deduped
