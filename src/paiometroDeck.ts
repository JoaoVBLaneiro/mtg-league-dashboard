export type PaioRating = { name: string; average: number };
export type PaioAssignment = { concept: string; detail: string };
export type PaioItem = {
  name: string;
  points: number;
  average: number;
  origin: "decklist" | "manual";
  detail?: string;
};
export type PaioSummary = {
  total: number;
  items: PaioItem[];
  hasDecklist: boolean;
};

export const PAIO_CONCEPTS = [
  "Cartas de Turno Extra",
  "Cartas de Combates Extra",
  "Combos de Duas Cartas",
  "Punish de Draw",
  "Mass Land Denial",
  "Mass Land Destruction",
  "Fetch Lands no geral",
  "Shock Lands no geral",
  "Old Duals no Geral",
  "Triomas Tipais no geral",
] as const;

const API_URL = "https://api.corneliomove.com.br/mtg-api/api/cards/ranking";
const TTL = 5 * 60 * 1000;
let cached: { timestamp: number; ratings: PaioRating[] } | null = null;
let pending: Promise<PaioRating[]> | null = null;

export function fetchPaioRatings(): Promise<PaioRating[]> {
  if (cached && Date.now() - cached.timestamp < TTL) return Promise.resolve(cached.ratings);
  if (pending) return pending;
  pending = fetch(API_URL, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Não foi possível consultar o Paiômetro.");
      const data: { cards?: PaioRating[] } = await response.json();
      if (!Array.isArray(data.cards)) throw new Error("Resposta inválida do Paiômetro.");
      cached = { timestamp: Date.now(), ratings: data.cards };
      return data.cards;
    })
    .finally(() => { pending = null; });
  return pending;
}

export function normalizePaioName(name: string) {
  return String(name ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ").trim();
}

/** Arredondamento da comunidade: .50 ainda desce; .51 sobe. */
export function roundPaio(value: number) {
  const number = Math.max(0, Math.min(10, Number(value) || 0));
  return number - Math.floor(number) <= 0.5 ? Math.floor(number) : Math.ceil(number);
}

export function parsePaioAssignments(value: unknown): PaioAssignment[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const allowed = new Set<string>(PAIO_CONCEPTS);
  const seen = new Set<string>();
  const assignments: PaioAssignment[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const concept = String(item.concept || "").trim();
    const detail = String(item.detail || "").trim();
    if (!allowed.has(concept) || !detail || detail.length > 120) continue;
    const key = `${normalizePaioName(concept)}::${normalizePaioName(detail)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assignments.push({ concept, detail });
  }
  return assignments;
}

function expandRatedNames(name: string) {
  if (normalizePaioName(name) === normalizePaioName("Three Visits / Nature's Lore")) {
    return ["Three Visits", "Nature's Lore"];
  }
  return [name];
}

/** Conta cada carta diferente uma única vez, independentemente da quantidade. */
function decklistNames(decklist: string) {
  const names = new Set<string>();
  let inMainDeck = true;
  for (const raw of decklist.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(?:\/\/\s*|#\s*)?(?:sideboard|maybeboard|considering)\s*:?(?:\/\/)?$/i.test(line)) {
      inMainDeck = false;
      continue;
    }
    if (/^(?:\/\/\s*|#\s*)?(?:deck|mainboard|commander)\s*:?(?:\/\/)?$/i.test(line)) {
      inMainDeck = true;
      continue;
    }
    if (!inMainDeck || !line || /^(\/\/|#|\[)/.test(line)) continue;
    const match = line.match(/^(\d+)\s*x?\s*(.+?)(?:\s+\([^)]*\)\s*[A-Za-z0-9★-]*)?$/i);
    if (!match || Number(match[1]) <= 0) continue;
    const name = match[2].trim().replace(/\s+\*[^*]+\*$/g, "");
    if (name) names.add(normalizePaioName(name.split(/\s+\/\/\s+/)[0]));
  }
  return names;
}

export function calculatePaio(
  decklistText: string,
  assignments: PaioAssignment[],
  ratings: PaioRating[],
  knownCommanders: string[] = [],
): PaioSummary {
  const foundNames = decklistNames(decklistText);
  for (const commander of knownCommanders) {
    if (commander.trim()) foundNames.add(normalizePaioName(commander.split(/\s+\/\/\s+/)[0]));
  }
  const byName = new Map<string, PaioRating>();
  for (const rated of ratings) {
    for (const name of expandRatedNames(rated.name)) {
      byName.set(normalizePaioName(name), rated);
    }
  }
  const items: PaioItem[] = [];
  for (const name of foundNames) {
    const rating = byName.get(name);
    if (!rating) continue;
    items.push({
      name: expandRatedNames(rating.name).length > 1
        ? name === normalizePaioName("Three Visits") ? "Three Visits" : "Nature's Lore"
        : rating.name,
      average: rating.average,
      points: roundPaio(rating.average),
      origin: "decklist",
    });
  }
  for (const assignment of parsePaioAssignments(assignments)) {
    const rating = byName.get(normalizePaioName(assignment.concept));
    if (!rating) continue;
    items.push({
      name: assignment.concept,
      detail: assignment.detail,
      average: rating.average,
      points: roundPaio(rating.average),
      origin: "manual",
    });
  }
  items.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "pt-BR"));
  return {
    items,
    total: items.reduce((sum, item) => sum + item.points, 0),
    hasDecklist: Boolean(decklistText.trim()),
  };
}
