import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronRight, Search, UserRound } from "lucide-react";
import { rankPaioDecks, type PaioUsageDeck } from "./paioDeckUsage";
import { normalizePaioName, type PaioRating } from "./paiometroDeck";
import type { PaioConfig } from "./paioConfig";
import "./paioUsageBrowser.css";
import "./paioPlayerRanking.css";

/** Identificadores persistentes (name) são usados para agrupar os decks. */
export type PaioRankingPlayer = {
  name: string;
  displayName?: string;
  photoUrl?: string;
  iconeKeyrune?: string;
};

type AuthoredDeck = PaioUsageDeck & {
  autor?: { jogador?: string; nome?: string } | null;
};

type PlayerScore<P extends PaioRankingPlayer> = {
  player: P;
  activeDecks: number;
  evaluatedDecks: number;
  partialDecks: number;
  average: number | null;
};

type Props<T extends PaioUsageDeck, P extends PaioRankingPlayer> = {
  players: P[];
  decks: T[];
  ratings: PaioRating[];
  config: PaioConfig;
  loading: boolean;
  failed: boolean;
  onOpenPlayer: (player: P) => void;
};

const format = (value: number) => value.toLocaleString("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function scoreColor(score: number) {
  const t = Math.min(1, score / 10);
  const hue = 140 - 130 * t;
  const light = score <= 10 ? 63 - 13 * t : Math.max(39, 50 - (score - 10) * 2);
  return `hsl(${hue} 80% ${light}%)`;
}

/**
 * Usa a mesma função de cálculo dos Paiômetros individuais.
 * Só entram na média os decks ativos, não excluídos, com decklist em texto.
 * O nome de exibição jamais substitui um ID de autor que esteja presente.
 */
export function rankPaioPlayers<T extends PaioUsageDeck, P extends PaioRankingPlayer>(
  players: P[], decks: T[], ratings: PaioRating[], config: PaioConfig,
): PlayerScore<P>[] {
  const byId = new Map(players.map((player) => [normalizePaioName(player.name), player]));
  const byVisibleName = new Map<string, P[]>();
  for (const player of players) {
    const visible = normalizePaioName(player.displayName || player.name);
    if (!visible) continue;
    const previous = byVisibleName.get(visible) || [];
    if (!previous.includes(player)) byVisibleName.set(visible, [...previous, player]);
  }

  const totals = new Map<P, { total: number; complete: number; partial: number; active: number }>();
  for (const { deck, summary } of rankPaioDecks(decks, ratings, config)) {
    if (deck.inactive || deck.deleted) continue;
    const author = (deck as AuthoredDeck).autor;
    if (!author) continue;

    let player: P | undefined;
    if (author.jogador?.trim()) {
      // Não confundir o ID com o nome exibido, mesmo após uma troca de apelido.
      player = byId.get(normalizePaioName(author.jogador));
    } else {
      const name = normalizePaioName(author.nome || "");
      player = byId.get(name);
      if (!player) {
        const possible = byVisibleName.get(name) || [];
        if (possible.length === 1) player = possible[0];
      }
    }
    if (!player) continue;
    const record = totals.get(player) || { total: 0, complete: 0, partial: 0, active: 0 };
    record.active += 1;
    if (summary.hasDecklist) {
      record.total += summary.total;
      record.complete += 1;
    } else {
      record.partial += 1;
    }
    totals.set(player, record);
  }

  return players.flatMap((player): PlayerScore<P>[] => {
    const record = totals.get(player);
    if (!record) return [];
    return [{
      player,
      activeDecks: record.active,
      evaluatedDecks: record.complete,
      partialDecks: record.partial,
      average: record.complete ? record.total / record.complete : null,
    }];
  });
}

export default function PaioPlayerRanking<T extends PaioUsageDeck, P extends PaioRankingPlayer>({
  players, decks, ratings, config, loading, failed, onOpenPlayer,
}: Props<T, P>) {
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(false);
  const entries = useMemo(() => rankPaioPlayers(players, decks, ratings, config), [players, decks, ratings, config]);
  const sorted = useMemo(() => entries
    .filter((entry) => entry.average !== null)
    .sort((a, b) => (ascending ? (a.average ?? 0) - (b.average ?? 0) : (b.average ?? 0) - (a.average ?? 0))
      || (a.player.displayName || a.player.name).localeCompare(b.player.displayName || b.player.name, "pt-BR"))
    .map((entry, index) => ({ ...entry, position: index + 1 })), [entries, ascending]);

  const matches = (entry: PlayerScore<P>) => normalizePaioName(
    `${entry.player.displayName || entry.player.name} ${entry.player.name}`,
  ).includes(normalizePaioName(query));

  const visible = sorted.filter(matches);
  const paia = visible.filter((entry) => (entry.average ?? 0) > 10);
  const healthy = visible.filter((entry) => (entry.average ?? 0) <= 10);
  const groups = ascending
    ? [{ name: "Jogadores não paias", detail: "Média de até 10 pontos", kind: "healthy", items: healthy },
        { name: "Jogadores paias", detail: "Média acima de 10 pontos", kind: "paia", items: paia }]
    : [{ name: "Jogadores paias", detail: "Média acima de 10 pontos", kind: "paia", items: paia },
        { name: "Jogadores não paias", detail: "Média de até 10 pontos", kind: "healthy", items: healthy }];
  const unknown = entries.filter((entry) => entry.average === null && matches(entry))
    .sort((a, b) => (a.player.displayName || a.player.name).localeCompare(b.player.displayName || b.player.name, "pt-BR"));

  const renderRow = (entry: PlayerScore<P>, position?: number) => (
    <button type="button" className="paio-usage-deck-row paio-ranking-row paio-player-row" key={entry.player.name}
      onClick={() => onOpenPlayer(entry.player)} aria-label={`Abrir perfil de ${entry.player.displayName || entry.player.name}`}>
      {position !== undefined ? <span className="paio-ranking-position">#{position}</span> : null}
      {entry.player.photoUrl
        ? <img className="paio-player-avatar" src={entry.player.photoUrl} alt="" loading="lazy" decoding="async" />
        : <span className="paio-player-avatar-placeholder"><UserRound size={23} aria-hidden="true" /></span>}
      <span className="paio-usage-deck-info"><strong>{entry.player.displayName || entry.player.name}</strong>
        <small>{entry.evaluatedDecks} {entry.evaluatedDecks === 1 ? "deck avaliado" : "decks avaliados"}
          {entry.partialDecks ? ` · ${entry.partialDecks} ${entry.partialDecks === 1 ? "parcial" : "parciais"}` : ""}</small></span>
      <span className="paio-ranking-score paio-player-score"
        style={entry.average !== null ? { color: scoreColor(entry.average) } : undefined}>
        {entry.average !== null ? `${format(entry.average)} pts` : "—"}
        <small>{entry.average !== null ? "média" : "Sem decklist"}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );

  if (loading && !decks.length) return <p className="card-ratings-message">Carregando jogadores e decks da liga...</p>;
  if (failed && !decks.length) return <p className="card-ratings-warning">Não foi possível carregar os dados da liga.</p>;

  return <section className="paio-deck-ranking paio-player-ranking" aria-label="Ranking de jogadores por média no Paiômetro">
    <h3>Ranking de jogadores por Paiômetro</h3>
    <p className="paio-usage-muted">Média dos pontos de todos os decks ativos de autoria de cada jogador, calculada com as mesmas regras do seu perfil. Toque em um jogador para abrir o perfil.</p>
    <div className="paio-ranking-toolbar">
      <label className="card-ratings-search"><Search size={18} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar jogador..." aria-label="Buscar jogador" /></label>
      <button type="button" className="paio-ranking-sort" aria-pressed={ascending}
        onClick={() => setAscending((value) => !value)}>
        <ArrowDownUp size={16} aria-hidden="true" />
        {ascending ? "Menor média primeiro" : "Maior média primeiro"}
      </button>
    </div>
    {groups.filter((group) => group.items.length).map((group, index) => (
      <section key={group.kind} className={`paio-ranking-group${index > 0 ? " paio-ranking-group-separated" : ""}`} aria-label={group.name}>
        <div className={`paio-ranking-group-heading paio-ranking-group-${group.kind}`}>
          <h5>{group.name}</h5><span>{group.detail} · {group.items.length} {group.items.length === 1 ? "jogador" : "jogadores"}</span>
        </div>
        <div className="paio-usage-decks">{group.items.map((entry) => renderRow(entry, entry.position))}</div>
      </section>
    ))}
    {!visible.length ? <p className="paio-usage-muted">Nenhum jogador avaliado corresponde à pesquisa.</p> : null}
    {unknown.length ? <section className="paio-ranking-secondary"><h4>Sem média disponível</h4>
      <p className="paio-usage-muted">Jogadores com decks ativos cadastrados, mas sem decklists completas. Não são considerados como zero pontos.</p>
      <div className="paio-usage-decks">{unknown.map((entry) => renderRow(entry))}</div>
    </section> : null}
    <p className="paio-usage-footnote">Decks inativos e excluídos não entram na média. Decks sem decklist em texto também não entram no divisor. As notas são atualizadas junto com o Paiômetro da comunidade.</p>
  </section>;
}
