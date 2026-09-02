import { Archive } from "lucide-react";
import { DECK_CATEGORIES, readDeckCategories, type DeckCategory } from "./deckMetadata";
import "./deckMetadata.css";

export function DeckCategoryIcon({ category, size = 16 }: { category: DeckCategory; size?: number }) {
  const symbol = DECK_CATEGORIES.find((item) => item.id === category)!;
  return <i className={`ss ss-${symbol.keyrune} mtg-deck-set-symbol`}
    style={{ fontSize: size }} aria-hidden="true" />;
}

export function InactiveDeckIcon({ size = 16 }: { size?: number }) {
  return <i className="ss ss-ice mtg-deck-set-symbol" style={{ fontSize: size }} aria-hidden="true" />;
}

export function DeckLabels({ categories, inactive, deleted, compact = false, statusIconOnly = false, onCategoryClick }: {
  categories?: unknown; inactive?: boolean; deleted?: boolean; compact?: boolean; statusIconOnly?: boolean;
  onCategoryClick?: (category: DeckCategory) => void;
}) {
  const selected = readDeckCategories(categories);
  if (!selected.length && !inactive && !deleted) return null;
  return (
    <span className={`mtg-deck-labels${compact ? " mtg-deck-labels-compact" : ""}`}>
      {deleted ? <span className="mtg-deck-label mtg-deck-deleted" title="Deck excluído do cadastro; histórico preservado">
        <Archive size={14} aria-hidden="true" /> Excluído
      </span> : inactive ? <span
        className={`mtg-deck-label mtg-deck-inactive${statusIconOnly ? " mtg-deck-status-icon" : ""}`}
        title="Inativo — não é exigido em Slayer ou Combobreaker (Ice Age)"
        aria-label="Inativo — não é exigido em Slayer ou Combobreaker (Ice Age)"
        role="img" tabIndex={statusIconOnly ? 0 : undefined} data-tooltip="Inativo · Ice Age">
        <InactiveDeckIcon size={statusIconOnly ? 20 : 14} />
        {!statusIconOnly ? <span>Inativo</span> : null}
      </span> : null}
      {DECK_CATEGORIES.filter((category) => selected.includes(category.id)).map((category) => onCategoryClick ? (
        <button type="button" className={`mtg-deck-label mtg-deck-category-button mtg-deck-category-${category.id}`} key={category.id}
          data-tooltip={category.label} title={category.label} aria-label={`Ver decks da categoria ${category.label}`}
          onClick={(event) => { event.stopPropagation(); onCategoryClick(category.id); }}>
          <DeckCategoryIcon category={category.id} size={20} />
          {!compact ? <span>{category.label}</span> : null}
        </button>
      ) : (
        <span className={`mtg-deck-label mtg-deck-category-${category.id}`} key={category.id}
          title={category.label} aria-label={category.label}>
          <DeckCategoryIcon category={category.id} size={14} />
          {!compact ? <span>{category.label}</span> : null}
        </span>
      ))}
    </span>
  );
}
