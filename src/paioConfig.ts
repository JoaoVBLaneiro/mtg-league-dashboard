/** Configuração global compartilhada entre Paiômetro, editores e admin. */
export type PaioCatalogItem = {
  name: string;
  kind: "card" | "concept";
  artCard: string;
  linkUrl: string;
};
export type PaioGlobalRule = { concept: string; expression: string };
export type PaioTag = { key: string; name: string };
export type PaioTagMember = { tagKey: string; cardName: string };
export type PaioThreshold = { concept: string; tagKey: string; minimum: number };
export const BUILTIN_THRESHOLDS: PaioThreshold[] = [
  { concept: "Decks com 9 ou mais Counterspells", tagKey: "counterspell", minimum: 9 },
  { concept: "Decks com 9 ou mais BoardWipes", tagKey: "boardwipe", minimum: 9 },
];
export type PaioConfig = { items: PaioCatalogItem[]; rules: PaioGlobalRule[]; tags?: PaioTag[]; tagMembers?: PaioTagMember[]; thresholds?: PaioThreshold[] };
export function paioThresholds(config: PaioConfig): PaioThreshold[] {
  const map = new Map(BUILTIN_THRESHOLDS.map((rule) => [normalizePaioKey(rule.concept), rule]));
  for (const rule of config.thresholds ?? []) map.set(normalizePaioKey(rule.concept), rule);
  return [...map.values()];
}

const API_URL = "https://api.corneliomove.com.br/mtg-api/api/paio/config";
let cached: { time: number; config: PaioConfig } | null = null;
let pending: Promise<PaioConfig> | null = null;
export const EMPTY_PAIO_CONFIG: PaioConfig = { items: [], rules: [] };

export function normalizePaioKey(value: string) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ").trim();
}

export function invalidatePaioConfig() { cached = null; }

export function fetchPaioConfig(): Promise<PaioConfig> {
  if (cached && Date.now() - cached.time < 60_000) return Promise.resolve(cached.config);
  if (pending) return pending;
  pending = fetch(API_URL, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error("Configuração global do Paiômetro indisponível.");
    const body = await response.json() as PaioConfig;
    if (!Array.isArray(body.items) || !Array.isArray(body.rules)) throw new Error("Configuração inválida.");
    cached = { time: Date.now(), config: body };
    return body;
  }).finally(() => { pending = null; });
  return pending;
}

export function catalogEntry(config: PaioConfig, name: string) {
  const key = normalizePaioKey(name);
  return config.items.find((item) => normalizePaioKey(item.name) === key);
}
