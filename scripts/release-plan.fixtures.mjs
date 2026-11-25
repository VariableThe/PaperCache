import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const script = fileURLToPath(new URL('./release-plan.mjs', import.meta.url))
const mainRef = 'refs/heads/main'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'papercache-release-plan-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'source')
  const remote = join(root, 'origin')
  const gitHome = join(root, 'home')
  mkdirSync(repo)
  mkdirSync(remote)
  mkdirSync(gitHome)
  const env = {
    ...process.env,
    HOME: gitHome,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  }
  const rawGit = (cwd, ...args) => spawnSync('git', args, { cwd, env, encoding: 'utf8' })
  const git = (cwd, ...args) => {
    const result = rawGit(cwd, ...args)
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git(repo, 'init', '--initial-branch=main')
  mkdirSync(join(repo, 'src-tauri'))
  const writeVersion = (path, version) => writeFileSync(join(repo, path), JSON.stringify({ version }))
  writeVersion('package.json', '0.5.9')
  writeVersion('src-tauri/tauri.conf.json', '0.5.9')
  git(repo, 'add', '.')
  git(repo, 'commit', '-m', 'Release commit')
  const earlier = git(repo, 'rev-parse', 'HEAD')
  git(repo, 'commit', '--allow-empty', '-m', 'Later same-version commit')
  const head = git(repo, 'rev-parse', 'HEAD')
  git(root, 'clone', '--bare', '--local', repo, remote)
  git(repo, 'remote', 'add', 'origin', remote)
  const run = (overrides = {}) => spawnSync(process.execPath, [script], {
    cwd: repo,
    env: { ...env, GITHUB_REF: mainRef, GITHUB_EVENT_NAME: 'push', GITHUB_SHA: head, ...overrides },
    encoding: 'utf8',
  })
  return { repo, remote, earlier, head, git, writeVersion, run }
}

function values(result) {
  assert.equal(result.status, 0, result.stderr)
  return Object.fromEntries(result.stdout.trim().split('\n').map((entry) => entry.split('=')))
}

test('a missing tag is planned for the exact checkout, never created by the planner', (t) => {
  const f = fixture(t)
  assert.deepEqual(values(f.run()), {
    new_version: '0.5.9',
    new_tag: 'v0.5.9',
    release_sha: f.head,
    needs_tag: 'true',
    build_release: 'true',
  })
  assert.equal(f.git(f.remote, 'tag', '--list'), '')
})

test('an annotated tag at this commit allows the exact same build without rewriting the tag', (t) => {
  const f = fixture(t)
  f.git(f.remote, 'tag', '-a', 'v0.5.9', f.head, '-m', 'Fixture release')
  const planned = values(f.run({ GITHUB_EVENT_NAME: 'workflow_dispatch' }))
  assert.equal(planned.release_sha, f.head)
  assert.equal(planned.needs_tag, 'false')
  assert.equal(planned.build_release, 'true')
})

test('a lightweight tag at this commit does not need to be rewritten', (t) => {
  const f = fixture(t)
  f.git(f.remote, 'tag', 'v0.5.9', f.head)
  const planned = values(f.run())
  assert.equal(planned.needs_tag, 'false')
  assert.equal(planned.build_release, 'true')
})

test('a later push with the same package version skips an existing release', (t) => {
  const f = fixture(t)
  f.git(f.remote, 'tag', '-a', 'v0.5.9', f.earlier, '-m', 'Fixture release')
  const result = f.run()
  const planned = values(result)
  assert.equal(planned.needs_tag, 'false')
  assert.equal(planned.build_release, 'false')
  assert.match(result.stderr, /Skipping release/)
  assert.equal(f.git(f.remote, 'rev-parse', 'v0.5.9^{commit}'), f.earlier)
})

test('manual dispatch on a different commit refuses to use an existing release tag', (t) => {
  const f = fixture(t)
  f.git(f.remote, 'tag', 'v0.5.9', f.earlier)
  const result = f.run({ GITHUB_EVENT_NAME: 'workflow_dispatch' })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /points to another commit/)
})

test('a failing origin is not mistaken for a missing tag', (t) => {
  const f = fixture(t)
  f.git(f.repo, 'remote', 'set-url', 'origin', join(f.repo, 'missing-remote'))
  const result = f.run()
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Failed to read the release tag/)
})

test('mismatched app and Tauri versions fail before publishing decisions', (t) => {
  const f = fixture(t)
  f.writeVersion('src-tauri/tauri.conf.json', '0.5.10')
  const result = f.run()
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /release versions must match/)
})

test('an invalid package version cannot become an output or tag', (t) => {
  const f = fixture(t)
  f.writeVersion('package.json', '0.5.9\nother=value')
  const result = f.run()
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /valid release version/)
})

test('a mismatched checked-out commit refuses to publish', (t) => {
  const f = fixture(t)
  const result = f.run({ GITHUB_SHA: f.earlier })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /does not match the workflow commit/)
})

test('a manual run on a non-main ref refuses to publish', (t) => {
  const f = fixture(t)
  const result = f.run({ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/feature' })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /must run from main/)
})
