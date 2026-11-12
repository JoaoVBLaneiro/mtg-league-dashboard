import { EMPTY_PAIO_CONFIG, paioThresholds, type PaioConfig } from "./paioConfig";
export type PaioRating = { name: string; average: number };
export type PaioAssignment = { concept: string; detail: string };
export type PaioItem = {
  name: string;
  points: number;
  average: number;
  origin: "decklist" | "manual" | "automatic";
  /** Lista de lands identificadas. Cada família pontua somente uma vez. */
  matchedCards?: string[];
  /** Total de cópias presentes na decklist (informativo, sem multiplicar pontos). */
  instances?: number;
  detail?: string;
  /** Pares completos diferentes, cobrados juntos como uma família. */
  comboPairs?: string[][];
  threshold?: number;
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
  "Old Duals no Geral",
  "Poison",
] as const;

/** As três famílias deixam de exigir marcação manual.
 * Listas de cartas (não de prints) correspondentes aos ciclos clássicos.
 * Se um ciclo ganhar novas cartas, basta atualizá-las aqui. */
export const PAIO_AUTO_LAND_FAMILIES = [
  {
    concept: "Shock Lands no geral",
    cards: [
      "Blood Crypt", "Breeding Pool", "Godless Shrine", "Hallowed Fountain", "Overgrown Tomb",
      "Sacred Foundry", "Steam Vents", "Stomping Ground", "Temple Garden", "Watery Grave",
    ],
  },
  {
    concept: "Fetch Lands no geral",
    cards: [
      "Arid Mesa", "Bloodstained Mire", "Flooded Strand", "Marsh Flats", "Misty Rainforest",
      "Polluted Delta", "Scalding Tarn", "Verdant Catacombs", "Windswept Heath", "Wooded Foothills",
    ],
  },
  {
    concept: "Triomas Tipais no geral",
    cards: [
      "Indatha Triome", "Ketria Triome", "Raugrin Triome", "Savai Triome", "Zagoth Triome",
      "Jetmir's Garden", "Raffine's Tower", "Spara's Headquarters", "Xander's Lounge", "Ziatora's Proving Ground",
    ],
  },
] as const;

export const PAIO_AUTO_CONCEPTS = PAIO_AUTO_LAND_FAMILIES.map((family) => family.concept);
const autoConceptNames = new Set<string>(PAIO_AUTO_CONCEPTS.map(normalizePaioName));

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
  // Aceita atribuições antigas para que o editor possa mostrá-las e removê-las.
  // Elas não serão mais pontuadas pelo cálculo automático.
  // Conceitos adicionais podem ser cadastrados pelo admin.
  const allowed = new Set<string>([...PAIO_CONCEPTS, ...PAIO_AUTO_CONCEPTS]);
  const seen = new Set<string>();
  const assignments: PaioAssignment[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const concept = String(item.concept || "").trim();
    const detail = String(item.detail || "").trim();
    if ((!allowed.has(concept) && (concept.length < 2 || concept.length > 120)) || !detail || detail.length > 120) continue;
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
  const counts = new Map<string, number>();
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
    if (name) {
      const key = normalizePaioName(name.split(/\s+\/\/\s+/)[0]);
      counts.set(key, (counts.get(key) ?? 0) + Number(match[1]));
    }
  }
  return counts;
}

export function calculatePaio(
  decklistText: string,
  assignments: PaioAssignment[],
  ratings: PaioRating[],
  knownCommanders: string[] = [],
  config: PaioConfig = EMPTY_PAIO_CONFIG,
): PaioSummary {
  const decklistCounts = decklistNames(decklistText);
  const foundNames = new Set(decklistCounts.keys());
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
  const thresholds = paioThresholds(config);
  const thresholdNames = new Set(thresholds.map((rule) => normalizePaioName(rule.concept)));
  const conceptNames = new Set<string>([
    ...PAIO_CONCEPTS.map(normalizePaioName),
    ...thresholdNames,
    ...PAIO_AUTO_CONCEPTS.map(normalizePaioName),
    ...config.items.filter((item) => item.kind === "concept").map((item) => normalizePaioName(item.name)),
  ]);

  type Family = {
    name: string;
    cards: Map<string, string>;
    hasManual: boolean;
    manualDetail: string;
    instanceCount: number;
  };
  const families = new Map<string, Family>();
  const comboInstances = new Map<string, string[]>();
  let comboHasManual = false;
  const comboConceptName = normalizePaioName("Combos de Duas Cartas");
  const comboRating = byName.get(comboConceptName);
  function registerCombo(expression: string, origin: "manual" | "automatic") {
    const names = expression.split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
    // Uma instância = uma combinação com duas cartas específicas.
    if (names.length !== 2 || normalizePaioName(names[0].split(/\s+\/\/\s+/)[0]) === normalizePaioName(names[1].split(/\s+\/\/\s+/)[0])) return;
    if (!names.every((name) => foundNames.has(normalizePaioName(name.split(/\s+\/\/\s+/)[0])))) return;
    if (!comboRating) return;
    const key = names.map((name) => normalizePaioName(name.split(/\s+\/\/\s+/)[0])).sort().join("::");
    if (comboInstances.has(key)) return;
    comboInstances.set(key, names);
    if (origin === "manual") comboHasManual = true;
  }
  function getFamily(name: string) {
    const key = normalizePaioName(name);
    let family = families.get(key);
    if (!family) {
      family = { name, cards: new Map(), hasManual: false, manualDetail: "", instanceCount: 0 };
      families.set(key, family);
    }
    return family;
  }

  // Ciclos clássicos de lands: várias ocorrências, uma única pontuação.
  for (const group of PAIO_AUTO_LAND_FAMILIES) {
    const matched = group.cards.filter((name) => foundNames.has(normalizePaioName(name)));
    if (!matched.length) continue;
    const family = getFamily(group.concept);
    for (const name of matched) {
      const key = normalizePaioName(name);
      family.cards.set(key, name);
      family.instanceCount += decklistCounts.get(key) ?? 1;
    }
  }

  // Aprendizados globais: uma regra de combo exige TODAS as cartas.
  for (const rule of config.rules) {
    if (thresholdNames.has(normalizePaioName(rule.concept))) continue;
    if (normalizePaioName(rule.concept) === comboConceptName) {
      registerCombo(rule.expression, "automatic");
      continue;
    }
    const required = rule.expression.split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
    if (!required.length || !required.every((name) => foundNames.has(normalizePaioName(name)))) continue;
    const family = getFamily(rule.concept);
    for (const name of required) {
      const key = normalizePaioName(name);
      if (family.cards.has(key)) continue;
      family.cards.set(key, name);
      family.instanceCount += decklistCounts.get(key) ?? 1;
    }
  }

  // Lançamentos individuais antigos continuam válidos, mas passam a ser
  // agregados por conceito (cada conceito soma apenas uma vez no deck).
  for (const assignment of parsePaioAssignments(assignments)) {
    if (autoConceptNames.has(normalizePaioName(assignment.concept)) || thresholdNames.has(normalizePaioName(assignment.concept))) continue;
    if (normalizePaioName(assignment.concept) === comboConceptName) {
      registerCombo(assignment.detail, "manual");
      continue;
    }
    const family = getFamily(assignment.concept);
    family.hasManual = true;
    if (!family.manualDetail) family.manualDetail = assignment.detail;
    for (const name of assignment.detail.split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean)) {
      const key = normalizePaioName(name);
      if (family.cards.has(key)) continue;
      family.cards.set(key, name);
      family.instanceCount += decklistCounts.get(key) ?? 1;
    }
  }

  // Quando uma carta está vinculada a um conceito, a pontuação dela não
  // é duplicada como se fosse outra carta individual.
  const coveredByConcept = new Set<string>();
  for (const family of families.values()) {
    const rating = byName.get(normalizePaioName(family.name));
    if (!rating) continue;
    for (const key of family.cards.keys()) coveredByConcept.add(key);
    items.push({
      name: family.name,
      average: rating.average,
      points: roundPaio(rating.average),
      origin: family.hasManual && !config.rules.some((rule) => normalizePaioName(rule.concept) === normalizePaioName(family.name))
        && !autoConceptNames.has(normalizePaioName(family.name)) ? "manual" : "automatic",
      matchedCards: [...family.cards.values()],
      instances: family.instanceCount,
      detail: family.manualDetail || undefined,
    });
  }

  // Todas as duplas completas formam uma única família; pares invertidos são iguais.
  if (comboRating && comboInstances.size) {
    const pairs = [...comboInstances.values()];
    const names = [...new Map(pairs.flat().map((name) => [normalizePaioName(name), name])).values()];
    items.push({ name: comboRating.name, average: comboRating.average, points: roundPaio(comboRating.average),
      origin: comboHasManual ? "manual" : "automatic", matchedCards: names, instances: pairs.length, comboPairs: pairs });
    for (const name of names) coveredByConcept.add(normalizePaioName(name.split(/\s+\/\/\s+/)[0]));
  }

  // Tags são independentes de pontuação individual: a categoria mede a densidade do deck.
  // Só entram cartas presentes (incluindo comandantes, sem duplicar se já estão na lista).
  for (const rule of thresholds) {
    const rating = byName.get(normalizePaioName(rule.concept));
    if (!rating) continue;
    const matched = new Map<string, string>();
    for (const member of config.tagMembers ?? []) {
      if (member.tagKey !== rule.tagKey) continue;
      const key = normalizePaioName(member.cardName.split(/\s+\/\/\s+/)[0]);
      if (foundNames.has(key)) matched.set(key, member.cardName);
    }
    const count = [...matched.keys()].reduce((total, key) => total + (decklistCounts.get(key) ?? 1), 0);
    if (count < rule.minimum) continue;
    items.push({ name: rating.name, points: roundPaio(rating.average), average: rating.average,
      origin: "automatic", matchedCards: [...matched.values()], instances: count, threshold: rule.minimum });
  }

  for (const name of foundNames) {
    const rating = byName.get(name);
    if (!rating || conceptNames.has(normalizePaioName(rating.name)) || coveredByConcept.has(name)) continue;
    items.push({
      name: expandRatedNames(rating.name).length > 1
        ? name === normalizePaioName("Three Visits") ? "Three Visits" : "Nature's Lore"
        : rating.name,
      average: rating.average,
      points: roundPaio(rating.average),
      origin: "decklist",
    });
  }
  items.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "pt-BR"));
  return {
    items,
    total: items.reduce((sum, item) => sum + item.points, 0),
    hasDecklist: Boolean(decklistText.trim()),
  };
}
