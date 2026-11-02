import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import * as vault from '../src/vault.js'

let dir: string
let root: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-mcp-'))
  process.env.PAPERCACHE_VAULT = dir
  fs.writeFileSync(path.join(dir, 'hello.md'), '# Hello\n\nWorld\n')
  fs.mkdirSync(path.join(dir, 'notes'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'notes', 'a.md'), 'apple and banana')
  fs.writeFileSync(path.join(dir, 'notes', 'b.md'), 'just banana')
  root = vault.resolveVaultRoot()
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  delete process.env.PAPERCACHE_VAULT
})

describe('listNotes', () => {
  it('lists note ids recursively', () => {
    const ids = vault.listNotes().map((n) => n.id).sort()
    expect(ids).toEqual(['hello.md', 'notes/a.md', 'notes/b.md'])
  })

  it('filters by prefix and respects limit', () => {
    const ids = vault.listNotes('notes/').map((n) => n.id)
    expect(ids).toEqual(['notes/a.md', 'notes/b.md'])
    expect(vault.listNotes(undefined, 2)).toHaveLength(2)
  })
})

describe('searchNotes', () => {
  it('finds a case-insensitive substring', () => {
    const hits = vault.searchNotes('BANANA')
    expect(hits.map((h) => h.id).sort()).toEqual(['notes/a.md', 'notes/b.md'])
  })
})

describe('readNote', () => {
  it('returns note content', () => {
    expect(vault.readNote('hello.md')).toBe('# Hello\n\nWorld\n')
  })
})

describe('validateNoteId / path safety', () => {
  it.each([
    '../escape.md',
    '..',
    'a/../../b.md',
    '/etc/passwd',
    'a\\b.md',
    'a\0b.md',
    '',
  ])('rejects unsafe id %j', (id) => {
    expect(() => vault.validateNoteId(id)).toThrow()
  })

  it('accepts a normal relative path', () => {
    expect(vault.validateNoteId('notes/a.md')).toBe('notes/a.md')
  })
})

describe('symlink boundary', () => {
  it('rejects a symlink that escapes the vault', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-out-'))
    fs.writeFileSync(path.join(outside, 'secret.md'), 'secret')
    fs.symlinkSync(outside, path.join(dir, 'link'))
    expect(() => vault.readNote('link/secret.md')).toThrow(/escapes vault/)
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('allows a symlink that stays inside the vault', () => {
    fs.symlinkSync(path.join(dir, 'hello.md'), path.join(dir, 'alias.md'))
    expect(vault.readNote('alias.md')).toBe('# Hello\n\nWorld\n')
  })
})

describe('write tools (vault-level)', () => {
  it('createNote refuses existing paths and non-.md', () => {
    expect(() => vault.createNote('hello.md', 'x')).toThrow(/exists/)
    expect(() => vault.createNote('noext', 'x')).toThrow(/\.md/)
    vault.createNote('new.md', 'new body')
    expect(vault.readNote('new.md')).toBe('new body')
  })

  it('updateNote enforces the content-hash precondition', () => {
    expect(() => vault.updateNote('hello.md', 'x', '0000deadbeef')).toThrow(/changed/)
    vault.updateNote('hello.md', 'changed', undefined)
    expect(vault.readNote('hello.md')).toBe('changed')
  })

  it('trashNote moves to a recoverable trash folder', () => {
    vault.trashNote('hello.md')
    expect(() => vault.readNote('hello.md')).toThrow(/not found/)
    const trash = path.join(dir, vault.TRASH_DIR_NAME)
    expect(fs.readdirSync(trash)).toContain('hello.md')
  })
})
