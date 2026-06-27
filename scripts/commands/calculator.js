import { world } from "@minecraft/server";

const OPERATORS = {
  "+": { precedence: 1, assoc: "left", argc: 2 },
  "-": { precedence: 1, assoc: "left", argc: 2 },
  "*": { precedence: 2, assoc: "left", argc: 2 },
  "/": { precedence: 2, assoc: "left", argc: 2 },
  "%": { precedence: 2, assoc: "left", argc: 2 },
  "^": { precedence: 3, assoc: "right", argc: 2 },
  "u-": { precedence: 4, assoc: "right", argc: 1 },
  "u+": { precedence: 4, assoc: "right", argc: 1 },
};

function tokenize(expression) {
  const text = String(expression ?? "").replace(/\s+/g, "");
  const tokens = [];

  for (let index = 0; index < text.length; ) {
    const ch = text[index];

    if (/\d|\./.test(ch)) {
      let next = index + 1;
      while (next < text.length && /[\d.]/.test(text[next])) next++;
      const raw = text.slice(index, next);
      if (!/^\d*\.?\d+$/.test(raw) && !/^\d+\.?\d*$/.test(raw)) {
        throw new Error(`Bad number: ${raw}`);
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Bad number: ${raw}`);
      tokens.push({ type: "number", value });
      index = next;
      continue;
    }

    if (OPERATORS[ch]) {
      tokens.push({ type: "operator", value: ch });
      index++;
      continue;
    }

    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      index++;
      continue;
    }

    throw new Error(`Bad character: ${ch}`);
  }

  return tokens;
}

function toRpn(tokens) {
  const output = [];
  const stack = [];
  let prevType = "start";

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
      prevType = "number";
      continue;
    }

    if (token.type === "operator") {
      let op = token.value;
      if ((op === "+" || op === "-") && (prevType === "start" || prevType === "operator" || prevType === "lparen")) {
        op = op === "+" ? "u+" : "u-";
      }

      const info = OPERATORS[op];
      if (!info) throw new Error(`Unsupported operator: ${op}`);

      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "operator") break;
        const topInfo = OPERATORS[top.value];
        const shouldPop =
          (info.assoc === "left" && info.precedence <= topInfo.precedence) ||
          (info.assoc === "right" && info.precedence < topInfo.precedence);
        if (!shouldPop) break;
        output.push(stack.pop());
      }

      stack.push({ type: "operator", value: op });
      prevType = "operator";
      continue;
    }

    if (token.type === "paren" && token.value === "(") {
      stack.push(token);
      prevType = "lparen";
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      let found = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === "paren" && top.value === "(") {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) throw new Error("Mismatched parentheses");
      prevType = "number";
    }
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.type === "paren") throw new Error("Mismatched parentheses");
    output.push(top);
  }

  return output;
}

function evalRpn(tokens) {
  const stack = [];

  for (const token of tokens) {
    if (token.type === "number") {
      stack.push(token.value);
      continue;
    }

    const info = OPERATORS[token.value];
    if (!info) throw new Error(`Unsupported operator: ${token.value}`);

    if (stack.length < info.argc) throw new Error("Invalid expression");

    if (info.argc === 1) {
      const value = stack.pop();
      stack.push(token.value === "u-" ? -value : value);
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();

    if ((token.value === "/" || token.value === "%") && right === 0) {
      throw new Error("Cannot divide by zero");
    }

    let result = 0;
    switch (token.value) {
      case "+":
        result = left + right;
        break;
      case "-":
        result = left - right;
        break;
      case "*":
        result = left * right;
        break;
      case "/":
        result = left / right;
        break;
      case "%":
        result = left % right;
        break;
      case "^":
        result = left ** right;
        break;
      default:
        throw new Error(`Unsupported operator: ${token.value}`);
    }

    if (!Number.isFinite(result)) throw new Error("Result is not finite");
    stack.push(result);
  }

  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}

function evaluateExpression(expression) {
  const tokens = tokenize(expression);
  if (!tokens.length) throw new Error("Empty expression");
  return evalRpn(toRpn(tokens));
}

function formatResult(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1e12) / 1e12);
}

function runCalculator({ player, args, usage }) {
  const expression = String(args.join(" ") ?? "").trim();
  if (!expression) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  try {
    const result = evaluateExpression(expression);
    world.sendMessage(`${player.name} calculated ${expression} = ${formatResult(result)}`);
  } catch (error) {
    player.sendMessage(`Calculator error: ${error?.message ?? error}`);
  }
}

export const calculatorCommand = {
  name: "calculator",
  minRank: 0,
  usage: ":calculator <expression>",
  description: "Simple math in chat.",
  examples: [
    ":calculator 64*27",
    ":calculator (10+5)/3",
    ":calculator 2^8",
  ],

  execute({ player, args }) {
    runCalculator({ player, args, usage: this.usage });
  },
};

export const calcCommand = {
  ...calculatorCommand,
  name: "calc",
  usage: ":calc <expression>",
  description: "Alias of :calculator.",
  examples: [
    ":calc 64*27",
    ":calc (10+5)/3",
    ":calc 2^8",
  ],
};
