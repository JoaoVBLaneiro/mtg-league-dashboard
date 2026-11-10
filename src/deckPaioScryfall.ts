/** Arte e links do Scryfall para o detalhamento do Paiômetro dos decks.
 * A cache em memória evita novas consultas ao alternar entre os modais. */
import { normalizePaioName } from "./paiometroDeck";

export type PaioCardVisual = {
  imageUrl?: string;
  scryfallUrl: string;
};

type ScryfallCard = {
  name: string;
  scryfall_uri?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{
    name?: string;
    image_uris?: { normal?: string; large?: string };
  }>;
};

const SCRYFALL_API = "https://api.scryfall.com";
const GC_URL = `${SCRYFALL_API}/cards/search?q=is%3Agame-changer&unique=cards`;
const visualsCache = new Map<string, PaioCardVisual>();
let gcCache: { at: number; names: Set<string> } | null = null;
let gcPending: Promise<Set<string>> | null = null;

export function paioScryfallSearchUrl(name: string) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;
}

/** A entrada manual de combo aceita "Carta A + Carta B", sem dobrar sua pontuação. */
export function paioVisualNames(detail: string): string[] {
  const names = detail.split(/\s+\+\s+/).map((name) => name.trim()).filter(Boolean);
  return names.slice(0, 4);
}

function parseVisual(card: ScryfallCard): PaioCardVisual {
  return {
    // Para cartas transformáveis, Scryfall envia a frente em card_faces[0].
    imageUrl: card.image_uris?.normal ?? card.image_uris?.large
      ?? card.card_faces?.[0]?.image_uris?.normal
      ?? card.card_faces?.[0]?.image_uris?.large,
    scryfallUrl: card.scryfall_uri ?? paioScryfallSearchUrl(card.name),
  };
}

function aliases(card: ScryfallCard): string[] {
  return [
    card.name,
    card.name.split(/\s+\/\/\s+/)[0],
    card.card_faces?.[0]?.name ?? "",
  ].filter(Boolean).map(normalizePaioName);
}

async function namedLookup(name: string): Promise<PaioCardVisual> {
  try {
    const response = await fetch(`${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) return parseVisual((await response.json()) as ScryfallCard);
  } catch { /* Fallback de link e texto no modal. */ }
  return { scryfallUrl: paioScryfallSearchUrl(name) };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchDeckPaioVisuals(names: string[]): Promise<Record<string, PaioCardVisual>> {
  const unique = [...new Map(names.map((name) => [normalizePaioName(name), name.trim()])).entries()]
    .filter(([key]) => key.length > 0);
  const unresolved = unique.filter(([key]) => !visualsCache.has(key));

  // 75 identificadores é o limite da API de coleção do Scryfall.
  for (let offset = 0; offset < unresolved.length; offset += 75) {
    const slice = unresolved.slice(offset, offset + 75);
    try {
      const response = await fetch(`${SCRYFALL_API}/cards/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifiers: slice.map(([, name]) => ({ name })) }),
      });
      if (response.ok) {
        const payload: { data?: ScryfallCard[] } = await response.json();
        for (const card of payload.data ?? []) {
          const visual = parseVisual(card);
          for (const alias of aliases(card)) visualsCache.set(alias, visual);
        }
      }
    } catch { /* Um erro no Scryfall não pode bloquear o Paiômetro. */ }

    if (offset + 75 < unresolved.length) await wait(120);
  }

  // Cartas multiface e variantes não identificadas pela coleção recebem lookup exato.
  for (const [key, name] of unresolved) {
    const visual = visualsCache.get(key);
    if (visual?.imageUrl) continue;
    await wait(120);
    visualsCache.set(key, await namedLookup(name));
  }

  return Object.fromEntries(unique.map(([key, name]) => [
    key,
    visualsCache.get(key) ?? { scryfallUrl: paioScryfallSearchUrl(name) },
  ]));
}

export function fetchDeckPaioGameChangers(): Promise<Set<string>> {
  // Lista oficial se mantém em cache por 12 horas nesta sessão de navegação.
  if (gcCache && Date.now() - gcCache.at < 12 * 60 * 60 * 1000) {
    return Promise.resolve(gcCache.names);
  }
  if (gcPending) return gcPending;
  gcPending = (async () => {
    const names = new Set<string>();
    let nextUrl: string | null = GC_URL;
    while (nextUrl) {
      const response = await fetch(nextUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Falha ao consultar Game Changers.");
      const payload: { data?: ScryfallCard[]; has_more?: boolean; next_page?: string } = await response.json();
      for (const card of payload.data ?? []) for (const alias of aliases(card)) names.add(alias);
      nextUrl = payload.has_more ? payload.next_page ?? null : null;
    }
    gcCache = { at: Date.now(), names };
    return names;
  })().finally(() => { gcPending = null; });
  return gcPending;
}
