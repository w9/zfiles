import type { ContextKeys } from "./contextKeys";
import { getContextValue } from "./contextKeys";

type Token =
  | { kind: "ident"; value: string }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ kind: "lparen" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ kind: "rparen" });
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      index += 1;
      let value = "";
      while (index < input.length && input[index] !== quote) {
        value += input[index];
        index += 1;
      }
      index += 1;
      tokens.push({ kind: "string", value });
      continue;
    }
    if (/[0-9]/.test(char)) {
      let value = "";
      while (index < input.length && /[0-9.]/.test(input[index])) {
        value += input[index];
        index += 1;
      }
      tokens.push({ kind: "number", value: Number(value) });
      continue;
    }
    const two = input.slice(index, index + 2);
    if (two === "&&" || two === "||" || two === "==" || two === "!=" || two === ">=" || two === "<=") {
      tokens.push({ kind: "op", value: two });
      index += 2;
      continue;
    }
    if (char === "!" || char === ">" || char === "<") {
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }
    let ident = "";
    while (index < input.length && /[A-Za-z0-9._-]/.test(input[index])) {
      ident += input[index];
      index += 1;
    }
    if (ident) {
      tokens.push({ kind: "ident", value: ident });
      continue;
    }
    throw new Error(`Unexpected token at ${index}`);
  }
  return tokens;
}

type Value = string | number | boolean | string[] | undefined;

function truthy(value: Value): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value.length > 0;
}

function compare(left: Value, right: Value, op: string): boolean {
  if (typeof left === "number" && typeof right === "number") {
    switch (op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
      case "<":
        return left < right;
      case "<=":
        return left <= right;
    }
  }
  if (typeof left === "string" && typeof right === "string") {
    switch (op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
    }
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    switch (op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
    }
  }
  return false;
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly context: ContextKeys,
  ) {}

  parse(): boolean {
    const value = this.parseOr();
    if (this.index < this.tokens.length) {
      throw new Error("Unexpected trailing tokens");
    }
    return truthy(value);
  }

  private parseOr(): Value {
    let value = this.parseAnd();
    while (this.match("||")) {
      const right = this.parseAnd();
      value = truthy(value) || truthy(right);
    }
    return value;
  }

  private parseAnd(): Value {
    let value = this.parseUnary();
    while (this.match("&&")) {
      const right = this.parseUnary();
      value = truthy(value) && truthy(right);
    }
    return value;
  }

  private parseUnary(): Value {
    if (this.match("!")) {
      return !truthy(this.parseUnary());
    }
    return this.parseComparison();
  }

  private parseComparison(): Value {
    const left = this.parsePrimary();
    const op = this.peekOp();
    if (!op || !["==", "!=", ">", ">=", "<", "<="].includes(op)) {
      return left;
    }
    this.index += 1;
    const right = this.parsePrimary();
    return compare(left, right, op);
  }

  private parsePrimary(): Value {
    const token = this.tokens[this.index];
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    if (token.kind === "number") {
      this.index += 1;
      return token.value;
    }
    if (token.kind === "string") {
      this.index += 1;
      return token.value;
    }
    if (token.kind === "ident") {
      this.index += 1;
      if (token.value === "true") {
        return true;
      }
      if (token.value === "false") {
        return false;
      }
      return getContextValue(this.context, token.value);
    }
    if (token.kind === "lparen") {
      this.index += 1;
      const value = this.parseOr();
      if (!this.match(")")) {
        throw new Error("Expected closing parenthesis");
      }
      return value;
    }
    throw new Error("Unexpected token");
  }

  private match(expected: string): boolean {
    const token = this.tokens[this.index];
    if (token?.kind === "op" && token.value === expected) {
      this.index += 1;
      return true;
    }
    if (expected === ")" && token?.kind === "rparen") {
      this.index += 1;
      return true;
    }
    return false;
  }

  private peekOp(): string | null {
    const token = this.tokens[this.index];
    return token?.kind === "op" ? token.value : null;
  }
}

export function evaluateWhen(
  expression: string | undefined,
  context: ContextKeys,
): boolean {
  if (!expression?.trim()) {
    return true;
  }
  try {
    const parser = new Parser(tokenize(expression), context);
    return parser.parse();
  } catch {
    return false;
  }
}

export function parseWhenExpression(
  expression: string,
  context: ContextKeys,
): boolean {
  const parser = new Parser(tokenize(expression), context);
  return parser.parse();
}
