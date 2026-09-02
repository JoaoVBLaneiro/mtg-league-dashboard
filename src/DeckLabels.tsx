import { Archive, Infinity as InfinityIcon, Orbit, PauseCircle, Shield, Swords, Users } from "lucide-react";
import { DECK_CATEGORIES, readDeckCategories, type DeckCategory } from "./deckMetadata";
import "./deckMetadata.css";

const icons = { aggro: Swords, combo: InfinityIcon, tribal: Users, "universes-beyond": Orbit, marvel: Shield };

export function DeckCategoryIcon({ category, size = 16 }: { category: DeckCategory; size?: number }) {
  const Icon = icons[category];
  return <Icon size={size} aria-hidden="true" />;
}

export function DeckLabels({ categories, inactive, deleted, compact = false }: {
  categories?: unknown; inactive?: boolean; deleted?: boolean; compact?: boolean;
}) {
  const selected = readDeckCategories(categories);
  if (!selected.length && !inactive && !deleted) return null;
  return (
    <span className={`mtg-deck-labels${compact ? " mtg-deck-labels-compact" : ""}`}>
      {deleted ? <span className="mtg-deck-label mtg-deck-deleted" title="Deck excluído do cadastro; histórico preservado">
        <Archive size={14} aria-hidden="true" /> Excluído
      </span> : inactive ? <span className="mtg-deck-label mtg-deck-inactive" title="Inativo — apenas um marcador por enquanto">
        <PauseCircle size={14} aria-hidden="true" /> Inativo
      </span> : null}
      {DECK_CATEGORIES.filter((category) => selected.includes(category.id)).map((category) => (
        <span className={`mtg-deck-label mtg-deck-category-${category.id}`} key={category.id}
          title={category.label} aria-label={category.label}>
          <DeckCategoryIcon category={category.id} size={14} />
          {!compact ? <span>{category.label}</span> : null}
        </span>
      ))}
    </span>
  );
}
