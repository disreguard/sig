# sig

Sign and verify prompt templates so AI agents can confirm their instructions are authentic.

## The Problem

Prompt injection can manipulate what an LLM *decides* to do. If an attacker injects "ignore previous instructions" into data an agent processes, the agent may comply. No amount of prompt engineering reliably prevents this.

## The Insight

sig signs the *template* (your instructions with placeholders intact), not the interpolated result. When an agent verifies, it gets back the stored signed content and can compare it to what it was told. If they match, the instructions haven't been tampered with.

```
Developer signs:     "Review {{code}} for security issues."
                          ↓
Agent receives:      "Review {{code}} for security issues."
                          ↓
Agent calls verify → gets back the signed original
                          ↓
Match? → Instructions are authentic. Proceed.
```

The key: the **orchestrator** controls what gets verified (via `SIG_VERIFY` env var), not the agent. The agent can't be tricked into verifying the wrong thing or skipping verification.

## Usage

```bash
# Initialize a project
sig init --engine jinja

# Sign templates
sig sign prompts/*.txt --by alice

# Verify a template
sig verify prompts/review.txt
# → verified prompts/review.txt
# →   hash:      sha256:ba6b07b9...
# →   signed by: alice
# →   placeholders: {{ code }}

# Check status of all signed files
sig check

# Modify a file, then check again
sig check
# → MODIFIED  prompts/review.txt
```

## MCP Server

sig ships an MCP server so agents can verify instructions in-band:

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

The agent calls the `verify` tool and gets back the authenticated template content, hash, signer identity, and extracted placeholders.

### Tools

| Tool | Description |
|------|-------------|
| `verify` | Verify a template signature. When `SIG_VERIFY` env var is set, verifies those files and ignores any `file` parameter. Falls back to `file` parameter otherwise. |
| `list_signed` | List all signed files and their status. |
| `check` | Check if a specific file is signed or modified. |

## Template Engines

sig understands placeholder syntax for common template engines, used to extract and display placeholders in verification results:

`jinja` · `mustache` · `handlebars` · `jsx` · `js-template` · `bash` · `mlld` · `claude` · `erb` · `go-template` · `python-fstring`

Configure in `.sig/config.json`:

```json
{
  "version": 1,
  "templates": {
    "engine": "jinja"
  },
  "sign": {
    "identity": "alice"
  }
}
```

Custom patterns are also supported:

```json
{
  "templates": {
    "custom": [
      { "name": "my-format", "patterns": ["%%\\w+%%"] }
    ]
  }
}
```

## How It Works

1. **Sign**: `sig sign` hashes the file content (SHA-256) and stores both the hash and the content in `.sig/sigs/`
2. **Verify**: `sig verify` re-hashes the live file, compares to the stored hash, and returns the *stored* signed content (not the live file)
3. **Audit**: Every sign and verify event is logged to `.sig/audit.jsonl`

The signing model is content-hash based. If a file changes, verification fails. Re-sign after intentional changes.

## Security Model

sig v1 uses **content hashing** (SHA-256), not cryptographic signatures with keys. This means:

- sig detects whether a template has been **modified** since it was signed
- sig provides **provenance** (who signed it, when)
- sig does **not** prevent forgery — anyone with write access to `.sig/` could re-sign a modified file

For the intended use case (developer signs at authoring time, agent verifies at runtime), this works well when `.sig/` is read-only to the agent. For environments where the agent has write access to the project directory, content hashing alone is not sufficient to prevent a compromised agent from re-signing tampered content.

Keyed signing (HMAC or asymmetric signatures) may be added in a future release if there is demand for forgery resistance.

## Integration Pattern

For any agent framework:

1. Developer writes templates and signs them with `sig sign`
2. Orchestrator sets `SIG_VERIFY=template-name` in the agent's environment
3. Orchestrator prepends verification instructions to the prompt
4. Agent calls the `verify` MCP tool, gets authenticated content
5. Agent compares what it was given to the verified original
6. If they match, instructions are authentic — proceed with confidence

## Implementations

| Directory | Language | Status |
|-----------|----------|--------|
| `sig-ts` | TypeScript | Complete |
| `sig-py` | Python | Planned |
| `sig-go` | Go | Planned |
| `sig-rs` | Rust | Planned |

All implementations share the same `.sig/` storage format, CLI interface, and MCP server protocol.

## License

MIT
