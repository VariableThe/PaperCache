import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createHash } from 'node:crypto'

export const MAX_NOTE_BYTES = 1_000_000 // 1 MiB per note read
export const DEFAULT_LIST_LIMIT = 100
export const MAX_LIST_LIMIT = 500
export const DEFAULT_SEARCH_LIMIT = 20
export const MAX_SEARCH_LIMIT = 100
export const TRASH_DIR_NAME = '.papercache-trash'

export interface NoteRef {
  id: string
  mtimeMs: number
  bytes: number
}

export interface SearchHit {
  id: string
  snippet: string
}

export function defaultVaultDir(): string {
  return process.env.PAPERCACHE_VAULT || path.join(os.homedir(), '.papercache')
}

/** Canonical vault root (creates it if missing, then resolves symlinks). */
export function resolveVaultRoot(): string {
  const abs = path.resolve(defaultVaultDir())
  fs.mkdirSync(abs, { recursive: true })
  return fs.realpathSync(abs)
}

/**
 * Reject note ids that could escape the vault. Note ids are vault-relative
 * paths using `/` separators. Backslashes, NUL bytes, absolute paths, and any
 * `..` segment are rejected. The returned value is a normalized relative path.
 */
export function validateNoteId(id: string): string {
  if (typeof id !== 'string' || id.length === 0) throw new Error('empty note path')
  if (id.length > 4096) throw new Error('note path too long')
  if (id.includes('\0')) throw new Error('NUL byte in note path')
  if (id.includes('\\')) throw new Error('backslash not allowed in note path')
  if (path.isAbsolute(id)) throw new Error('absolute path not allowed')

  const normalized = path.posix.normalize(id)
  const segments = normalized.split('/')
  if (segments.some((s) => s === '..')) throw new Error('path traversal not allowed')
  if (normalized === '..') throw new Error('path traversal not allowed')
  return normalized
}

/**
 * Resolve a validated note id to an absolute path under the vault, enforcing
 * that the real path (after resolving any symlinks) stays inside the vault.
 */
export function resolveWithinVault(vaultRoot: string, id: string): string {
  const rel = validateNoteId(id)
  const candidate = path.join(vaultRoot, ...rel.split('/'))
  const parent = path.dirname(candidate)
  const realParent = fs.realpathSync(parent)
  if (!isWithin(vaultRoot, realParent)) throw new Error('path escapes vault (symlink)')
  return path.join(realParent, path.basename(candidate))
}

export function resolveForRead(vaultRoot: string, id: string): string {
  const abs = resolveWithinVault(vaultRoot, id)
  if (!fs.existsSync(abs)) throw new Error(`note not found: ${id}`)
  const real = fs.realpathSync(abs)
  if (!isWithin(vaultRoot, real)) throw new Error('path escapes vault (symlink)')
  return real
}

export function isWithin(vaultRoot: string, candidate: string): boolean {
  return candidate === vaultRoot || candidate.startsWith(vaultRoot + path.sep)
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isNoteFile(name: string): boolean {
  return name.endsWith('.md') || name.endsWith('.json')
}

/** Recursively collect note ids (relative paths) under the vault, bounded. */
export function listNotes(prefix?: string, limit = DEFAULT_LIST_LIMIT): NoteRef[] {
  const vaultRoot = resolveVaultRoot()
  const limitN = clampInt(limit, 1, MAX_LIST_LIMIT)

  const out: NoteRef[] = []
  const walk = (dir: string, relBase: string): void => {
    if (out.length >= limitN) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (out.length >= limitN) return
      if (e.name === TRASH_DIR_NAME || e.name.startsWith('.papercache')) continue
      const rel = relBase ? `${relBase}/${e.name}` : e.name
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        // Descend when there is no prefix, or when this directory lies on or
        // under the prefix (a directory like "notes" is an ancestor of "notes/").
        if (!prefix || rel.startsWith(prefix) || prefix.startsWith(rel + '/')) {
          walk(abs, rel)
        }
      } else if (e.isFile() && isNoteFile(e.name)) {
        if (!prefix || rel.startsWith(prefix)) {
          const st = fs.statSync(abs)
          out.push({ id: rel, mtimeMs: st.mtimeMs, bytes: st.size })
        }
      }
    }
  }
  walk(vaultRoot, '')
  return out
}

/** Case-insensitive substring search across note contents, bounded. */
export function searchNotes(query: string, limit = DEFAULT_SEARCH_LIMIT): SearchHit[] {
  const vaultRoot = resolveVaultRoot()
  const limitN = clampInt(limit, 1, MAX_SEARCH_LIMIT)
  const q = query.toLowerCase()
  const hits: SearchHit[] = []

  for (const note of listNotes(undefined, MAX_LIST_LIMIT)) {
    if (hits.length >= limitN) break
    let content: string
    try {
      const abs = resolveForRead(vaultRoot, note.id)
      if (fs.statSync(abs).size > MAX_NOTE_BYTES) continue
      content = fs.readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    const lower = content.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) continue
    const start = Math.max(0, idx - 40)
    const end = Math.min(content.length, idx + q.length + 80)
    hits.push({ id: note.id, snippet: content.slice(start, end) })
  }
  return hits
}

export function readNote(id: string): string {
  const vaultRoot = resolveVaultRoot()
  const abs = resolveForRead(vaultRoot, id)
  if (fs.statSync(abs).size > MAX_NOTE_BYTES) throw new Error('note too large to read')
  return fs.readFileSync(abs, 'utf8')
}

export function createNote(id: string, content: string): string {
  const vaultRoot = resolveVaultRoot()
  const rel = validateNoteId(id)
  if (!rel.endsWith('.md')) throw new Error('new notes must have a .md suffix')
  assertWritableSize(content)
  const abs = resolveWithinVault(vaultRoot, rel)
  if (fs.existsSync(abs)) throw new Error(`note already exists: ${id}`)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
  return rel
}

export function updateNote(id: string, content: string, expectedHash?: string): string {
  const vaultRoot = resolveVaultRoot()
  const abs = resolveForRead(vaultRoot, id)
  assertWritableSize(content)
  if (expectedHash) {
    const current = fs.readFileSync(abs)
    if (sha256(current) !== expectedHash) {
      throw new Error('content changed since expected_hash; refusing to overwrite')
    }
  }
  fs.writeFileSync(abs, content, 'utf8')
  return id
}

function assertWritableSize(content: string): void {
  if (Buffer.byteLength(content, 'utf8') > MAX_NOTE_BYTES) {
    throw new Error('note too large to write')
  }
}

/** Move a note into a recoverable trash folder; never permanently delete. */
export function trashNote(id: string): string {
  const vaultRoot = resolveVaultRoot()
  const abs = resolveForRead(vaultRoot, id)
  const trashDir = path.join(vaultRoot, TRASH_DIR_NAME)
  fs.mkdirSync(trashDir, { recursive: true })
  const rel = validateNoteId(id)
  const dest = path.join(trashDir, ...rel.split('/'))
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  // Avoid clobbering an existing trashed file by suffixing a timestamp.
  const finalDest = fs.existsSync(dest) ? `${dest}.${Date.now()}` : dest
  fs.renameSync(abs, finalDest)
  return rel
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.floor(v)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
