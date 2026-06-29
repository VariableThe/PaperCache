const NUMBER = 'NUMBER'
const IDENTIFIER = 'IDENTIFIER'
const OPERATOR = 'OPERATOR'
const LPAREN = 'LPAREN'
const RPAREN = 'RPAREN'
const EOF = 'EOF'

type TokenType =
  | typeof NUMBER
  | typeof IDENTIFIER
  | typeof OPERATOR
  | typeof LPAREN
  | typeof RPAREN
  | typeof EOF

interface Token {
  type: TokenType
  value: string
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]!
    if (ch === ' ' || ch === '\t') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let num = ''
      let dotCount = 0
      while (i < input.length && ((input[i]! >= '0' && input[i]! <= '9') || input[i]! === '.')) {
        if (input[i]! === '.') dotCount++
        num += input[i]!
        i++
      }
      if (dotCount > 1) {
        throw new ParseError(`Invalid number: '${num}'`)
      }
      tokens.push({ type: NUMBER, value: num })
      continue
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = ''
      while (
        i < input.length &&
        ((input[i]! >= 'a' && input[i]! <= 'z') ||
          (input[i]! >= 'A' && input[i]! <= 'Z') ||
          (input[i]! >= '0' && input[i]! <= '9') ||
          input[i]! === '_')
      ) {
        ident += input[i]!
        i++
      }
      tokens.push({ type: IDENTIFIER, value: ident })
      continue
    }
    if ('+-*/%^'.includes(ch)) {
      tokens.push({ type: OPERATOR, value: ch })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: LPAREN, value: '(' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: RPAREN, value: ')' })
      i++
      continue
    }
    throw new ParseError(`Unexpected character: '${ch}'`)
  }
  tokens.push({ type: EOF, value: '' })
  return tokens
}

class Parser {
  tokens: Token[]
  pos: number
  scope: Record<string, unknown>

  constructor(tokens: Token[], scope: Record<string, unknown>) {
    this.tokens = tokens
    this.pos = 0
    this.scope = scope
  }

  peek(): Token {
    return this.tokens[this.pos]!
  }

  consume(): Token {
    return this.tokens[this.pos++]!
  }

  expect(type: TokenType): Token {
    const token = this.peek()
    if (token.type !== type) {
      throw new ParseError(`Expected ${type} but got ${token.type} ('${token.value}')`)
    }
    return this.consume()
  }

  parse(): number {
    const result = this.expression()
    if (this.peek().type !== EOF) {
      throw new ParseError(`Unexpected token: '${this.peek().value}'`)
    }
    return result
  }

  expression(): number {
    let left = this.term()
    while (
      this.peek().type === OPERATOR &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.consume().value
      const right = this.term()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  term(): number {
    let left = this.factor()
    while (
      this.peek().type === OPERATOR &&
      (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')
    ) {
      const op = this.consume().value
      const right = this.factor()
      switch (op) {
        case '*':
          left = left * right
          break
        case '/':
          if (right === 0) throw new ParseError('Division by zero')
          left = left / right
          break
        case '%':
          left = left % right
          break
      }
    }
    return left
  }

  factor(): number {
    return this.unary()
  }

  unary(): number {
    if (this.peek().type === OPERATOR && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value
      const right = this.unary()
      return op === '-' ? -right : right
    }
    return this.power()
  }

  power(): number {
    const left = this.primary()
    if (this.peek().type === OPERATOR && this.peek().value === '^') {
      this.consume()
      const right = this.power()
      return Math.pow(left, right)
    }
    return left
  }

  primary(): number {
    if (this.peek().type === NUMBER) {
      return parseFloat(this.consume().value)
    }
    if (this.peek().type === IDENTIFIER) {
      const name = this.consume().value
      if (!(name in this.scope)) {
        throw new ParseError(`Undefined variable: '${name}'`)
      }
      const val = this.scope[name]
      if (typeof val === 'number') return val
      const parsed = parseFloat(String(val))
      if (isNaN(parsed)) {
        throw new ParseError(`Variable '${name}' is not a number: ${val}`)
      }
      return parsed
    }
    if (this.peek().type === LPAREN) {
      this.consume()
      const result = this.expression()
      this.expect(RPAREN)
      return result
    }
    throw new ParseError(`Unexpected token: '${this.peek().value}'`)
  }
}

export function evaluate(expression: string, scope: Record<string, unknown> = {}): number {
  const tokens = tokenize(expression.trim())
  if (tokens.length === 1 && tokens[0]!.type === EOF) {
    throw new ParseError('Empty expression')
  }
  const parser = new Parser(tokens, scope)
  return parser.parse()
}
