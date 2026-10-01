export const DECK_CATEGORIES = [
  { id: "aggro", label: "Aggro", keyrune: "frf", setName: "Fate Reforged" },
  { id: "combo", label: "Combo", keyrune: "usg", setName: "Urza’s Saga" },
  { id: "tribal", label: "Tribal", keyrune: "lrw", setName: "Lorwyn" },
  { id: "universes-beyond", label: "Universes Beyond", keyrune: "ltr", setName: "The Lord of the Rings" },
  { id: "marvel", label: "Marvel", keyrune: "spm", setName: "Marvel’s Spider-Man" },
] as const;

export type DeckCategory = typeof DECK_CATEGORIES[number]["id"];

export function readDeckTags(value: unknown): string[] {
  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const tags = parsed
    .map((item) => typeof item === "string" ? item.trim().toLowerCase() : "")
    .filter((item) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item));

  return [...new Set(tags)];
}

export function readDeckCategories(value: unknown): DeckCategory[] {
  const tags = readDeckTags(value);
  return DECK_CATEGORIES.map((category) => category.id).filter((id) => tags.includes(id));
}

export function toggleDeckCategory(value: unknown, category: DeckCategory) {
  const current = readDeckCategories(value);
  const next = current.includes(category) ? current.filter((id) => id !== category) : [...current, category];
  return JSON.stringify(readDeckCategories(next));
}

// Inativos continuam disponíveis para jogar; requisitos de coleções os ignoram.
export function isAvailableDeck(deck: { excluido?: boolean; deleted?: boolean }) {
  return deck.excluido !== true && deck.deleted !== true;
}

type DeckImages = {
  arteUrl?: string; artUrl?: string; fotoUrl?: string; imageUrl?: string; photoUrl?: string;
};

// Foto do comandante: listas, retratos, prévias e cartas dos modais.
// Arte URL é um fundo independente e nunca substitui esse retrato.
export function getDeckDisplayImage(deck: DeckImages) {
  return [deck.fotoUrl, deck.imageUrl, deck.photoUrl]
    .find((value) => value?.trim())?.trim() || "";
}

// Fundos do marcador de vida mantêm a arte personalizada, quando preenchida.
export function getDeckBackgroundImage(deck: DeckImages) {
  return [deck.arteUrl, deck.artUrl].find((value) => value?.trim())?.trim()
    || getDeckDisplayImage(deck);
}

export function decksInCategory<T extends { categories?: unknown; deleted?: boolean; excluido?: boolean }>(decks: T[], category: DeckCategory) {
  return decks.filter((deck) => isAvailableDeck(deck) && readDeckCategories(deck.categories).includes(category));
}
