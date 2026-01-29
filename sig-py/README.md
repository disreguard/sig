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
