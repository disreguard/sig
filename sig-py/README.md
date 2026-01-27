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
