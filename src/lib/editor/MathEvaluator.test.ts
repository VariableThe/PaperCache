import { expect, test } from 'vitest'
import { evaluateMath } from './MathEvaluator'

test('evaluates simple math', () => {
  const changes = evaluateMath('25 * 4 =', {})
  expect(changes.length).toBe(1)
  expect(changes[0].insert).toBe('\u200B100')
})

test('re-evaluates existing math', () => {
  const changes = evaluateMath('25 * 5 =\u200B100', {})
  expect(changes.length).toBe(1)
  expect(changes[0].insert).toBe('125')
})
