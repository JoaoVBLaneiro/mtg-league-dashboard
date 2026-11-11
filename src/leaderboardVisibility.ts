/** Critérios públicos de visibilidade; expressões interpretadas sem eval/Function. */
export type VisibilityRule = {
  mode: "fixed" | "expression";
  minimumGames: number;
  expression: string;
};
export type VisibilityConfig = {
  players: VisibilityRule;
  decks: VisibilityRule;
  configured: string[];
};
export type VisibilityEntry = {
  partidas: number;
  vitorias: number;
  derrotas: number;
  winrate: number;
};
const API = "https://api.corneliomove.com.br/mtg-api";
export const DEFAULT_VISIBILITY: VisibilityConfig = {
  players: { mode: "fixed", minimumGames: 4, expression: "" },
  decks: { mode: "fixed", minimumGames: 0, expression: "" },
  configured: [],
};

export async function fetchVisibilityConfig(): Promise<VisibilityConfig> {
  const response = await fetch(`${API}/api/leaderboard/visibility`, { cache: "no-store" });
  if (!response.ok) throw new Error("Falha ao consultar os critérios do ranking.");
  const data = await response.json() as VisibilityConfig;
  if (!data.players || !data.decks) throw new Error("Critérios inválidos.");
  return data;
}

export async function saveVisibilityConfig(token: string, config: VisibilityConfig) {
  const response = await fetch(`${API}/api/admin/leaderboard/visibility`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ players: config.players, decks: config.decks }),
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Falha ao salvar critérios.");
}

const FUNCTIONS: Record<string, (...numbers: number[]) => number> = {
  min: (...v) => Math.min(...v),
  max: (...v) => Math.max(...v),
  ceil: (v) => Math.ceil(v),
  floor: (v) => Math.floor(v),
  round: (v) => Math.round(v),
  abs: (v) => Math.abs(v),
};

/** Permite aritmética, comparação, &&, || e min/max/ceil/floor/round/abs.
 * Não há JS arbitrário, propriedades ou variáveis externas. */
export function evaluateVisibilityExpression(expression: string, vars: Record<string, number>): number {
  const input = expression.trim();
  if (!input || input.length > 240) throw new Error("Expressão vazia ou longa demais.");
  const pattern = /(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z_0-9]*|>=|<=|==|!=|&&|\|\||[+\-*/%(),!<>])/g;
  const tokens = input.match(pattern) ?? [];
  if (tokens.join("") !== input.replace(/\s+/g, "")) throw new Error("Expressão contém caracteres inválidos.");
  let position = 0;
  const peek = () => tokens[position];
  const take = (value?: string) => {
    if (value && peek() !== value) throw new Error(`Esperado: ${value}`);
    return tokens[position++];
  };
  function primary(): number {
    if (takeIf("(")) { const value = logicalOr(); take(")"); return value; }
    const token = take();
    if (!token) throw new Error("Expressão incompleta.");
    if (/^\d/.test(token)) return Number(token);
    if (/^[A-Za-z_]/.test(token)) {
      if (takeIf("(")) {
        const fn = FUNCTIONS[token];
        if (!fn) throw new Error(`Função não permitida: ${token}`);
        const args: number[] = [];
        if (peek() !== ")") {
          args.push(logicalOr());
          while (takeIf(",")) args.push(logicalOr());
        }
        take(")");
        if (!args.length || (token !== "min" && token !== "max" && args.length !== 1)) throw new Error("Quantidade incorreta de argumentos.");
        return fn(...args);
      }
      if (!Object.prototype.hasOwnProperty.call(vars, token)) throw new Error(`Variável desconhecida: ${token}`);
      return vars[token];
    }
    throw new Error(`Token inválido: ${token}`);
  }
  function takeIf(value: string) { if (peek() !== value) return false; take(); return true; }
  function unary(): number {
    if (takeIf("+")) return unary();
    if (takeIf("-")) return -unary();
    if (takeIf("!")) return unary() === 0 ? 1 : 0;
    return primary();
  }
  function multiply(): number {
    let value = unary();
    while (["*", "/", "%"].includes(peek())) {
      const op = take(); const right = unary();
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  }
  function add(): number {
    let value = multiply();
    while (["+", "-"].includes(peek())) {
      const op = take(); const right = multiply();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  function compare(): number {
    let value = add();
    while ([">", "<", ">=", "<=", "==", "!="].includes(peek())) {
      const op = take(); const right = add();
      value = Number(op === ">" ? value > right : op === "<" ? value < right :
        op === ">=" ? value >= right : op === "<=" ? value <= right :
        op === "==" ? value === right : value !== right);
    }
    return value;
  }
  function logicalAnd(): number {
    let value = compare();
    while (takeIf("&&")) { const right = compare(); value = Number(Boolean(value) && Boolean(right)); }
    return value;
  }
  function logicalOr(): number {
    let value = logicalAnd();
    while (takeIf("||")) { const right = logicalAnd(); value = Number(Boolean(value) || Boolean(right)); }
    return value;
  }
  const result = logicalOr();
  if (position !== tokens.length) throw new Error("Expressão inválida: sobrou conteúdo.");
  if (!Number.isFinite(result)) throw new Error("Resultado não é um número finito.");
  return result;
}

export function passesVisibilityRule(
  entry: VisibilityEntry, all: VisibilityEntry[], rule: VisibilityRule,
): boolean {
  const games = Number(entry.partidas) || 0;
  if (rule.mode === "fixed") return games >= rule.minimumGames;
  const total = all.reduce((sum, x) => sum + (Number(x.partidas) || 0), 0);
  const vars: Record<string, number> = {
    partidas: games,
    vitorias: Number(entry.vitorias) || 0,
    derrotas: Number(entry.derrotas) || 0,
    winrate: Number(entry.winrate) || 0,
    mediaPartidas: all.length ? total / all.length : 0,
    maxPartidas: Math.max(0, ...all.map((x) => Number(x.partidas) || 0)),
    totalPartidas: total,
    totalParticipantes: all.length,
  };
  try {
    const value = evaluateVisibilityExpression(rule.expression, vars);
    const isCondition = /(?:>=|<=|==|!=|>|<|&&|\|\||!)/.test(rule.expression);
    return isCondition ? value !== 0 : games >= value;
  } catch {
    // Configuração malformada não deve ocultar todos os decks.
    return games >= rule.minimumGames;
  }
}
