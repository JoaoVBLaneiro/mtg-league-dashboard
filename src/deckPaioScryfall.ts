/** Cache compartilhado de metadados públicos, sem gravar falhas temporárias. */
import { normalizePaioName } from "./paiometroDeck";
import { scryfallFetch } from "./scryfallRequest";
import { scryfallCardImage, type ScryfallImages } from "./scryfallImages";

export type PaioCardVisual = { imageUrl?: string; scryfallUrl: string };
type ScryfallCard = {
  name: string; scryfall_uri?: string;
  image_uris?: ScryfallImages;
  card_faces?: Array<{ name?: string; image_uris?: ScryfallImages }>;
};
type Entry = { at: number; visual: PaioCardVisual; imageVersion?: number };
const API = "https://api.scryfall.com";
const DAY = 86400000;
const TTL = 7 * DAY;
const STORAGE = "pina-scryfall-visuals-v1";
const GC_STORAGE = "pina-scryfall-gc-v1";
const cache = new Map<string, Entry>();
const misses = new Map<string, number>();
let initialized = false;
let visualQueue: Promise<void> = Promise.resolve();
let gcCache: { at: number; names: Set<string> } | null = null;
let gcPending: Promise<Set<string>> | null = null;

function hydrate() {
  if (initialized) return;
  initialized = true;
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE) ?? "[]") as Array<[string, Entry]>;
    for (const [key, entry] of entries) if (entry?.visual?.imageUrl && Date.now() - entry.at < 30 * DAY) cache.set(key, entry);
  } catch { /* Storage indisponível ou corrompido: cache em memória. */ }
  try {
    const gc = JSON.parse(localStorage.getItem(GC_STORAGE) ?? "null") as { at: number; names: string[] } | null;
    if (gc && Array.isArray(gc.names)) gcCache = { at: gc.at, names: new Set(gc.names) };
  } catch { /* Sem cache anterior. */ }
}
function persist() {
  // Limite de armazenamento; mantém as entradas mais recentes.
  const entries = [...cache.entries()].sort((a,b) => b[1].at - a[1].at).slice(0, 2000);
  if (cache.size > 2000) { cache.clear(); for (const [key, entry] of entries) cache.set(key, entry); }
  try { localStorage.setItem(STORAGE, JSON.stringify(entries)); } catch { /* Quota ou modo privado. */ }
}
export function paioScryfallSearchUrl(name: string) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;
}
export function paioVisualNames(detail: string): string[] {
  return detail.split(/\s+\+\s+/).map((name) => name.trim()).filter(Boolean).slice(0, 4);
}
function aliases(card: ScryfallCard) {
  return [card.name, card.name.split(/\s+\/\/\s+/)[0] ?? "", card.card_faces?.[0]?.name ?? ""].filter(Boolean).map(normalizePaioName);
}
function remember(card: ScryfallCard, requested?: string) {
  const imageUrl = scryfallCardImage(card);
  if (!imageUrl) return;
  const entry = { at: Date.now(), imageVersion: 2, visual: { imageUrl, scryfallUrl: card.scryfall_uri ?? paioScryfallSearchUrl(card.name) } };
  for (const key of [...aliases(card), ...(requested ? [requested] : [])]) { cache.set(key, entry); misses.delete(key); }
}
function current(key: string) { const entry = cache.get(key); return Boolean(entry && entry.imageVersion === 2 && Date.now() - entry.at < TTL); }

async function loadVisuals(names: string[]): Promise<Record<string, PaioCardVisual>> {
  hydrate();
  const unique = [...new Map(names.map((name) => [normalizePaioName(name), name.trim()])).entries()].filter(([key]) => Boolean(key));
  const unresolved = unique.filter(([key]) => !current(key) && (misses.get(key) ?? 0) < Date.now());
  try {
    for (let offset = 0; offset < unresolved.length; offset += 75) {
      const chunk = unresolved.slice(offset, offset + 75);
      const response = await scryfallFetch(`${API}/cards/collection`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map(([, name]) => ({ name })) }),
      });
      // Não transforma rate limit, erro de rede ou 5xx em dezenas de buscas individuais.
      if (!response.ok) break;
      const payload = await response.json() as { data?: ScryfallCard[] };
      if (!Array.isArray(payload.data)) break;
      for (const card of payload.data) remember(card);
      for (const [key, name] of chunk) {
        if (current(key)) continue;
        const exact = await scryfallFetch(`${API}/cards/named?exact=${encodeURIComponent(name)}`);
        if (exact.status === 404) { misses.set(key, Date.now() + 60 * 60 * 1000); continue; }
        if (!exact.ok) break;
        remember(await exact.json() as ScryfallCard, key);
      }
      persist();
    }
  } catch { /* Retorna as imagens já conhecidas; a próxima visita tenta de novo. */ }
  persist();
  return Object.fromEntries(unique.map(([key, name]) => [key, cache.get(key)?.visual ?? { scryfallUrl: paioScryfallSearchUrl(name) }]));
}
/** Exibe os hits imediatamente, sem esperar a fila de consultas ou os selos GC. */
export function readCachedPaioVisuals(names: string[]): Record<string, PaioCardVisual> {
  hydrate();
  const result: Record<string, PaioCardVisual> = {};
  for (const name of names) {
    const key = normalizePaioName(name);
    const entry = cache.get(key);
    if (entry?.visual.imageUrl && Date.now() - entry.at < 30 * DAY) result[key] = entry.visual;
  }
  return result;
}
export function fetchDeckPaioVisuals(names: string[]): Promise<Record<string, PaioCardVisual>> {
  hydrate();
  // Não espera a fila de outros modais se todas as imagens já estão no cache.
  if (names.every((name) => !normalizePaioName(name) || current(normalizePaioName(name)))) {
    return Promise.resolve(readCachedPaioVisuals(names));
  }
  // Consultas simultâneas são serializadas; a seguinte reaproveita o resultado da anterior.
  const result = visualQueue.then(() => loadVisuals(names));
  visualQueue = result.then(() => undefined, () => undefined);
  return result;
}
export function fetchDeckPaioGameChangers(): Promise<Set<string>> {
  hydrate();
  if (gcCache && Date.now() - gcCache.at < DAY) return Promise.resolve(gcCache.names);
  if (gcPending) return gcPending;
  gcPending = (async () => {
    const names = new Set<string>();
    let url: string | null = `${API}/cards/search?q=is%3Agame-changer&unique=cards`;
    try {
      while (url) {
        const response = await scryfallFetch(url);
        if (!response.ok) throw new Error("Game Changers indisponíveis.");
        const payload = await response.json() as { data?: ScryfallCard[]; has_more?: boolean; next_page?: string };
        if (!Array.isArray(payload.data)) throw new Error("Resposta inválida.");
        for (const card of payload.data) for (const key of aliases(card)) names.add(key);
        url = payload.has_more ? payload.next_page ?? null : null;
      }
      gcCache = { at: Date.now(), names };
      try { localStorage.setItem(GC_STORAGE, JSON.stringify({ at: gcCache.at, names: [...names] })); } catch { /* cache em memória */ }
      return names;
    } catch { return gcCache?.names ?? new Set<string>(); }
  })().finally(() => { gcPending = null; });
  return gcPending;
}
