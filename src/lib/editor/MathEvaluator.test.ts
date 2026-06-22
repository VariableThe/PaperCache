import { describe, it, expect, vitest } from 'vitest'
import { evaluateMath } from './MathEvaluator'

describe('MathEvaluator', () => {
  it('evaluates new math expressions ending with =', () => {
    const docStr = '1 + 2 =\n'
    const scope = {}
    const changes = evaluateMath(docStr, scope)
    expect(changes).toEqual([{ from: 7, to: 7, insert: '\u200B3' }])
  })

  it('updates existing evaluations if they changed', () => {
    const docStr = '1 + 3 =\u200B3'
    const scope = {}
    const changes = evaluateMath(docStr, scope)
    expect(changes).toEqual([{ from: 8, to: 9, insert: '4' }])
  })

  it('ignores invalid expressions', () => {
    const docStr = '1 + * 2 =\n'
    const scope = {}
    const consoleSpy = vitest.spyOn(console, 'error').mockImplementation(() => {})
    const changes = evaluateMath(docStr, scope)
    expect(changes).toEqual([])
    consoleSpy.mockRestore()
  })

  it('ignores /var definitions', () => {
    const docStr = '/var x = 10\n'
    const scope = {}
    const changes = evaluateMath(docStr, scope)
    expect(changes).toEqual([]) // Because it's a variable declaration, not a math expression to evaluate inline
  })

  it('uses provided scope', () => {
    const docStr = 'x * 2 =\n'
    const scope = { x: 5 }
    const changes = evaluateMath(docStr, scope)
    expect(changes).toEqual([{ from: 7, to: 7, insert: '\u200B10' }])
  })
})
