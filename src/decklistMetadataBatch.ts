import { scryfallFetch } from "./scryfallRequest";
import { scryfallCardImage } from "./scryfallImages";

export type DecklistMetadata = {
  imageUrl: string;
  scryfallUrl: string;
  typeLine: string;
  edhrecRank: number;
};

type ScryfallCard = {
  name: string;
  type_line?: string;
  scryfall_uri?: string;
  edhrec_rank?: number | null;
  image_uris?: Record<string, string>;
  card_faces?: Array<{
    name?: string;
    image_uris?: Record<string, string>;
  }>;
};

type CollectionResponse = { data?: ScryfallCard[] };

function normalizeName(value: string): string {
  return value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

/** Resolve cartas em grupos de 75, compartilhando a fila/limite do Scryfall. */
export async function fetchDecklistMetadata(names: string[]): Promise<Map<string, DecklistMetadata>> {
  const unique = [...new Map(names.map((name) => [normalizeName(name), name])).values()];
  const result = new Map<string, DecklistMetadata>();

  for (let index = 0; index < unique.length; index += 75) {
    const chunk = unique.slice(index, index + 75);
    try {
      const response = await scryfallFetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
      });

      // Ao atingir o rate limit, para em vez de insistir com mais solicitações.
      if (response.status === 429) break;
      if (!response.ok) continue;

      const payload = (await response.json()) as CollectionResponse;
      for (const card of payload.data ?? []) {
        const item: DecklistMetadata = {
          imageUrl: scryfallCardImage(card, "grid"),
          scryfallUrl: card.scryfall_uri || `https://scryfall.com/search?q=${encodeURIComponent(card.name)}`,
          typeLine: card.type_line || "",
          edhrecRank: Number(card.edhrec_rank ?? 999999),
        };

        // Cartas dupla face são frequentemente retornadas no formato "Frente // Verso".
        const keys = [card.name, card.name.split(" // ")[0], card.card_faces?.[0]?.name];
        for (const key of keys) {
          if (key) result.set(normalizeName(key), item);
        }
      }
    } catch {
      // Falhas temporárias não entram no cache; as próximas aberturas tentarão de novo.
    }
  }
  return result;
}
