type ScryfallCard = {
  name?: string;
  scryfall_uri?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  details?: string;
};

// Compartilhada pelos comandantes, cartas-chave e cartas favoritas.
export async function findCardOnScryfall(cardName: string, fetchCard: typeof fetch = fetch) {
  const cleanName = cardName.trim();
  if (!cleanName) throw new Error("Informe o nome da carta primeiro.");

  const response = await fetchCard(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}`
  );
  const card = (await response.json()) as ScryfallCard;
  if (!response.ok) throw new Error(card.details || "Carta não encontrada no Scryfall.");

  return {
    name: card.name || cleanName,
    imageUrl:
      card.image_uris?.large ||
      card.image_uris?.normal ||
      card.card_faces?.[0]?.image_uris?.large ||
      card.card_faces?.[0]?.image_uris?.normal ||
      "",
    scryfallUrl: card.scryfall_uri || "",
  };
}
