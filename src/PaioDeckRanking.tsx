import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronRight, Search } from "lucide-react";
import { rankPaioDecks, type PaioUsageDeck, type PaioRankedDeck } from "./paioDeckUsage";
import { normalizePaioName, type PaioRating } from "./paiometroDeck";
import type { PaioConfig } from "./paioConfig";
import "./paioUsageBrowser.css";

type Props<T extends PaioUsageDeck> = {
  decks: T[]; ratings: PaioRating[]; config: PaioConfig; loading: boolean; failed: boolean; onOpenDeck: (deck: T) => void;
};
function scoreColor(score: number) {
  const t = Math.min(1, score / 10);
  return `hsl(${140 - 130*t} 80% ${score <= 10 ? 63 - 13*t : Math.max(39, 50 - (score-10)*2)}%)`;
}
export default function PaioDeckRanking<T extends PaioUsageDeck>({ decks, ratings, config, loading, failed, onOpenDeck }: Props<T>) {
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [ascending, setAscending] = useState(false);
  const ranked = useMemo(() => rankPaioDecks(decks, ratings, config), [decks, ratings, config]);
  const eligible = useMemo(() => ranked
    .filter(entry => showInactive || !entry.deck.inactive)
    .sort((a, b) => Number(b.known) - Number(a.known)
      || (ascending ? a.summary.total - b.summary.total : b.summary.total - a.summary.total)
      || a.deck.displayName.localeCompare(b.deck.displayName, "pt-BR")), [ranked, showInactive, ascending]);
  const matches = ({ deck }: PaioRankedDeck<T>) => normalizePaioName(`${deck.displayName} ${deck.commander} ${deck.secondaryCommander}`).includes(normalizePaioName(query));
  // Mantém a posição original ao pesquisar; empates em pontos seguem ordem alfabética.
  const complete = eligible.filter(entry => entry.summary.hasDecklist);
  const partial = eligible.filter(entry => !entry.summary.hasDecklist && entry.known);
  const unknown = eligible.filter(entry => !entry.known);
  const visible = complete.map((entry, index) => ({ entry, position: index + 1 })).filter(({ entry }) => matches(entry));
  const paia = visible.filter(({ entry }) => entry.summary.total > 10);
  const naoPaia = visible.filter(({ entry }) => entry.summary.total <= 10);
  const groups = ascending
    ? [{ label: "Decks não paias", detail: "Até 10 pontos", kind: "healthy", entries: naoPaia }, { label: "Decks paias", detail: "Acima de 10 pontos", kind: "paia", entries: paia }]
    : [{ label: "Decks paias", detail: "Acima de 10 pontos", kind: "paia", entries: paia }, { label: "Decks não paias", detail: "Até 10 pontos", kind: "healthy", entries: naoPaia }];
  const visibleGroups = groups.filter(group => group.entries.length > 0);
  const row = (entry: PaioRankedDeck<T>, position?: number) => <button type="button" className="paio-usage-deck-row paio-ranking-row" key={entry.deck.name} onClick={() => onOpenDeck(entry.deck)}>
    {position !== undefined ? <span className="paio-ranking-position">#{position}</span> : null}
    {entry.deck.imageUrl ? <img src={entry.deck.imageUrl} alt="" loading="lazy" decoding="async"/> : <span className="paio-usage-deck-placeholder"/>}
    <span className="paio-usage-deck-info"><strong>{entry.deck.displayName}</strong><small>{entry.deck.commander}{entry.deck.secondaryCommander ? ` + ${entry.deck.secondaryCommander}` : ""}{entry.deck.inactive ? " · Inativo" : ""}{!entry.summary.hasDecklist ? " · Sem decklist em texto" : ""}</small></span>
    <span className="paio-ranking-score" style={{color: entry.known ? scoreColor(entry.summary.total) : undefined}}>{entry.known ? `${entry.summary.total} pts` : "—"}{entry.known && !entry.summary.hasDecklist ? <small>Parcial</small> : null}</span><ChevronRight size={18} aria-hidden="true"/>
  </button>;
  if (loading && !decks.length) return <p className="card-ratings-message">Carregando decklists da liga...</p>;
  if (failed && !decks.length) return <p className="card-ratings-warning">Não foi possível carregar os decks. Atualize o dashboard e tente novamente.</p>;
  return <section className="paio-deck-ranking" aria-label="Ranking de decks por pontos no Paiômetro">
    <h3>Ranking de decks por Paiômetro</h3>
    <p className="paio-usage-muted">{ascending ? "Do menor para o maior" : "Do maior para o menor"} número de pontos, calculados com as mesmas regras do perfil de cada deck. Clique para abrir o perfil.</p>
    <div className="paio-ranking-toolbar"><label className="card-ratings-search"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar deck ou comandante..." aria-label="Buscar deck ou comandante"/></label><label className="paio-ranking-filter"><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)}/> Incluir inativos</label><button type="button" className="paio-ranking-sort" aria-pressed={ascending} onClick={() => setAscending(current => !current)}><ArrowDownUp size={16} aria-hidden="true"/>{ascending ? "Menor pontuação primeiro" : "Maior pontuação primeiro"}</button></div>
    <h4>Decks com decklist ({complete.length})</h4>
    {visibleGroups.map((group, index) => <section key={group.kind} className={`paio-ranking-group${index > 0 ? " paio-ranking-group-separated" : ""}`} aria-label={group.label}>
      <div className={`paio-ranking-group-heading paio-ranking-group-${group.kind}`}><h5>{group.label}</h5><span>{group.detail} · {group.entries.length} {group.entries.length === 1 ? "deck" : "decks"}</span></div>
      <div className="paio-usage-decks">{group.entries.map(({ entry, position }) => row(entry, position))}</div>
    </section>)}
    {!visible.length ? <p className="paio-usage-muted">Nenhum deck com decklist corresponde à busca.</p> : null}
    {partial.some(matches) ? <section className="paio-ranking-secondary"><h4>Pontuação parcial</h4><p className="paio-usage-muted">Só considera os comandantes e atribuições identificadas. Estes decks ficam fora da classificação principal.</p><div className="paio-usage-decks">{partial.filter(matches).map(entry => row(entry))}</div></section> : null}
    {unknown.some(matches) ? <section className="paio-ranking-secondary"><h4>Sem pontuação disponível</h4><p className="paio-usage-muted">Sem decklist em texto e sem itens pontuados identificados; não equivale a zero pontos.</p><div className="paio-usage-decks">{unknown.filter(matches).map(entry => row(entry))}</div></section> : null}
    <p className="paio-usage-footnote">Decks excluídos não participam. A classificação é atualizada com as médias e configurações globais.</p>
  </section>;
}
