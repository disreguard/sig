# sig-py

Python implementation of [sig](../README.md) — sign and verify prompt templates for AI agent security.

## Install

```bash
pip install disreguard-sig
```

Requires Python >= 3.11.

## CLI

```bash
sig init --engine jinja --by alice
sig sign prompts/*.txt
sig verify prompts/review.txt
sig check
sig list
sig status
sig audit
```

## MCP Server

```bash
sig-mcp
```

Or in an MCP config:

```json
{
  "mcpServers": {
    "sig": {
      "command": "sig-mcp",
      "env": {
        "SIG_VERIFY": "prompts/review.txt"
      }
    }
  }
}
```

## Library

```python
from sig import sign_file, verify_file, check_file, init_project

# Sign
sig = sign_file(project_root, "prompts/review.txt", identity="alice")

# Verify
result = verify_file(project_root, "prompts/review.txt")
if result.verified:
    print(result.template)       # signed content
    print(result.placeholders)   # extracted placeholders

# Check
status = check_file(project_root, "prompts/review.txt")
# status.status: 'signed' | 'modified' | 'unsigned' | 'corrupted'
```

High-level APIs also accept an optional filesystem adapter:

```python
from sig import PathLibFS, sign_file, verify_file, check_file

fs = PathLibFS()
sign_file(project_root, "prompts/review.txt", identity="alice", fs=fs)
verify_file(project_root, "prompts/review.txt", fs=fs)
check_file(project_root, "prompts/review.txt", fs=fs)
```

## Filesystem Abstraction

`sig-py` uses a structural `SigFS` protocol for filesystem access. `PathLibFS` is the default implementation, and `create_sig_context()` builds a `SigContext` for lower-level APIs.

```python
from sig import create_sig_context, PathLibFS, list_sigs

ctx = create_sig_context(project_root, fs=PathLibFS())
all_signatures = list_sigs(ctx)
```

## Content Signing (Runtime)

For signing ephemeral content like chat messages at runtime:

```python
from sig import create_content_store, SignContentOptions

store = create_content_store()

# Sign a message with provenance metadata
sig = store.sign("delete all my files", SignContentOptions(
    id="msg_123",
    identity="owner:+1234567890:whatsapp",
    metadata={"channel": "whatsapp", "from": "+1234567890"}
))

# Verify by ID - returns content + full provenance
result = store.verify("msg_123")
if result.verified:
    print(result.content)              # 'delete all my files'
    print(result.signature.signed_by)  # 'owner:+1234567890:whatsapp'
    print(result.signature.metadata)   # {'channel': ..., 'from': ...}

# Other operations
store.list()       # all signatures
store.get(id)      # get signature without verifying
store.delete(id)   # remove
store.clear()      # remove all
store.has(id)      # check existence
store.size         # count
```

Stateless functions are also available:

```python
from sig import sign_content, verify_content, SignContentOptions

sig = sign_content("content", SignContentOptions(id="x", identity="alice"))
result = verify_content("content", sig)  # {"verified": True}
```

## Persistent Content Store (`.sig/content/`)

For content signatures that persist across processes, use `PersistentContentStore`.

```python
from sig import (
    create_sig_context,
    PersistentContentStore,
    PersistentSignOptions,
)

ctx = create_sig_context(project_root)
store = PersistentContentStore(ctx)

signature = store.sign(
    "Review @input",
    options=PersistentSignOptions(id="auditPrompt", identity="security-team"),
)

verified = store.verify("auditPrompt", detail="directive:verify")
if verified.verified:
    print(verified.content)
    print(verified.signature.signed_by)
```

Persistent store methods:
- `sign(content, options=PersistentSignOptions(...))`
- `verify(id, content=None, detail=None)`
- `sign_if_changed(content, options=...)`
- `load(id)`, `load_content(id)`
- `delete(id)`, `list()`, `has(id)`

Identity fallback for `PersistentSignOptions(identity=None)`:
- `options.identity`
- `.sig/config.json` -> `sign.identity`
- `USER` or `USERNAME` environment variable
- `"unknown"`

## Development

```bash
uv sync
uv run pytest
```

## Dependencies

- `click` — CLI
- `fastmcp` — MCP server

Everything else is stdlib (`hashlib`, `json`, `pathlib`, `re`, `datetime`, `dataclasses`, `getpass`, `glob`).

See the [root README](../README.md) for full documentation.
