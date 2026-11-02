import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import * as vault from './vault.js'

const writeEnabled = process.env.PAPERCACHE_MCP_WRITE === '1'

const server = new McpServer({
  name: 'papercache',
  version: '0.1.0',
})

server.tool(
  'list_notes',
  'List note paths in the PaperCache vault (bounded, read-only).',
  {
    prefix: z.string().optional().describe('Optional folder prefix to filter by'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(vault.MAX_LIST_LIMIT)
      .optional()
      .default(vault.DEFAULT_LIST_LIMIT),
  },
  async ({ prefix, limit }) => {
    const notes = vault.listNotes(prefix, limit ?? vault.DEFAULT_LIST_LIMIT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(notes, null, 2) }] }
  },
)

server.tool(
  'search_notes',
  'Search note contents for a case-insensitive substring (bounded, read-only).',
  {
    query: z.string().min(1).describe('Substring to search for'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(vault.MAX_SEARCH_LIMIT)
      .optional()
      .default(vault.DEFAULT_SEARCH_LIMIT),
  },
  async ({ query, limit }) => {
    const hits = vault.searchNotes(query, limit ?? vault.DEFAULT_SEARCH_LIMIT)
    return { content: [{ type: 'text' as const, text: JSON.stringify(hits, null, 2) }] }
  },
)

server.tool(
  'read_note',
  'Read a single note by its vault-relative path (read-only).',
  { path: z.string().min(1).describe('Vault-relative path, e.g. "notes/hello.md"') },
  async ({ path: id }) => {
    const content = vault.readNote(id)
    return { content: [{ type: 'text' as const, text: content }] }
  },
)

if (writeEnabled) {
  server.tool(
    'create_note',
    'Create a new note (requires PAPERCACHE_MCP_WRITE=1).',
    {
      path: z.string().min(1).describe('Vault-relative .md path; must not already exist'),
      content: z.string().optional().default(''),
    },
    async ({ path: id, content }) => {
      const rel = vault.createNote(id, content)
      return { content: [{ type: 'text' as const, text: `created ${rel}` }] }
    },
  )

  server.tool(
    'update_note',
    'Update an existing note (requires write; optional content-hash precondition).',
    {
      path: z.string().min(1),
      content: z.string(),
      expected_hash: z
        .string()
        .optional()
        .describe('SHA-256 of current content; update is refused on mismatch'),
    },
    async ({ path: id, content, expected_hash }) => {
      vault.updateNote(id, content, expected_hash)
      return { content: [{ type: 'text' as const, text: `updated ${id}` }] }
    },
  )

  server.tool(
    'trash_note',
    'Move a note to the recoverable trash folder (requires write; never deletes).',
    { path: z.string().min(1) },
    async ({ path: id }) => {
      const rel = vault.trashNote(id)
      return { content: [{ type: 'text' as const, text: `trashed ${rel}` }] }
    },
  )
}

const transport = new StdioServerTransport()
await server.connect(transport)
