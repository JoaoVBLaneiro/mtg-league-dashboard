import { PAIO_AUTO_LAND_FAMILIES, decklistNames, normalizePaioName, countPaioTagCards, calculatePaio, parsePaioAssignments, type PaioRating, type PaioSummary } from "./paiometroDeck";
import { normalizePaioKey, type PaioConfig, type PaioThreshold } from "./paioConfig";

export type PaioUsageDeck = {
  name: string; displayName: string; commander: string; secondaryCommander: string;
  imageUrl: string; decklistTexto: string; paiometroConceitos?: unknown; inactive?: boolean; deleted?: boolean;
};
export type PaioUsageMatch<T extends PaioUsageDeck> = { deck: T; cards: string[]; count: number; manualCards?: string[] };
const cardKey = (name: string) => normalizePaioName(name.split(/\s+\/\/\s+/)[0]);
export function usageDeckCounts(deck: PaioUsageDeck) {
  const counts = decklistNames(deck.decklistTexto);
  for (const name of [deck.commander, deck.secondaryCommander]) {
    const key = cardKey(name);
    if (key && !counts.has(key)) counts.set(key, 1);
  }
  return counts;
}
export function buildPaioUsageIndex<T extends PaioUsageDeck>(decks: T[]) {
  return decks.filter((deck) => !deck.deleted).map((deck) => {
    const counts = usageDeckCounts(deck);
    const assignments = parsePaioAssignments(deck.paiometroConceitos);
    const manual = new Map<string, string>();
    for (const assignment of assignments) {
      for (const name of assignment.detail.split(/\s+\+\s+/).map(part => part.trim()).filter(Boolean)) {
        const key = cardKey(name);
        if (key) manual.set(key, name);
      }
    }
    // Atribuições não são prova da decklist: não entram em counts,
    // nem na contagem de tags ou na validação de combos completos.
    return { deck, counts, manual, assignments };
  });
}
export function cardUsage<T extends PaioUsageDeck>(index: ReturnType<typeof buildPaioUsageIndex<T>>, name: string): PaioUsageMatch<T>[] {
  const key = cardKey(name);
  if (!key) return [];
  return index.flatMap(({ deck, counts, manual }): PaioUsageMatch<T>[] => {
    if (counts.has(key)) return [{ deck, cards: [name], count: counts.get(key) ?? 0 }];
    if (manual.has(key)) return [{ deck, cards: [name], count: 0, manualCards: [name] }];
    return [];
  }).sort((a, b) => Number(Boolean(a.manualCards?.length)) - Number(Boolean(b.manualCards?.length)) || a.deck.displayName.localeCompare(b.deck.displayName, "pt-BR"));
}
export function thresholdUsage<T extends PaioUsageDeck>(index: ReturnType<typeof buildPaioUsageIndex<T>>, rule: PaioThreshold, config: PaioConfig): PaioUsageMatch<T>[] {
  return index.flatMap(({ deck, counts }) => {
    const result = countPaioTagCards(counts, rule.tagKey, config);
    return result.count >= rule.minimum ? [{ deck, ...result }] : [];
  }).sort((a,b) => b.count - a.count || a.deck.displayName.localeCompare(b.deck.displayName, "pt-BR"));
}
export function familyMembers(concept: string, config: PaioConfig) {
  const key = normalizePaioKey(concept);
  const unique = new Map<string, string>();
  const pairs = new Map<string, string[]>();
  const add = (name: string) => { const id = cardKey(name); if (id && !unique.has(id)) unique.set(id, name); };
  for (const family of PAIO_AUTO_LAND_FAMILIES) {
    if (normalizePaioKey(family.concept) === key) family.cards.forEach(add);
  }
  // As Old Duals já possuem uma família na aba pública. A listagem não muda sua regra de pontuação.
  if (key === normalizePaioKey("Old Duals no Geral")) {
    ["Badlands", "Bayou", "Plateau", "Savannah", "Scrubland", "Taiga", "Tropical Island", "Tundra", "Underground Sea", "Volcanic Island"].forEach(add);
  }
  for (const rule of config.rules) {
    if (normalizePaioKey(rule.concept) !== key) continue;
    const names = rule.expression.split(/\s+\+\s+/).map((name) => name.trim()).filter(Boolean);
    names.forEach(add);
    if (key === normalizePaioKey("Combos de Duas Cartas") && names.length === 2 && cardKey(names[0]) !== cardKey(names[1])) {
      const id = names.map(cardKey).sort().join("::");
      if (!pairs.has(id)) pairs.set(id, names);
    }
  }
  return { cards: [...unique.values()].sort((a,b) => a.localeCompare(b, "pt-BR")), pairs: [...pairs.values()] };
}

export function comboUsage<T extends PaioUsageDeck>(index: ReturnType<typeof buildPaioUsageIndex<T>>, pair: string[]): PaioUsageMatch<T>[] {
  const keys = [...new Set(pair.map(cardKey).filter(Boolean))];
  if (pair.length !== 2 || keys.length !== 2) return [];
  return index.flatMap(({ deck, counts }) => keys.every(key => counts.has(key)) ? [{ deck, cards: [...pair], count: 2 }] : [])
    .sort((a, b) => a.deck.displayName.localeCompare(b.deck.displayName, "pt-BR"));
}

/** A lista de uso é informativa: qualquer carta da família basta, exceto combos,
 * que exigem a presença de uma dupla completa. Não altera a pontuação. */
export function familyUsage<T extends PaioUsageDeck>(index: ReturnType<typeof buildPaioUsageIndex<T>>, concept: string, config: PaioConfig): PaioUsageMatch<T>[] {
  const members = familyMembers(concept, config);
  const isCombo = normalizePaioKey(concept) === normalizePaioKey("Combos de Duas Cartas");
  return index.flatMap(({ deck, counts, assignments }): PaioUsageMatch<T>[] => {
    if (isCombo) {
      const pairs = members.pairs.filter(pair => pair.every(name => counts.has(cardKey(name))));
      if (!pairs.length) return [];
      return [{ deck, cards: [...new Map(pairs.flat().map(name => [cardKey(name), name])).values()], count: pairs.length }];
    }
    const cards = new Map(members.cards.filter(name => counts.has(cardKey(name))).map(name => [cardKey(name), name]));
    const manualCards: string[] = [];
    // Inclui também lançamentos específicos deste deck nesta família, sem
    // promover a atribuição a presença confirmada na lista de cartas.
    for (const assignment of assignments) {
      if (normalizePaioKey(assignment.concept) !== normalizePaioKey(concept)) continue;
      for (const name of assignment.detail.split(/\s+\+\s+/).map(part => part.trim()).filter(Boolean)) {
        const key = cardKey(name);
        if (!key || cards.has(key)) continue;
        cards.set(key, name);
        if (!counts.has(key)) manualCards.push(name);
      }
    }
    return cards.size ? [{ deck, cards: [...cards.values()], count: cards.size, ...(manualCards.length ? { manualCards } : {}) }] : [];
  }).sort((a,b) => b.count - a.count || a.deck.displayName.localeCompare(b.deck.displayName, "pt-BR"));
}

export type PaioRankedDeck<T extends PaioUsageDeck> = { deck: T; summary: PaioSummary; known: boolean };
export function rankPaioDecks<T extends PaioUsageDeck>(decks: T[], ratings: PaioRating[], config: PaioConfig): PaioRankedDeck<T>[] {
  return decks.filter(deck => !deck.deleted).map(deck => {
    const summary = calculatePaio(deck.decklistTexto, parsePaioAssignments(deck.paiometroConceitos), ratings, [deck.commander, deck.secondaryCommander], config);
    return { deck, summary, known: summary.hasDecklist || summary.items.length > 0 };
  }).sort((a,b) => Number(b.known) - Number(a.known) || b.summary.total - a.summary.total || a.deck.displayName.localeCompare(b.deck.displayName, "pt-BR"));
}
