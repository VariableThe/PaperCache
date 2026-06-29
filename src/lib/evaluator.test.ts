import { describe, it, expect } from 'vitest'
import { evaluate, ParseError } from './evaluator'

describe('evaluate', () => {
  it('adds two numbers', () => {
    expect(evaluate('2 + 3')).toBe(5)
  })

  it('subtracts two numbers', () => {
    expect(evaluate('10 - 3')).toBe(7)
  })

  it('multiplies two numbers', () => {
    expect(evaluate('4 * 5')).toBe(20)
  })

  it('divides two numbers', () => {
    expect(evaluate('15 / 3')).toBe(5)
  })

  it('respects operator precedence (multiplication before addition)', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14)
  })

  it('respects operator precedence (addition before multiplication with parens)', () => {
    expect(evaluate('(2 + 3) * 4')).toBe(20)
  })

  it('handles power operator', () => {
    expect(evaluate('2 ^ 3')).toBe(8)
  })

  it('handles modulo operator', () => {
    expect(evaluate('10 % 3')).toBe(1)
  })

  it('handles unary minus', () => {
    expect(evaluate('-5')).toBe(-5)
  })

  it('handles double unary minus', () => {
    expect(evaluate('--5')).toBe(5)
  })

  it('handles unary minus with parentheses', () => {
    expect(evaluate('-(3 + 4)')).toBe(-7)
  })

  it('evaluates expressions with variables', () => {
    expect(evaluate('x + 5', { x: 10 })).toBe(15)
  })

  it('evaluates expressions with multiple variables', () => {
    expect(evaluate('a * b + c', { a: 2, b: 3, c: 1 })).toBe(7)
  })

  it('evaluates chained operations', () => {
    expect(evaluate('2 * 3 + 4 * 5')).toBe(26)
  })

  it('handles decimal numbers', () => {
    expect(evaluate('3.5 * 2')).toBe(7)
  })

  it('handles nested parentheses', () => {
    expect(evaluate('((2 + 3) * 2)')).toBe(10)
  })

  it('handles whitespace', () => {
    expect(evaluate('  10  +  20  ')).toBe(30)
  })

  it('throws ParseError on empty expression', () => {
    expect(() => evaluate('')).toThrow(ParseError)
  })

  it('throws ParseError on undefined variable', () => {
    expect(() => evaluate('x + 1', {})).toThrow(ParseError)
  })

  it('throws ParseError on division by zero', () => {
    expect(() => evaluate('5 / 0')).toThrow(ParseError)
  })

  it('throws ParseError on invalid character', () => {
    expect(() => evaluate('2 @ 3')).toThrow(ParseError)
  })

  it('throws ParseError on mismatched parentheses', () => {
    expect(() => evaluate('(2 + 3')).toThrow(ParseError)
  })

  it('evaluates complex real-world expression', () => {
    expect(evaluate('10 + 5 * 3', {})).toBe(25)
  })

  it('evaluates expression with only a variable', () => {
    expect(evaluate('pi', { pi: 3.14 })).toBe(3.14)
  })

  it('handles unary plus', () => {
    expect(evaluate('+5')).toBe(5)
  })

  it('performs power before multiplication', () => {
    expect(evaluate('2 * 3 ^ 2')).toBe(18)
  })

  it('power is right-associative (2^3^2 = 2^(3^2) = 512)', () => {
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512)
  })

  it('unary minus binds looser than power (-2^2 = -(2^2) = -4)', () => {
    expect(evaluate('-2 ^ 2')).toBe(-4)
  })

  it('rejects malformed number with multiple dots', () => {
    expect(() => evaluate('1..2')).toThrow(ParseError)
  })
})
