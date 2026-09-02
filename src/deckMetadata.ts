export const DECK_CATEGORIES = [
  { id: "aggro", label: "Aggro" },
  { id: "combo", label: "Combo" },
  { id: "tribal", label: "Tribal" },
  { id: "universes-beyond", label: "Universes Beyond" },
  { id: "marvel", label: "Marvel" },
] as const;

export type DeckCategory = typeof DECK_CATEGORIES[number]["id"];

export function readDeckCategories(value: unknown): DeckCategory[] {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return DECK_CATEGORIES.map((category) => category.id).filter((id) => parsed.includes(id));
}

export function toggleDeckCategory(value: unknown, category: DeckCategory) {
  const current = readDeckCategories(value);
  const next = current.includes(category) ? current.filter((id) => id !== category) : [...current, category];
  return JSON.stringify(readDeckCategories(next));
}

// Inativo é apenas um marcador. Somente exclusão retira das opções de cadastro.
export function isAvailableDeck(deck: { excluido?: boolean; deleted?: boolean }) {
  return deck.excluido !== true && deck.deleted !== true;
}
