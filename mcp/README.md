# PaperCache MCP Server

A local stdio [Model Context Protocol](https://modelcontextprotocol.io) server
that exposes a scoped, **read-only-by-default** view of a PaperCache vault. It
runs as a separate process and never registers itself with agent clients.

## Configuration

Environment variables:

- `PAPERCACHE_VAULT` — vault directory (default `~/.papercache`). The server
  reads and, when write is enabled, writes only inside this directory.
- `PAPERCACHE_MCP_WRITE` — set to `1` to enable the write tools
  (`create_note`, `update_note`, `trash_note`). Off by default.

## Building and running

```sh
cd mcp
npm install
npm run build
# read-only (default)
node dist/index.js
# with write access
PAPERCACHE_MCP_WRITE=1 node dist/index.js
```

To register it with an agent client, point the client's MCP config at the
`papercache-mcp` binary (or `node dist/index.js`) with the desired environment.
Registration is a manual, explicit step; this server never self-registers.

## Tools

### Read-only (always available)

| Tool          | Description                                                    | Bounds              |
| ------------- | -------------------------------------------------------------- | ------------------- |
| `list_notes`  | List note paths, optionally filtered by a folder prefix.        | ≤ 500 results       |
| `search_notes`| Case-insensitive substring search across note contents.          | ≤ 100 results       |
| `read_note`   | Read a single note by vault-relative path.                      | ≤ 1 MiB per note    |

### Write (opt-in via `PAPERCACHE_MCP_WRITE=1`)

| Tool          | Description                                                    | Safety              |
| ------------- | -------------------------------------------------------------- | ------------------- |
| `create_note` | Create a new `.md` note. Refuses to overwrite an existing path. | path + suffix check |
| `update_note` | Overwrite a note, with an optional SHA-256 `expected_hash` precondition. | optimistic concurrency |
| `trash_note`  | Move a note into `.papercache-trash/`. Never permanently deletes. | recoverable |

`trash_note` moves (never deletes) so a mistaken write is recoverable. It does
not empty the trash automatically.

## Security boundaries

- **Vault scope**: every path is resolved against the canonicalized vault root
  (symlinks in the root resolved). Note ids are vault-relative paths.
- **Path traversal**: `..`, absolute paths, backslashes, and NUL bytes are
  rejected before any filesystem access.
- **Symlink boundary**: the real path (after resolving symlinks) must stay
  inside the vault; a symlink pointing outside is refused on both read and write.
- **Note contents are untrusted data**: contents are returned as opaque text and
  are never executed or interpreted as instructions.
- **No network service**: this is a stdio server only. It never opens a socket or
  an HTTP listener.
- **No secrets**: it does not read or write the app keychain or API keys.

## Read-only vs. write-enabled

The default (read-only) mode cannot modify the vault. Write tools appear only
when `PAPERCACHE_MCP_WRITE=1` is set explicitly. Even in write mode, destructive
operations are limited to a recoverable trash move.

## Testing

Tests use temporary fixture vaults under the OS temp directory and never touch a
real vault:

```sh
cd mcp
npm test
```

The suite covers traversal/symlink rejection, oversized-input bounds, malformed
parameters, the content-hash precondition, and recoverable trash.
