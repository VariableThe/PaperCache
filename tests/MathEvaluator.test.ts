import { describe, it, expect } from 'vitest'
import { MathEvaluator } from '../src/lib/editor/MathEvaluator'

describe('MathEvaluator', () => {
  it('evaluates new math expressions ending with =', async () => {
    const docStr = '1 + 2 =\n'
    const scope = {}
    const changes = await MathEvaluator.evaluateMathChanges(docStr, scope)
    expect(changes).toEqual([
      { from: 7, to: 7, insert: '\u200B3' }
    ])
  })

  it('updates existing evaluations if they changed', async () => {
    const docStr = '1 + 3 =\u200B3'
    const scope = {}
    const changes = await MathEvaluator.evaluateMathChanges(docStr, scope)
    expect(changes).toEqual([
      { from: 8, to: 9, insert: '4' }
    ])
  })

  it('ignores invalid expressions', async () => {
    const docStr = '1 + * 2 =\n'
    const scope = {}
    const changes = await MathEvaluator.evaluateMathChanges(docStr, scope)
    expect(changes).toEqual([])
  })

  it('ignores /var definitions', async () => {
    const docStr = '/var x = 10\n'
    const scope = {}
    const changes = await MathEvaluator.evaluateMathChanges(docStr, scope)
    expect(changes).toEqual([]) // Because it's a variable declaration, not a math expression to evaluate inline
  })

  it('uses provided scope', async () => {
    const docStr = 'x * 2 =\n'
    const scope = { x: 5 }
    const changes = await MathEvaluator.evaluateMathChanges(docStr, scope)
    expect(changes).toEqual([
      { from: 7, to: 7, insert: '\u200B10' }
    ])
  })
})
