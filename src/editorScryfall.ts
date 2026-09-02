type ScryfallCard = {
  id?: string;
  oracle_id?: string;
  name?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  artist?: string;
  scryfall_uri?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  details?: string;
};

export type CardPrinting = {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
  scryfallUrl: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  language: string;
  artist: string;
};

export type CardPrintingsPage = {
  cardName: string;
  printings: CardPrinting[];
  nextPage: string | null;
};

type ScryfallResponse = ScryfallCard & {
  data?: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
};

// Cache apenas de dados públicos, por instância de fetch (inclui os testes).
const caches = new WeakMap<typeof fetch, Map<string, { expires: number; data: Promise<ScryfallResponse> }>>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

async function readScryfall(url: string, fetchCard: typeof fetch): Promise<ScryfallResponse> {
  let cache = caches.get(fetchCard);
  if (!cache) { cache = new Map(); caches.set(fetchCard, cache); }
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;

  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => { release = resolve; });
  const data = (async () => {
    await previous;
    const pause = Math.max(0, 120 - (Date.now() - lastRequestAt));
    if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      lastRequestAt = Date.now();
      const response = await fetchCard(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (response.status === 429) throw new Error("O Scryfall recebeu muitas consultas. Aguarde um pouco e tente novamente.");
      const body = (await response.json()) as ScryfallResponse;
      if (!response.ok) throw new Error(body.details || "Carta não encontrada no Scryfall.");
      if (!body || typeof body !== "object" || (new URL(url).pathname === "/cards/search" && !Array.isArray(body.data))) {
        throw new Error("Não foi possível ler as edições da carta. Tente novamente.");
      }
      return body;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("O Scryfall demorou para responder. Tente novamente.", { cause: error });
      throw error;
    } finally {
      clearTimeout(timeout);
      release();
    }
  })();
  if (cache.size >= 40) cache.delete(cache.keys().next().value!);
  cache.set(url, { expires: Date.now() + 10 * 60 * 1000, data });
  try { return await data; }
  catch (error) { cache.delete(url); throw error; }
}

async function resolveScryfallName(cardName: string, fetchCard: typeof fetch) {
  const cleanName = cardName.trim();
  if (!cleanName) throw new Error("Informe o nome da carta primeiro.");
  return readScryfall(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}`, fetchCard);
}

function cardImages(card: ScryfallCard) {
  return card.image_uris?.large || card.image_uris?.normal ? card.image_uris : card.card_faces?.[0]?.image_uris;
}

// Compartilhada pelos comandantes, cartas-chave e cartas favoritas.
export async function findCardOnScryfall(cardName: string, fetchCard: typeof fetch = fetch) {
  const card = await resolveScryfallName(cardName, fetchCard);
  const images = cardImages(card);
  return {
    name: card.name || cardName.trim(),
    imageUrl: images?.large || images?.normal || "",
    scryfallUrl: card.scryfall_uri || "",
  };
}

function validatePrintingsUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== "https://api.scryfall.com" || url.pathname !== "/cards/search" || url.username || url.password) {
    throw new Error("O Scryfall retornou uma página de edições inválida.");
  }
  return url.href;
}

// Uma página por vez: abrir a galeria não baixa todas as reimpressões.
export async function findCardPrintings(
  cardName: string, nextPage: string | null = null, fetchCard: typeof fetch = fetch
): Promise<CardPrintingsPage> {
  let canonicalName = cardName.trim();
  let url: string;
  if (nextPage) {
    url = validatePrintingsUrl(nextPage);
  } else {
    const card = await resolveScryfallName(cardName, fetchCard);
    canonicalName = card.name || canonicalName;
    const oracleId = card.oracle_id;
    const query = oracleId && /^[0-9a-f-]{36}$/i.test(oracleId)
      ? `oracleid:${oracleId}`
      : `!"${canonicalName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const parameters = new URLSearchParams({ q: query, unique: "prints", order: "released", dir: "desc" });
    url = `https://api.scryfall.com/cards/search?${parameters}`;
  }
  const result = await readScryfall(url, fetchCard);
  if (!Array.isArray(result.data)) throw new Error("Não foi possível ler as edições da carta. Tente novamente.");
  const printings = result.data.flatMap((card): CardPrinting[] => {
    const images = cardImages(card);
    const imageUrl = images?.large || images?.normal;
    if (!imageUrl || !card.id) return [];
    return [{
      id: card.id, name: card.name || canonicalName, imageUrl,
      thumbnailUrl: images?.normal || imageUrl,
      scryfallUrl: card.scryfall_uri || "", setName: card.set_name || "Edição",
      setCode: card.set || "", collectorNumber: card.collector_number || "",
      language: card.lang || "", artist: card.artist || "",
    }];
  });
  return { cardName: canonicalName, printings, nextPage: result.has_more && result.next_page ? validatePrintingsUrl(result.next_page) : null };
}
