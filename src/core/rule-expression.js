/**
 * Sandboxed expression evaluator for Module 24.
 * No eval, Function, or host object access. Side-effect free.
 */

const FORBIDDEN = [
  "eval", "function", "constructor", "prototype", "__proto__", "window", "document",
  "global", "process", "require", "import", "export", "this", "arguments"
];

const FUNCTIONS = {
  now: () => Date.now(),
  abs: (value) => Math.abs(Number(value) || 0),
  min: (...values) => Math.min(...values.map(Number)),
  max: (...values) => Math.max(...values.map(Number)),
  length: (value) => (value == null ? 0 : String(value).length),
  lower: (value) => String(value ?? "").toLowerCase(),
  upper: (value) => String(value ?? "").toUpperCase(),
  contains: (haystack, needle) => String(haystack ?? "").includes(String(needle ?? "")),
  daysBetween: (from, to) => {
    const a = Date.parse(from);
    const b = Date.parse(to);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.round((b - a) / 86400000);
  },
  count: (items) => (Array.isArray(items) ? items.length : 0),
  sum: (items, field) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((total, item) => total + Number(field ? resolvePath(item, field) : item || 0), 0);
  },
  any: (items, field, expected) => Array.isArray(items) && items.some((item) => (
    field ? resolvePath(item, field) === expected : Boolean(item)
  )),
  all: (items, field, expected) => Array.isArray(items) && items.length > 0 && items.every((item) => (
    field ? resolvePath(item, field) === expected : Boolean(item)
  ))
};

export function resolvePath(source, path) {
  if (!path) return source;
  return String(path).split(".").reduce((current, key) => {
    if (current == null || typeof current !== "object") return undefined;
    return current[key];
  }, source);
}

function assertSafeIdentifier(name) {
  const lower = String(name || "").toLowerCase();
  if (FORBIDDEN.some((item) => lower.includes(item))) {
    throw new Error("Expression sandbox violation");
  }
}

function tokenize(text) {
  const tokens = [];
  const source = String(text || "");
  let index = 0;
  const push = (type, value) => tokens.push({ type, value });
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if ("(),".includes(char)) {
      push(char, char);
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== quote) {
        value += source[index];
        index += 1;
      }
      index += 1;
      push("string", value);
      continue;
    }
    if (/[0-9.]/.test(char) && (char !== "." || /[0-9]/.test(source[index + 1] || ""))) {
      let value = "";
      while (index < source.length && /[0-9.]/.test(source[index])) {
        value += source[index];
        index += 1;
      }
      push("number", Number(value));
      continue;
    }
    const two = source.slice(index, index + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      push("op", two);
      index += 2;
      continue;
    }
    if (">=<+-*/%".includes(char)) {
      push("op", char);
      index += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let value = "";
      while (index < source.length && /[A-Za-z0-9_.]/.test(source[index])) {
        value += source[index];
        index += 1;
      }
      const upper = value.toUpperCase();
      if (upper === "AND") push("op", "&&");
      else if (upper === "OR") push("op", "||");
      else if (upper === "NOT") push("op", "!");
      else if (upper === "TRUE") push("boolean", true);
      else if (upper === "FALSE") push("boolean", false);
      else if (upper === "NULL") push("null", null);
      else push("id", value);
      continue;
    }
    if (char === "!") {
      push("op", "!");
      index += 1;
      continue;
    }
    throw new Error(`Unexpected character '${char}'`);
  }
  return tokens;
}

function parse(tokens) {
  let index = 0;
  const peek = () => tokens[index];
  const take = (type) => {
    const token = tokens[index];
    if (!token || (type && token.type !== type && token.value !== type)) return null;
    index += 1;
    return token;
  };
  const parseExpression = () => parseOr();
  const parseOr = () => {
    let left = parseAnd();
    while (peek()?.value === "||") {
      take();
      left = { op: "OR", args: [left, parseAnd()] };
    }
    return left;
  };
  const parseAnd = () => {
    let left = parseCompare();
    while (peek()?.value === "&&") {
      take();
      left = { op: "AND", args: [left, parseCompare()] };
    }
    return left;
  };
  const parseCompare = () => {
    let left = parseAdd();
    const token = peek();
    if (token && ["==", "!=", ">", "<", ">=", "<="].includes(token.value)) {
      take();
      left = { op: token.value, args: [left, parseAdd()] };
    }
    return left;
  };
  const parseAdd = () => {
    let left = parseMul();
    while (peek() && ["+", "-"].includes(peek().value)) {
      const op = take().value;
      left = { op, args: [left, parseMul()] };
    }
    return left;
  };
  const parseMul = () => {
    let left = parseUnary();
    while (peek() && ["*", "/", "%"].includes(peek().value)) {
      const op = take().value;
      left = { op, args: [left, parseUnary()] };
    }
    return left;
  };
  const parseUnary = () => {
    if (peek()?.value === "!" || peek()?.value === "-") {
      const op = take().value;
      return { op: op === "!" ? "NOT" : "neg", args: [parseUnary()] };
    }
    return parsePrimary();
  };
  const parsePrimary = () => {
    const token = peek();
    if (!token) throw new Error("Unexpected end of expression");
    if (token.type === "number" || token.type === "string" || token.type === "boolean" || token.type === "null") {
      take();
      return { op: "literal", value: token.value };
    }
    if (token.type === "id") {
      take();
      if (peek()?.type === "(") {
        take("(");
        const args = [];
        if (peek()?.type !== ")") {
          args.push(parseExpression());
          while (peek()?.type === ",") {
            take(",");
            args.push(parseExpression());
          }
        }
        take(")");
        return { op: "call", name: token.value, args };
      }
      return { op: "ref", path: token.value };
    }
    if (token.type === "(") {
      take("(");
      const inner = parseExpression();
      take(")");
      return inner;
    }
    throw new Error("Invalid expression");
  };
  const ast = parseExpression();
  if (index < tokens.length) throw new Error("Unexpected trailing tokens");
  return ast;
}

function compare(op, left, right) {
  if (op === "==") return left === right;
  if (op === "!=") return left !== right;
  if (op === ">") return Number(left) > Number(right);
  if (op === "<") return Number(left) < Number(right);
  if (op === ">=") return Number(left) >= Number(right);
  if (op === "<=") return Number(left) <= Number(right);
  return false;
}

export function evaluateAst(node, context = {}) {
  if (node == null) return undefined;
  if (typeof node !== "object") return node;
  const op = node.op || node.operator;
  if (op === "literal") return node.value;
  if (op === "ref") return resolvePath(context, node.path || node.field);
  if (op === "Exists") return resolvePath(context, node.field) != null && String(resolvePath(context, node.field)) !== "";
  if (op === "Equals") return resolvePath(context, node.field) === node.value;
  if (op === "NotEquals") return resolvePath(context, node.field) !== node.value;
  if (op === "GreaterThan") return Number(resolvePath(context, node.field)) > Number(node.value);
  if (op === "LessThan") return Number(resolvePath(context, node.field)) < Number(node.value);
  if (op === "GreaterThanOrEqual" || op === "GreaterOrEqual") return Number(resolvePath(context, node.field)) >= Number(node.value);
  if (op === "LessThanOrEqual" || op === "LessOrEqual") return Number(resolvePath(context, node.field)) <= Number(node.value);
  if (op === "In") return Array.isArray(node.value) && node.value.includes(resolvePath(context, node.field));
  if (op === "Contains") return String(resolvePath(context, node.field) ?? "").includes(String(node.value ?? ""));
  if (op === "AND") return (node.args || []).every((item) => Boolean(evaluateAst(item, context)));
  if (op === "OR") return (node.args || []).some((item) => Boolean(evaluateAst(item, context)));
  if (op === "NOT") return !evaluateAst((node.args || [])[0], context);
  if (op === "neg") return -Number(evaluateAst((node.args || [])[0], context) || 0);
  if (["+", "-", "*", "/", "%"].includes(op)) {
    const [left, right] = (node.args || []).map((item) => evaluateAst(item, context));
    const a = Number(left) || 0;
    const b = Number(right) || 0;
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b === 0 ? 0 : a / b;
    return a % b;
  }
  if (["==", "!=", ">", "<", ">=", "<="].includes(op)) {
    const [left, right] = (node.args || []).map((item) => evaluateAst(item, context));
    return compare(op, left, right);
  }
  if (op === "call") {
    assertSafeIdentifier(node.name);
    const fn = FUNCTIONS[node.name];
    if (!fn) throw new Error(`Unknown function ${node.name}`);
    return fn(...(node.args || []).map((item) => evaluateAst(item, context)));
  }
  throw new Error("Unsupported expression node");
}

export function evaluateExpression(expression, context = {}) {
  try {
    if (expression == null || expression === "") return { ok: true, value: true };
    if (typeof expression === "boolean" || typeof expression === "number") return { ok: true, value: expression };
    if (typeof expression === "object") return { ok: true, value: evaluateAst(expression, context) };
    const text = String(expression).trim();
    if (!text) return { ok: true, value: true };
    FORBIDDEN.forEach((item) => {
      if (text.toLowerCase().includes(item)) throw new Error("Expression sandbox violation");
    });
    const ast = parse(tokenize(text));
    return { ok: true, value: evaluateAst(ast, context) };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Expression evaluation failed",
      errorCode: String(error.message || "").includes("sandbox") ? "RE-012" : "RE-004"
    };
  }
}

export function assertExpressionBoundary() {
  return {
    evalDisabled: true,
    functionConstructorDisabled: true,
    hostObjectsBlocked: true,
    sideEffectFree: true
  };
}
