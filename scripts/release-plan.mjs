import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function fail(message) {
  throw new Error(message)
}

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.error) fail('Could not start Git: ' + result.error.message)
  return result
}

function versionOf(path) {
  return JSON.parse(readFileSync(path, 'utf8')).version
}

function planRelease() {
  const { GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_SHA: expectedSha } = process.env
  if (!['push', 'workflow_dispatch'].includes(event) || ref !== 'refs/heads/main') {
    fail('Releases must run from main via push or workflow dispatch.')
  }

  const version = versionOf('package.json')
  const validVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  if (typeof version !== 'string' || !validVersion.test(version)) {
    fail('package.json must contain a valid release version.')
  }
  if (version !== versionOf('src-tauri/tauri.conf.json')) {
    fail('package.json and tauri.conf.json release versions must match.')
  }

  const head = git('rev-parse', '--verify', 'HEAD^{commit}')
  const sha = head.stdout.trim()
  const validSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
  if (head.status !== 0 || !validSha.test(sha) || sha !== expectedSha) {
    fail('Checkout does not match the workflow commit.')
  }

  const tag = 'v' + version
  const tagRef = 'refs/tags/' + tag
  const peeledRef = tagRef + '^{}'
  const lookup = git('ls-remote', '--exit-code', 'origin', tagRef, peeledRef)
  if (lookup.status !== 0 && lookup.status !== 2) {
    fail('Failed to read the release tag from origin (Git exit ' + lookup.status + ').')
  }

  let needsTag = true
  let buildRelease = true
  if (lookup.status === 0) {
    const refs = new Map()
    for (const line of lookup.stdout.trim().split('\n')) {
      const [hash, name, extra] = line.split(/\s+/)
      if (!validSha.test(hash) || ![tagRef, peeledRef].includes(name) || extra || refs.has(name)) {
        fail('Unexpected release tag response from origin.')
      }
      refs.set(name, hash)
    }
    if (!refs.has(tagRef)) fail('Origin returned no exact release tag.')
    needsTag = false
    const tagCommit = refs.get(peeledRef) ?? refs.get(tagRef)
    if (tagCommit !== sha) {
      if (event === 'workflow_dispatch') {
        fail('Existing tag ' + tag + ' points to another commit; refusing to publish under it.')
      }
      console.error('Skipping release: ' + tag + ' already points to another commit.')
      buildRelease = false
    }
  }

  return {
    new_version: version,
    new_tag: tag,
    release_sha: sha,
    needs_tag: needsTag,
    build_release: buildRelease,
  }
}

try {
  for (const [key, value] of Object.entries(planRelease())) console.log(key + '=' + value)
} catch (error) {
  console.error('Release plan: ' + error.message)
  process.exitCode = 1
}
