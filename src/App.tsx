import { useEffect, useMemo, useState } from "react";
import { Trophy, Users, Wand2, RefreshCw, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import "./index.css";

const API_URL = "https://script.google.com/macros/s/AKfycbwureAMUuD7InHeJL72eailwyiYe-tafREBax46DTpqG4yNPnMrcs_ZGTQluvh-csNi/exec";

type RivalInfo = {
  nome: string;
  valor: number;
  label: string;
} | null;

type DeckAuthorInfo = {
  nome: string;
  iconeKeyrune: string;
  fotoUrl: string;
  titulo: string;
} | null;

type DeckOriginInfo = {
  tipo: string;
  label: string;
  iconUrl: string;
  keyruneClass: string;
} | null;

type ViewKey = "ranking" | "activity";

type ActivityPeriodKey = "geral" | "semana" | "mes" | "semestre" | "custom";

type ActivityBarItem = {
  label: string;
  value: number;
};

type ActivityEntityItem = {
  name: string;
  matches: number;
};

type ActivityMatch = {
  matchId: string;
  date: string;
  time: string;
  dateKey: string;
  hour: number | null;
  weekday: string;
  players: string[];
  winner: string;
  decks: string[];
  winningDeck: string;
};

type ActivityData = {
  summary: {
    totalMatches: number;
    mostActiveDay: ActivityBarItem | null;
    mostActiveHour: ActivityBarItem | null;
    mostActivePlayer: ActivityEntityItem | null;
    mostActiveDeck: ActivityEntityItem | null;
  };
  matchesByWeekday: ActivityBarItem[];
  matchesByHour: ActivityBarItem[];
  matchesByMonth: ActivityBarItem[];
  playersActivity: ActivityEntityItem[];
  decksActivity: ActivityEntityItem[];
  recentMatches: ActivityMatch[];
  matches: ActivityMatch[];
};

type KeyCard = {
  nome: string;
  imagemUrl: string;
  scryfallUrl: string;
};

type DeckMiniInfo = {
  nome: string;
  fotoUrl: string;
  comandante: string;
  cores: string;
  decklistUrl: string;
  valor: number | null;
  label: string;
} | null;

type RawPlayer = {
  jogador?: string;
  player?: string;
  nome?: string;
  jogos?: number | string;
  games?: number | string;
  vitorias?: number | string;
  wins?: number | string;
  winrate?: number | string;
  fotoUrl?: string;
  photoUrl?: string;
  titulo?: string;
  title?: string;
  bio?: string;
  rivalFrequente?: RivalInfo;
  carrasco?: RivalInfo;
  maiorPato?: RivalInfo;
  deckFavorito?: DeckMiniInfo;
  melhorDeck?: DeckMiniInfo;
  hasFblthp?: boolean;
  fblthpSince?: string;
  fblthpArtUrl?: string;
  iconeKeyrune?: string;
};

type RawDeck = {
  deck?: string;
  nome?: string;
  aparicoes?: number | string;
  appearances?: number | string;
  jogos?: number | string;
  vitorias?: number | string;
  wins?: number | string;
  winrate?: number | string;
  fotoUrl?: string;
  imageUrl?: string;
  photoUrl?: string;
  comandante?: string;
  commander?: string;
  cores?: string;
  colors?: string;
  bio?: string;
  decklistUrl?: string;
  rivalFrequente?: RivalInfo;
  carrasco?: RivalInfo;
  maiorPato?: RivalInfo;
  melhorPiloto?: RivalInfo;
  cartasChave?: KeyCard[];
  autor?: DeckAuthorInfo;
  origem?: DeckOriginInfo;
};

type Player = {
  name: string;
  games: number;
  wins: number;
  winrate: number;
  photoUrl: string;
  title: string;
  bio: string;
  rivalFrequente: RivalInfo;
  carrasco: RivalInfo;
  maiorPato: RivalInfo;
  deckFavorito: DeckMiniInfo;
  melhorDeck: DeckMiniInfo;
  hasFblthp: boolean;
  fblthpSince: string;
  fblthpArtUrl: string;
  iconeKeyrune: string;
};

type Deck = {
  name: string;
  appearances: number;
  wins: number;
  winrate: number;
  imageUrl: string;
  commander: string;
  colors: string;
  bio: string;
  decklistUrl: string;
  rivalFrequente: RivalInfo;
  carrasco: RivalInfo;
  maiorPato: RivalInfo;
  melhorPiloto: RivalInfo;
  cartasChave: KeyCard[];
  autor: DeckAuthorInfo;
  origem: DeckOriginInfo;
};

type FblthpTransfer = {
  matchId: string;
  from: string;
  to: string;
  date: string;
  time: string;
  artIndex?: number;
  artUrl?: string;
  previousArtIndex?: number;
  previousArtUrl?: string;
};

type FblthpState = {
  currentHolder: string;
  initialHolder: string;
  currentArtIndex: number;
  currentArtUrl: string;
  arts: string[];
  lastTransfer: FblthpTransfer | null;
  history: FblthpTransfer[];
};

type PeriodKey = "geral" | "mes" | "semestre";

type DashboardData = {
  updatedAt: string | null;
  fblthp: FblthpState | null;
  leaderboards: {
    geral: {
      label: string;
      players: RawPlayer[];
      decks: RawDeck[];
    };
    mes: {
      label: string;
      players: RawPlayer[];
      decks: RawDeck[];
    };
    semestre: {
      label: string;
      players: RawPlayer[];
      decks: RawDeck[];
    };
  };
  activity: ActivityData;
};

function formatPercent(value: number | string | undefined) {
  const number = Number(value || 0);
  return `${(number * 100).toFixed(1)}%`;
}

function getWinrateColor(value: number | string | undefined) {
  const percent = Math.max(0, Math.min(100, Number(value || 0) * 100));

  const stops = [
    { percent: 0, color: [239, 68, 68] },    // vermelho
    { percent: 25, color: [249, 115, 22] },  // laranja
    { percent: 50, color: [234, 179, 8] },   // amarelo
    { percent: 75, color: [34, 197, 94] },   // verde
    { percent: 100, color: [56, 189, 248] }, // azul
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];

    if (percent >= current.percent && percent <= next.percent) {
      const progress =
        (percent - current.percent) / (next.percent - current.percent);

      const r = Math.round(
        current.color[0] + (next.color[0] - current.color[0]) * progress
      );
      const g = Math.round(
        current.color[1] + (next.color[1] - current.color[1]) * progress
      );
      const b = Math.round(
        current.color[2] + (next.color[2] - current.color[2]) * progress
      );

      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  return "rgb(56, 189, 248)";
}

function medalFor(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function normalizePlayers(players: RawPlayer[] = []): Player[] {
  return players
    .map((item) => ({
      name: item.jogador || item.player || item.nome || "Jogador sem nome",
      games: Number(item.jogos || item.games || 0),
      wins: Number(item.vitorias || item.wins || 0),
      winrate: Number(item.winrate || 0),
      photoUrl: item.fotoUrl || item.photoUrl || "",
      title: item.titulo || item.title || "",
      bio: item.bio || "",
      rivalFrequente: item.rivalFrequente || null,
      carrasco: item.carrasco || null,
      maiorPato: item.maiorPato || null,
      deckFavorito: item.deckFavorito || null,
      melhorDeck: item.melhorDeck || null,
      hasFblthp: Boolean(item.hasFblthp),
      fblthpSince: item.fblthpSince || "",
      fblthpArtUrl: item.fblthpArtUrl || "",
      iconeKeyrune: item.iconeKeyrune || "",
    }))
    .sort((a, b) => {
      if (b.winrate !== a.winrate) return b.winrate - a.winrate;
      if (b.games !== a.games) return b.games - a.games;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
}

function normalizeDecks(decks: RawDeck[] = []): Deck[] {
  return decks
    .map((item) => ({
      name: item.deck || item.nome || "Deck sem nome",
      appearances: Number(item.aparicoes || item.appearances || item.jogos || 0),
      wins: Number(item.vitorias || item.wins || 0),
      winrate: Number(item.winrate || 0),
      imageUrl: item.fotoUrl || item.imageUrl || item.photoUrl || "",
      commander: item.comandante || item.commander || "",
      colors: item.cores || item.colors || "",
      bio: item.bio || "",
      decklistUrl: item.decklistUrl || "",
      rivalFrequente: item.rivalFrequente || null,
      carrasco: item.carrasco || null,
      maiorPato: item.maiorPato || null,
      melhorPiloto: item.melhorPiloto || null,
      cartasChave: item.cartasChave || [],
      autor: item.autor || null,
      origem: item.origem || null,
    }))
    .sort((a, b) => {
      if (b.winrate !== a.winrate) return b.winrate - a.winrate;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
}

function normalizeDeckColors(colors: string | undefined): string[] {
  if (!colors) return [];

  const text = colors.trim().toLowerCase();

  const namedMap: Record<string, string[]> = {
    branco: ["W"],
    white: ["W"],
    azul: ["U"],
    blue: ["U"],
    preto: ["B"],
    black: ["B"],
    vermelho: ["R"],
    red: ["R"],
    verde: ["G"],
    green: ["G"],
    colorless: ["C"],
    incolor: ["C"],
    incoloro: ["C"],
    azorius: ["W", "U"],
    dimir: ["U", "B"],
    rakdos: ["B", "R"],
    gruul: ["R", "G"],
    selesnya: ["G", "W"],
    orzhov: ["W", "B"],
    izzet: ["U", "R"],
    golgari: ["B", "G"],
    boros: ["R", "W"],
    simic: ["G", "U"],
    esper: ["W", "U", "B"],
    grixis: ["U", "B", "R"],
    jund: ["B", "R", "G"],
    naya: ["R", "G", "W"],
    bant: ["G", "W", "U"],
    abzan: ["W", "B", "G"],
    jeskai: ["U", "R", "W"],
    sultai: ["B", "G", "U"],
    mardu: ["R", "W", "B"],
    temur: ["G", "U", "R"],
    glint: ["W", "U", "B", "R"],
    dune: ["U", "B", "R", "G"],
    ink: ["B", "R", "G", "W"],
    witch: ["R", "G", "W", "U"],
    yore: ["W", "U", "B", "R"],
    wubrg: ["W", "U", "B", "R", "G"],
    fivecolor: ["W", "U", "B", "R", "G"],
    "five-color": ["W", "U", "B", "R", "G"],
    "5c": ["W", "U", "B", "R", "G"],
  };

  if (namedMap[text]) {
    return namedMap[text];
  }

  const compact = text.toUpperCase().replace(/[^WUBRG]/g, "");
  if (compact) {
    return [...new Set(compact.split(""))].filter((c): c is "W" | "U" | "B" | "R" | "G" =>
      ["W", "U", "B", "R", "G"].includes(c)
    );
  }

  return [];
}

function ManaPips({ colors }: { colors: string | undefined }) {
  const parsedColors = normalizeDeckColors(colors);

  if (!parsedColors.length) {
    return null;
  }

  return (
    <span className="mana-pips">
      {parsedColors.map((color) => (
        <img
          key={color}
          className="mana-pip"
          src={`https://svgs.scryfall.io/card-symbols/${color}.svg`}
          alt={color}
          title={color}
        />
      ))}
    </span>
  );
}

function StatPill({
  children,
  variant = "default",
  value,
}: {
  children: React.ReactNode;
  variant?: "default" | "winrate" | "wins" | "games";
  value?: number | string;
}) {
  const dynamicStyle =
    variant === "winrate"
      ? ({
          "--pill-color": getWinrateColor(value),
        } as React.CSSProperties)
      : undefined;

  return (
    <span className={`stat-pill stat-pill-${variant}`} style={dynamicStyle}>
      {children}
    </span>
  );
}

function LeaderboardCard({
  item,
  index,
  type,
  onClick,
  onFblthpClick,
}: {
  item: Player | Deck;
  index: number;
  type: "player" | "deck";
  onClick: () => void;
  onFblthpClick?: () => void;
}) {
  const isPlayer = type === "player";

  const hasFblthp = isPlayer && (item as Player).hasFblthp;

  const fblthpArtUrl = isPlayer ? (item as Player).fblthpArtUrl : "";

  const image = isPlayer ? (item as Player).photoUrl : (item as Deck).imageUrl;
  const gamesLabel = isPlayer ? "partidas" : "aparições";
  const gamesValue = isPlayer ? (item as Player).games : (item as Deck).appearances;

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className="leaderboard-card clickable"
    >

      {hasFblthp && fblthpArtUrl ? (
        <button
          className="fblthp-badge-button fblthp-badge-card-button"
          onClick={(event) => {
            event.stopPropagation();
            onFblthpClick?.();
          }}
          title="Este jogador está perdido com Fblthp"
        >
          <img
            className="fblthp-badge"
            src={fblthpArtUrl}
            alt="Fblthp holder"
          />
        </button>
      ) : null}

      <div className="rank">{medalFor(index)}</div>

      <div className={isPlayer ? "avatar player-avatar" : "avatar deck-avatar"}>
        {image ? (
          <img src={image} alt={item.name} />
        ) : (
          <div className="avatar-placeholder">
            {isPlayer ? <Users size={24} /> : <Wand2 size={24} />}
          </div>
        )}
      </div>

      <div className="card-info">
        <h3 className="name-with-title">
          <span className="player-name">{item.name}</span>

          {isPlayer && (item as Player).title ? (
            <span className="inline-title">{(item as Player).title}</span>
          ) : null}
        </h3>

        <div className="stats">
          <StatPill variant="winrate" value={item.winrate}>
            {formatPercent(item.winrate)} WR
          </StatPill>

          <StatPill variant="games">
            {gamesValue} {gamesLabel}
          </StatPill>

          <StatPill variant="wins">
            {item.wins} vitórias
          </StatPill>
        </div>

        {!isPlayer && ((item as Deck).commander || (item as Deck).colors) ? (
          <p className="deck-meta">
            {(item as Deck).commander ? (
              <span>{(item as Deck).commander}</span>
            ) : null}

            {(item as Deck).colors ? (
              <>
                {(item as Deck).commander ? <span> • </span> : null}
                <ManaPips colors={(item as Deck).colors} />
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-title">
        <div className="section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="cards-list">{children}</div>
    </section>
  );
}

function PlayerDeckMiniCard({
  title,
  deck,
  onClick,
}: {
  title: string;
  deck: DeckMiniInfo;
  onClick: (deckName: string) => void;
}) {
  if (!deck) return null;

  return (
    <button
      className="player-deck-mini-card"
      onClick={() => onClick(deck.nome)}
    >
      <div className="player-deck-mini-image">
        {deck.fotoUrl ? (
          <img src={deck.fotoUrl} alt={deck.nome} />
        ) : (
          <div className="avatar-placeholder">
            <Wand2 size={22} />
          </div>
        )}
      </div>

      <div className="player-deck-mini-info">
        <span>{title}</span>
        <strong>{deck.nome}</strong>

        <p>
          {deck.comandante ? <span>{deck.comandante}</span> : null}

          {deck.cores ? (
            <>
              {deck.comandante ? <span> • </span> : null}
              <ManaPips colors={deck.cores} />
            </>
          ) : null}
        </p>

        {typeof deck.valor === "number" && deck.label ? (
          <small>
            {deck.valor} {deck.label}
          </small>
        ) : null}
      </div>
    </button>
  );
}

function DeckPilotMiniCard({
  pilot,
  players,
  onClick,
}: {
  pilot: RivalInfo;
  players: Player[];
  onClick: (playerName: string) => void;
}) {
  if (!pilot) return null;

  const pilotPlayer = players.find((player) => player.name === pilot.nome);

  return (
    <button
      className="deck-pilot-mini-card"
      onClick={() => onClick(pilot.nome)}
    >
      <div className="deck-pilot-mini-icon">
        {pilotPlayer?.iconeKeyrune ? (
          <i className={pilotPlayer.iconeKeyrune} />
        ) : pilotPlayer?.photoUrl ? (
          <img src={pilotPlayer.photoUrl} alt={pilot.nome} />
        ) : (
          <Users size={22} />
        )}
      </div>

      <div className="deck-pilot-mini-info">
        <span>Melhor piloto</span>
        <strong>{pilot.nome}</strong>
        <small>
          {pilot.valor} {pilot.label}
        </small>
      </div>
    </button>
  );
}

function KeyCardsSection({ cards }: { cards: KeyCard[] }) {
  const visibleCards = cards.filter((card) => card.nome);

  if (!visibleCards.length) return null;

  return (
    <div className="profile-section key-cards-section">
      <h3>Cartas Chave</h3>

      <div className="key-cards-grid">
        {visibleCards.map((card) => {
          const content = (
            <>
              <div className="key-card-image">
                {card.imagemUrl ? (
                  <img src={card.imagemUrl} alt={card.nome} />
                ) : (
                  <div className="avatar-placeholder">
                    <Wand2 size={22} />
                  </div>
                )}
              </div>

              <strong>{card.nome}</strong>
            </>
          );

          if (card.scryfallUrl) {
            return (
              <a
                key={card.nome}
                className="key-card"
                href={card.scryfallUrl}
                target="_blank"
                rel="noreferrer"
              >
                {content}
              </a>
            );
          }

          return (
            <div key={card.nome} className="key-card">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeckProfileBadges({
  author,
  origin,
  onSelectAuthor,
  onOriginClick,
}: {
  author: DeckAuthorInfo;
  origin: DeckOriginInfo;
  onSelectAuthor: (playerName: string) => void;
  onOriginClick: () => void;
}) {
  if (!author && !origin) return null;

  return (
    <div className="deck-profile-floating-icons">
      {author ? (
        <button
          className="deck-floating-icon-button deck-author-icon-button"
          onClick={() => onSelectAuthor(author.nome)}
          title={`Autor: ${author.nome}`}
          aria-label={`Autor: ${author.nome}`}
        >
          {author.iconeKeyrune ? (
            <i className={author.iconeKeyrune} />
          ) : author.fotoUrl ? (
            <img src={author.fotoUrl} alt={author.nome} />
          ) : (
            <Users size={22} />
          )}
        </button>
      ) : null}

      {origin ? (
        <button
          className={
            origin.tipo === "Fixo"
              ? "deck-floating-icon-button deck-origin-icon deck-origin-fixed"
              : "deck-floating-icon-button deck-origin-icon deck-origin-away"
          }
          onClick={onOriginClick}
          title={`Origem: ${origin.tipo === "Fixo" ? "Salinha" : "Fora"}`}
          aria-label={`Origem: ${origin.tipo === "Fixo" ? "Salinha" : "Fora"}`}
        >
          {origin.iconUrl ? (
            <img src={origin.iconUrl} alt={origin.label} />
          ) : origin.keyruneClass ? (
            <i className={origin.keyruneClass} />
          ) : (
            <Wand2 size={22} />
          )}
        </button>
      ) : null}
    </div>
  );
}

function PlayerProfileIcon({
  player,
  onClick,
}: {
  player: Player;
  onClick: () => void;
}) {
  if (!player.iconeKeyrune) return null;

  return (
    <button
      className="player-profile-floating-icon"
      title={`Ver decks de ${player.name}`}
      aria-label={`Ver decks de ${player.name}`}
      onClick={onClick}
    >
      <i className={player.iconeKeyrune} />
    </button>
  );
}

function ProfileModal({
  selected,
  players,
  decks,
  onSelectPlayer,
  onSelectDeck,
  onFblthpClick,
  onOriginClick,
  onAuthorIconClick,
  onClose,
}: {
  selected: { type: "player"; item: Player } | { type: "deck"; item: Deck } | null;
  players: Player[];
  decks: Deck[];
  onSelectPlayer: (player: Player) => void;
  onSelectDeck: (deck: Deck) => void;
  onFblthpClick: () => void;
  onOriginClick: (origin: DeckOriginInfo) => void;
  onAuthorIconClick: (player: Player) => void;
  onClose: () => void;
}) {
  if (!selected) return null;

  const isPlayer = selected.type === "player";
  const item = selected.item;

  const image = isPlayer ? (item as Player).photoUrl : (item as Deck).imageUrl;

  const hasFblthp = isPlayer && (item as Player).hasFblthp;

  const fblthpArtUrl = isPlayer ? (item as Player).fblthpArtUrl : "";

  function openPlayerByName(name: string) {
    const player = players.find((player) => player.name === name);

    if (player) {
      onSelectPlayer(player);
    }
  }

  function openDeckByName(name: string) {
    const deck = decks.find((deck) => deck.name === name);

    if (deck) {
      onSelectDeck(deck);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="profile-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        {isPlayer ? (
          <PlayerProfileIcon
            player={item as Player}
            onClick={() => onAuthorIconClick(item as Player)}
          />
        ) : null}

        {!isPlayer && ((item as Deck).autor || (item as Deck).origem) ? (
          <DeckProfileBadges
            author={(item as Deck).autor}
            origin={(item as Deck).origem}
            onSelectAuthor={openPlayerByName}
            onOriginClick={() => {
              const origin = (item as Deck).origem;

              if (origin) {
                onOriginClick(origin);
              }
            }}
          />
        ) : null}

        {hasFblthp && fblthpArtUrl ? (
          <button
            className="fblthp-profile-badge fblthp-profile-icon-only"
            onClick={onFblthpClick}
            title={`Tem o Fblthp${
              (item as Player).fblthpSince
                ? ` desde ${(item as Player).fblthpSince}`
                : ""
            }`}
            aria-label={`Tem o Fblthp${
              (item as Player).fblthpSince
                ? ` desde ${(item as Player).fblthpSince}`
                : ""
            }`}
          >
            <img src={fblthpArtUrl} alt="Fblthp holder" />
          </button>
        ) : null}

        <div className="profile-header">
          <div className={isPlayer ? "profile-image player-profile-image" : "profile-image deck-profile-image"}>
            {image ? (
              <img src={image} alt={item.name} />
            ) : (
              <div className="avatar-placeholder">
                {isPlayer ? <Users size={36} /> : <Wand2 size={36} />}
              </div>
            )}
          </div>

          <div>
            <span className="profile-type">
              {isPlayer ? "Jogador" : "Deck"}
            </span>

            <h2>{item.name}</h2>

            {isPlayer && (item as Player).title ? (
              <p className="profile-subtitle">{(item as Player).title}</p>
            ) : null}

            {!isPlayer && ((item as Deck).commander || (item as Deck).colors) ? (
              <p className="profile-subtitle deck-profile-subtitle">
                {(item as Deck).commander ? (
                  <span>{(item as Deck).commander}</span>
                ) : null}

                {(item as Deck).colors ? (
                  <>
                    {(item as Deck).commander ? <span> • </span> : null}
                    <ManaPips colors={(item as Deck).colors} />
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="profile-stats profile-stats-pills">
          <StatPill variant="winrate" value={item.winrate}>
            {formatPercent(item.winrate)} WR
          </StatPill>

          <StatPill variant="games">
            {isPlayer ? (item as Player).games : (item as Deck).appearances}{" "}
            {isPlayer ? "partidas" : "aparições"}
          </StatPill>

          <StatPill variant="wins">
            {item.wins} vitórias
          </StatPill>

          {isPlayer &&
            ((item as Player).deckFavorito || (item as Player).melhorDeck) ? (
              <div className="player-deck-highlights">
                <PlayerDeckMiniCard
                  title="Deck favorito"
                  deck={(item as Player).deckFavorito}
                  onClick={openDeckByName}
                />

                <PlayerDeckMiniCard
                  title="Melhor deck"
                  deck={(item as Player).melhorDeck}
                  onClick={openDeckByName}
                />
              </div>
            ) : null}
        </div>

       {(() => {
  const rivalData = isPlayer
    ? {
        rivalFrequente: (item as Player).rivalFrequente,
        carrasco: (item as Player).carrasco,
        maiorPato: (item as Player).maiorPato,
      }
    : {
        rivalFrequente: (item as Deck).rivalFrequente,
        carrasco: (item as Deck).carrasco,
        maiorPato: (item as Deck).maiorPato,
      };

  function openRelatedProfile(name: string) {
    if (isPlayer) {
      openPlayerByName(name);
    } else {
      openDeckByName(name);
    }
  }

  if (
    !rivalData.rivalFrequente &&
    !rivalData.carrasco &&
    !rivalData.maiorPato
  ) {
    return null;
  }

  return (
    <div className="rival-grid">

      {!isPlayer && (item as Deck).melhorPiloto ? (
            <div className="deck-pilot-highlight">
              <DeckPilotMiniCard
                pilot={(item as Deck).melhorPiloto}
                players={players}
                onClick={openPlayerByName}
              />
            </div>
          ) : null}

      {rivalData.rivalFrequente ? (
        <div className="rival-card">
          <span>Rival frequente</span>

          <button
            className="rival-name-button"
            onClick={() => openRelatedProfile(rivalData.rivalFrequente!.nome)}
          >
            {rivalData.rivalFrequente.nome}
          </button>

          <p>
            {rivalData.rivalFrequente.valor}{" "}
            {rivalData.rivalFrequente.label}
          </p>
        </div>
      ) : null}

      {rivalData.carrasco ? (
        <div className="rival-card">
          <span>Carrasco</span>

          <button
            className="rival-name-button"
            onClick={() => openRelatedProfile(rivalData.carrasco!.nome)}
          >
            {rivalData.carrasco.nome}
          </button>

          <p>
            {rivalData.carrasco.valor} {rivalData.carrasco.label}
          </p>
        </div>
      ) : null}

      {rivalData.maiorPato ? (
        <div className="rival-card duck-card">
          <span>Maior pato</span>

          <button
            className="rival-name-button"
            onClick={() => openRelatedProfile(rivalData.maiorPato!.nome)}
          >
            {rivalData.maiorPato.nome}
          </button>

          <p>
            {rivalData.maiorPato.valor} {rivalData.maiorPato.label}
          </p>
        </div>
      ) : null}
    </div>
  );
})()}

        {"bio" in item && item.bio ? (
          <div className="profile-section">
            <h3>Bio</h3>
            <p>{item.bio}</p>
          </div>
        ) : null}

        {!isPlayer && (item as Deck).cartasChave?.length ? (
          <KeyCardsSection cards={(item as Deck).cartasChave} />
        ) : null}

        {!isPlayer && (item as Deck).decklistUrl ? (
          <a
            className="decklist-button"
            href={(item as Deck).decklistUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ver decklist
          </a>
        ) : null}
      </motion.div>
    </div>
  );
}

function MainTabs({
  activeView,
  onChange,
}: {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
}) {
  const tabs: { key: ViewKey; label: string; description: string }[] = [
    {
      key: "ranking",
      label: "Ranking",
      description: "Jogadores e decks",
    },
    {
      key: "activity",
      label: "Atividade",
      description: "Dias, horários e histórico",
    },
  ];

  return (
    <div className="main-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={
            activeView === tab.key
              ? "main-tab main-tab-active"
              : "main-tab"
          }
          onClick={() => onChange(tab.key)}
        >
          <strong>{tab.label}</strong>
          <span>{tab.description}</span>
        </button>
      ))}
    </div>
  );
}

function PeriodTabs({
  activePeriod,
  onChange,
}: {
  activePeriod: PeriodKey;
  onChange: (period: PeriodKey) => void;
}) {
  const tabs: { key: PeriodKey; label: string; description: string }[] = [
    {
      key: "geral",
      label: "Geral",
      description: "Desde sempre",
    },
    {
      key: "mes",
      label: "Mês",
      description: "Mês atual",
    },
    {
      key: "semestre",
      label: "Semestre",
      description: "Semestre atual",
    },
  ];

  return (
    <div className="period-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={
            activePeriod === tab.key
              ? "period-tab period-tab-active"
              : "period-tab"
          }
          onClick={() => onChange(tab.key)}
        >
          <strong>{tab.label}</strong>
          <span>{tab.description}</span>
        </button>
      ))}
    </div>
  );
}

function useIdlePageAutoScroll({
  enabled = true,
  idleDelay = 10000,
  scrollSpeed = 0.55,
  edgePause = 3000,
  resetKey,
}: {
  enabled?: boolean;
  idleDelay?: number;
  scrollSpeed?: number;
  edgePause?: number;
  resetKey?: string;
}) {
  useEffect(() => {
    if (!enabled) return;

    let idleTimer: number | undefined;
    let animationFrame: number | undefined;
    let direction: 1 | -1 = 1;
    let pausedUntil = 0;
    let isAutoScrolling = false;
    let virtualScroll = 0;

    function getScroller() {
      return document.scrollingElement || document.documentElement;
    }

    function getMaxScroll() {
      const scroller = getScroller();
      return Math.max(0, scroller.scrollHeight - window.innerHeight);
    }

    function getCurrentScroll() {
      return getScroller().scrollTop;
    }

    function setCurrentScroll(value: number) {
      const scroller = getScroller();
      const maxScroll = getMaxScroll();

      virtualScroll = Math.max(0, Math.min(value, maxScroll));
      scroller.scrollTop = virtualScroll;
    }

    function clearAnimation() {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
    }

    function startAutoScroll() {
      const maxScroll = getMaxScroll();

      if (maxScroll <= 2) {
        isAutoScrolling = false;
        return;
      }

      virtualScroll = getCurrentScroll();
      isAutoScrolling = true;
      clearAnimation();
      animationFrame = requestAnimationFrame(step);
    }

    function pauseAndRestartLater() {
      isAutoScrolling = false;
      clearAnimation();

      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }

      idleTimer = window.setTimeout(() => {
        startAutoScroll();
      }, idleDelay);
    }

    function step(timestamp: number) {
      if (!isAutoScrolling) return;

      const maxScroll = getMaxScroll();
      const currentScroll = getCurrentScroll();

      if (maxScroll <= 2) {
        isAutoScrolling = false;
        return;
      }

      if (timestamp < pausedUntil) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      const topSnapDistance = 80;
      const bottomSnapDistance = 8;

      if (direction === 1 && currentScroll >= maxScroll - bottomSnapDistance) {
        setCurrentScroll(maxScroll);
        direction = -1;
        pausedUntil = timestamp + edgePause;
      } else if (direction === -1 && currentScroll <= topSnapDistance) {
        setCurrentScroll(0);
        direction = 1;
        pausedUntil = timestamp + edgePause;
      } else {
        setCurrentScroll(currentScroll + direction * scrollSpeed);
      }

      animationFrame = requestAnimationFrame(step);
    }

    const userEvents = ["mousedown", "wheel", "touchstart", "keydown"];

    userEvents.forEach((eventName) => {
      window.addEventListener(eventName, pauseAndRestartLater, {
        passive: true,
      });
    });

    const initialTimer = window.setTimeout(() => {
      pauseAndRestartLater();
    }, 300);

    return () => {
      window.clearTimeout(initialTimer);

      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }

      clearAnimation();

      userEvents.forEach((eventName) => {
        window.removeEventListener(eventName, pauseAndRestartLater);
      });
    };
  }, [enabled, idleDelay, scrollSpeed, edgePause, resetKey]);
}

const emptyActivity: ActivityData = {
  summary: {
    totalMatches: 0,
    mostActiveDay: null,
    mostActiveHour: null,
    mostActivePlayer: null,
    mostActiveDeck: null,
  },
  matchesByWeekday: [],
  matchesByHour: [],
  matchesByMonth: [],
  playersActivity: [],
  decksActivity: [],
  recentMatches: [],
  matches: [],
};

function ActivitySummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="activity-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

function BarList({
  title,
  items,
  valueLabel = "partidas",
}: {
  title: string;
  items: ActivityBarItem[];
  valueLabel?: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="activity-panel">
      <h3>{title}</h3>

      <div className="bar-list">
        {items.length === 0 ? (
          <p className="empty-text">Sem dados suficientes.</p>
        ) : (
          items.map((item) => (
            <div className="bar-row" key={item.label}>
              <div className="bar-row-header">
                <span>{item.label}</span>
                <strong>
                  {item.value} {valueLabel}
                </strong>
              </div>

              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EntityActivityList({
  title,
  items,
  onSelectEntity,
}: {
  title: string;
  items: ActivityEntityItem[];
  onSelectEntity: (name: string) => void;
}) {
  const maxValue = Math.max(...items.map((item) => item.matches), 1);

  return (
    <div className="activity-panel">
      <h3>{title}</h3>

      <div className="bar-list">
        {items.length === 0 ? (
          <p className="empty-text">Sem dados suficientes.</p>
        ) : (
          items.slice(0, 10).map((item) => (
            <div className="bar-row" key={item.name}>
              <div className="bar-row-header">
                <button
                  className="activity-name-button"
                  onClick={() => onSelectEntity(item.name)}
                >
                  {item.name}
                </button>

                <strong>{item.matches} partidas</strong>
              </div>

              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(item.matches / maxValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentMatches({
  matches,
  onSelectPlayer,
  onSelectDeck,
}: {
  matches: ActivityMatch[];
  onSelectPlayer: (name: string) => void;
  onSelectDeck: (name: string) => void;
}) {
  return (
    <div className="activity-panel recent-matches-panel">
      <h3>Últimas partidas</h3>

      <div className="recent-matches-list">
        {matches.length === 0 ? (
          <p className="empty-text">Nenhuma partida registrada.</p>
        ) : (
          matches.map((match) => (
            <div className="recent-match-card" key={match.matchId}>
              <div className="recent-match-header">
                <strong>
                  {match.date} às {match.time}
                </strong>
                <span>#{match.matchId}</span>
              </div>

              <p>
                <b>Jogadores:</b>{" "}
                {match.players.map((player, index) => (
                  <span key={player}>
                    <button
                      className="inline-activity-link"
                      onClick={() => onSelectPlayer(player)}
                    >
                      {player}
                    </button>
                    {index < match.players.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>

              <p>
                <b>Vencedor:</b>{" "}
                {match.winner ? (
                  <button
                    className="inline-activity-link"
                    onClick={() => onSelectPlayer(match.winner)}
                  >
                    {match.winner}
                  </button>
                ) : (
                  "Não informado"
                )}
              </p>

              <p>
                <b>Decks:</b>{" "}
                {match.decks.map((deck, index) => (
                  <span key={deck}>
                    <button
                      className="inline-activity-link"
                      onClick={() => onSelectDeck(deck)}
                    >
                      {deck}
                    </button>
                    {index < match.decks.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>

              <p>
                <b>Deck vencedor:</b>{" "}
                {match.winningDeck ? (
                  <button
                    className="inline-activity-link"
                    onClick={() => onSelectDeck(match.winningDeck)}
                  >
                    {match.winningDeck}
                  </button>
                ) : (
                  "Não informado"
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentWeekStartKey() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;

  date.setDate(date.getDate() - diff);

  return dateToKey(date);
}

function getCurrentMonthStartKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function getCurrentSemesterStartKey() {
  const date = new Date();
  const semesterMonth = date.getMonth() <= 5 ? "01" : "07";

  return `${date.getFullYear()}-${semesterMonth}-01`;
}

function filterActivityMatches({
  matches,
  period,
  customStart,
  customEnd,
}: {
  matches: ActivityMatch[];
  period: ActivityPeriodKey;
  customStart: string;
  customEnd: string;
}) {
  if (period === "geral") {
    return matches;
  }

  let startKey = "";
  let endKey = "";

  if (period === "semana") {
    startKey = getCurrentWeekStartKey();
  }

  if (period === "mes") {
    startKey = getCurrentMonthStartKey();
  }

  if (period === "semestre") {
    startKey = getCurrentSemesterStartKey();
  }

  if (period === "custom") {
    startKey = customStart;
    endKey = customEnd;
  }

  return matches.filter((match) => {
    if (!match.dateKey) return false;

    if (startKey && match.dateKey < startKey) return false;
    if (endKey && match.dateKey > endKey) return false;

    return true;
  });
}

function getTopBarItem(items: ActivityBarItem[]) {
  const sorted = items
    .slice()
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.label.localeCompare(b.label);
    });

  if (!sorted.length || sorted[0].value === 0) {
    return null;
  }

  return sorted[0];
}

function buildActivityFromMatches(matches: ActivityMatch[]): ActivityData {
  const weekdays = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  const matchesByWeekdayMap: Record<string, number> = {};
  const matchesByHourMap: Record<string, number> = {};
  const matchesByMonthMap: Record<string, number> = {};
  const playersActivityMap: Record<string, number> = {};
  const decksActivityMap: Record<string, number> = {};

  weekdays.forEach((day) => {
    matchesByWeekdayMap[day] = 0;
  });

  for (let hour = 0; hour < 24; hour++) {
    matchesByHourMap[`${String(hour).padStart(2, "0")}h`] = 0;
  }

  matches.forEach((match) => {
    if (match.dateKey) {
      const [year, month, day] = match.dateKey.split("-");
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      const weekday = weekdays[date.getDay()];
      const monthLabel = `${month}/${year}`;

      matchesByWeekdayMap[weekday]++;

      if (!matchesByMonthMap[monthLabel]) {
        matchesByMonthMap[monthLabel] = 0;
      }

      matchesByMonthMap[monthLabel]++;
    }

    if (typeof match.hour === "number") {
      const hourLabel = `${String(match.hour).padStart(2, "0")}h`;
      matchesByHourMap[hourLabel]++;
    }

    match.players.forEach((player) => {
      playersActivityMap[player] = (playersActivityMap[player] || 0) + 1;
    });

    match.decks.forEach((deck) => {
      decksActivityMap[deck] = (decksActivityMap[deck] || 0) + 1;
    });
  });

  const matchesByWeekday = weekdays.map((day) => ({
    label: day,
    value: matchesByWeekdayMap[day] || 0,
  }));

  const matchesByHour = Object.keys(matchesByHourMap)
    .map((hour) => ({
      label: hour,
      value: matchesByHourMap[hour],
    }))
    .filter((item) => item.value > 0);

  const matchesByMonth = Object.keys(matchesByMonthMap).map((month) => ({
    label: month,
    value: matchesByMonthMap[month],
  }));

  const playersActivity = Object.keys(playersActivityMap)
    .map((player) => ({
      name: player,
      matches: playersActivityMap[player],
    }))
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      return a.name.localeCompare(b.name);
    });

  const decksActivity = Object.keys(decksActivityMap)
    .map((deck) => ({
      name: deck,
      matches: decksActivityMap[deck],
    }))
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      return a.name.localeCompare(b.name);
    });

  const recentMatches = matches
    .slice()
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.time.localeCompare(a.time))
    .slice(0, 10);

  const mostActivePlayer = playersActivity.length ? playersActivity[0] : null;
  const mostActiveDeck = decksActivity.length ? decksActivity[0] : null;

  return {
    summary: {
      totalMatches: matches.length,
      mostActiveDay: getTopBarItem(matchesByWeekday),
      mostActiveHour: getTopBarItem(matchesByHour),
      mostActivePlayer,
      mostActiveDeck,
    },
    matchesByWeekday,
    matchesByHour,
    matchesByMonth,
    playersActivity,
    decksActivity,
    recentMatches,
    matches,
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (text.includes(";") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function csvRow(values: unknown[]) {
  return values.map(csvEscape).join(";");
}

function downloadTextFile({
  filename,
  content,
  mimeType,
}: {
  filename: string;
  content: string;
  mimeType: string;
}) {
  const blob = new Blob(["\uFEFF" + content], {
    type: `${mimeType};charset=utf-8`,
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getActivityPeriodLabel({
  period,
  customStart,
  customEnd,
}: {
  period: ActivityPeriodKey;
  customStart: string;
  customEnd: string;
}) {
  if (period === "geral") return "Geral";
  if (period === "semana") return "Semana atual";
  if (period === "mes") return "Mês atual";
  if (period === "semestre") return "Semestre atual";

  if (customStart && customEnd) {
    return `${customStart} até ${customEnd}`;
  }

  if (customStart) {
    return `A partir de ${customStart}`;
  }

  if (customEnd) {
    return `Até ${customEnd}`;
  }

  return "Personalizado";
}

function buildActivityCsv({
  activity,
  periodLabel,
}: {
  activity: ActivityData;
  periodLabel: string;
}) {
  const lines: string[] = [];

  lines.push(csvRow(["Relatório de Atividade - MTG League"]));
  lines.push(csvRow(["Período", periodLabel]));
  lines.push(csvRow(["Gerado em", new Date().toLocaleString("pt-BR")]));
  lines.push("");

  lines.push(csvRow(["Resumo"]));
  lines.push(csvRow(["Total de partidas", activity.summary.totalMatches]));
  lines.push(csvRow([
    "Dia mais ativo",
    activity.summary.mostActiveDay?.label || "-",
    activity.summary.mostActiveDay?.value || 0,
  ]));
  lines.push(csvRow([
    "Horário mais ativo",
    activity.summary.mostActiveHour?.label || "-",
    activity.summary.mostActiveHour?.value || 0,
  ]));
  lines.push(csvRow([
    "Jogador mais ativo",
    activity.summary.mostActivePlayer?.name || "-",
    activity.summary.mostActivePlayer?.matches || 0,
  ]));
  lines.push(csvRow([
    "Deck mais usado",
    activity.summary.mostActiveDeck?.name || "-",
    activity.summary.mostActiveDeck?.matches || 0,
  ]));
  lines.push("");

  lines.push(csvRow(["Partidas por dia da semana"]));
  lines.push(csvRow(["Dia", "Partidas"]));
  activity.matchesByWeekday.forEach((item) => {
    lines.push(csvRow([item.label, item.value]));
  });
  lines.push("");

  lines.push(csvRow(["Partidas por horário"]));
  lines.push(csvRow(["Horário", "Partidas"]));
  activity.matchesByHour.forEach((item) => {
    lines.push(csvRow([item.label, item.value]));
  });
  lines.push("");

  lines.push(csvRow(["Jogadores mais ativos"]));
  lines.push(csvRow(["Jogador", "Partidas"]));
  activity.playersActivity.forEach((item) => {
    lines.push(csvRow([item.name, item.matches]));
  });
  lines.push("");

  lines.push(csvRow(["Decks mais usados"]));
  lines.push(csvRow(["Deck", "Partidas"]));
  activity.decksActivity.forEach((item) => {
    lines.push(csvRow([item.name, item.matches]));
  });
  lines.push("");

  lines.push(csvRow(["Partidas no período"]));
  lines.push(csvRow([
    "ID",
    "Data",
    "Hora",
    "Jogadores",
    "Vencedor",
    "Decks",
    "Deck vencedor",
  ]));

  activity.matches.forEach((match) => {
    lines.push(csvRow([
      match.matchId,
      match.date,
      match.time,
      match.players.join(", "),
      match.winner || "Não informado",
      match.decks.join(", "),
      match.winningDeck || "Não informado",
    ]));
  });

  return lines.join("\n");
}

function exportActivityCsv({
  activity,
  period,
  customStart,
  customEnd,
}: {
  activity: ActivityData;
  period: ActivityPeriodKey;
  customStart: string;
  customEnd: string;
}) {
  const periodLabel = getActivityPeriodLabel({
    period,
    customStart,
    customEnd,
  });

  const safePeriod = periodLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filename = `mtg-activity-report-${safePeriod || "geral"}.csv`;

  const csv = buildActivityCsv({
    activity,
    periodLabel,
  });

  downloadTextFile({
    filename,
    content: csv,
    mimeType: "text/csv",
  });
}

function ActivityView({
  activity,
  players,
  decks,
  onSelectPlayer,
  onSelectDeck,
}: {
  activity: ActivityData;
  players: Player[];
  decks: Deck[];
  onSelectPlayer: (player: Player) => void;
  onSelectDeck: (deck: Deck) => void;
}) {
  const [activityPeriod, setActivityPeriod] =
    useState<ActivityPeriodKey>("geral");

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function openPlayerByName(name: string) {
    const player = players.find((player) => player.name === name);

    if (player) {
      onSelectPlayer(player);
    }
  }

  function openDeckByName(name: string) {
    const deck = decks.find((deck) => deck.name === name);

    if (deck) {
      onSelectDeck(deck);
    }
  }

  const filteredActivity = useMemo(() => {
    const sourceMatches = activity.matches || [];

    const filteredMatches = filterActivityMatches({
      matches: sourceMatches,
      period: activityPeriod,
      customStart,
      customEnd,
    });

    return buildActivityFromMatches(filteredMatches);
  }, [activity.matches, activityPeriod, customStart, customEnd]);

  function handleExportActivity() {
    exportActivityCsv({
      activity: filteredActivity,
      period: activityPeriod,
      customStart,
      customEnd,
    });
  }

  const summary = filteredActivity.summary;

  return (
    <section className="activity-view">
      <div className="activity-filter-panel">
        <div className="activity-filter-header">
          <div>
            <h2>Atividade</h2>
            <p>Analise partidas por período, dia, horário, jogadores e decks.</p>
          </div>

          <button
            className="export-report-button"
            onClick={handleExportActivity}
            disabled={filteredActivity.summary.totalMatches === 0}
          >
            Exportar relatório
          </button>
        </div>

        <div className="activity-period-tabs">
          {[
            ["geral", "Geral"],
            ["semana", "Semana"],
            ["mes", "Mês"],
            ["semestre", "Semestre"],
            ["custom", "Personalizado"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={
                activityPeriod === key
                  ? "activity-period-tab activity-period-tab-active"
                  : "activity-period-tab"
              }
              onClick={() => setActivityPeriod(key as ActivityPeriodKey)}
            >
              {label}
            </button>
          ))}
        </div>

        {activityPeriod === "custom" ? (
          <div className="custom-date-filters">
            <label>
              Início
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
            </label>

            <label>
              Fim
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="activity-summary-grid">
        <ActivitySummaryCard
          label="Total de partidas"
          value={summary.totalMatches}
        />

        <ActivitySummaryCard
          label="Dia mais ativo"
          value={summary.mostActiveDay?.label || "-"}
          detail={
            summary.mostActiveDay
              ? `${summary.mostActiveDay.value} partidas`
              : undefined
          }
        />

        <ActivitySummaryCard
          label="Horário mais ativo"
          value={summary.mostActiveHour?.label || "-"}
          detail={
            summary.mostActiveHour
              ? `${summary.mostActiveHour.value} partidas`
              : undefined
          }
        />

        <ActivitySummaryCard
          label="Jogador mais ativo"
          value={summary.mostActivePlayer?.name || "-"}
          detail={
            summary.mostActivePlayer
              ? `${summary.mostActivePlayer.matches} partidas`
              : undefined
          }
        />
      </div>

      <div className="activity-grid">
        <BarList
          title="Partidas por dia da semana"
          items={filteredActivity.matchesByWeekday}
        />

        <BarList
          title="Partidas por horário"
          items={filteredActivity.matchesByHour}
        />

        <EntityActivityList
          title="Jogadores mais ativos"
          items={filteredActivity.playersActivity}
          onSelectEntity={openPlayerByName}
        />

        <EntityActivityList
          title="Decks mais usados"
          items={filteredActivity.decksActivity}
          onSelectEntity={openDeckByName}
        />
      </div>

      <RecentMatches
        matches={filteredActivity.recentMatches}
        onSelectPlayer={openPlayerByName}
        onSelectDeck={openDeckByName}
      />
    </section>
  );
}

function FblthpInfoModal({
  fblthp,
  onClose,
}: {
  fblthp: FblthpState | null;
  onClose: () => void;
}) {
  if (!fblthp) return null;

  const arts = fblthp.arts?.filter(Boolean) || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="fblthp-info-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="fblthp-info-header">
          <div className="fblthp-info-art-main">
            {fblthp.currentArtUrl ? (
              <img src={fblthp.currentArtUrl} alt="Fblthp atual" />
            ) : null}
          </div>

          <div>
            <span className="profile-type">Minigame</span>
            <h2>O Fblthp está perdido!</h2>

            <p>
              Atualmente, o Fblthp está com{" "}
              <strong>{fblthp.currentHolder || "ninguém"}</strong>.
            </p>

            {fblthp.lastTransfer ? (
              <p className="fblthp-last-transfer">
                Última troca: {fblthp.lastTransfer.from} perdeu para{" "}
                {fblthp.lastTransfer.to} em {fblthp.lastTransfer.date}
                {fblthp.lastTransfer.time
                  ? ` às ${fblthp.lastTransfer.time}`
                  : ""}
                .
              </p>
            ) : (
              <p className="fblthp-last-transfer">
                O Fblthp começou com {fblthp.initialHolder}.
              </p>
            )}
          </div>
        </div>

        <div className="fblthp-rules-card">
          <h3>Como funciona?</h3>

          <p>
            O Fblthp começa com um jogador inicial. Sempre que esse jogador
            participa de uma partida e perde, o vencedor da partida passa a
            carregar o Fblthp.
          </p>

          <p>
            Quando o Fblthp troca de dono, ele pode também trocar de arte. São
            cinco artes possíveis, cada uma com a mesma chance de aparecer.
          </p>

          <p>
            Se o dono atual não estiver na partida, nada acontece. Para pegar o
            Fblthp, você precisa derrotar quem está com ele.
          </p>
        </div>

        <div className="fblthp-arts-section">
          <h3>Artes possíveis</h3>

          <div className="fblthp-arts-grid">
            {arts.map((artUrl, index) => (
              <div
                key={artUrl}
                className={
                  artUrl === fblthp.currentArtUrl
                    ? "fblthp-art-option fblthp-art-option-active"
                    : "fblthp-art-option"
                }
              >
                <img src={artUrl} alt={`Arte ${index + 1} do Fblthp`} />
                <span>{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {fblthp.history?.length ? (
          <div className="fblthp-history">
            <h3>Histórico recente</h3>

            <div className="fblthp-history-list">
              {fblthp.history
                .slice()
                .reverse()
                .slice(0, 5)
                .map((transfer) => (
                  <div
                    className="fblthp-history-item"
                    key={`${transfer.matchId}-${transfer.from}-${transfer.to}`}
                  >
                    <span>
                      {transfer.from} → {transfer.to}
                    </span>
                    <small>
                      {transfer.date}
                      {transfer.time ? ` às ${transfer.time}` : ""}
                    </small>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

function OriginDecksModal({
  origin,
  decks,
  onSelectDeck,
  onClose,
}: {
  origin: DeckOriginInfo;
  decks: Deck[];
  onSelectDeck: (deck: Deck) => void;
  onClose: () => void;
}) {
  if (!origin) return null;

  const filteredDecks = decks.filter((deck) => {
    if (!deck.origem) return false;
    return deck.origem.tipo === origin.tipo;
  });

  const title =
    origin.tipo === "Fixo"
      ? "Decks fixos da salinha"
      : "Decks de fora";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="origin-decks-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="origin-decks-header">
          <div
            className={
              origin.tipo === "Fixo"
                ? "origin-decks-icon origin-decks-icon-fixed"
                : "origin-decks-icon origin-decks-icon-away"
            }
          >
            {origin.iconUrl ? (
              <img src={origin.iconUrl} alt={origin.label} />
            ) : origin.keyruneClass ? (
              <i className={origin.keyruneClass} />
            ) : (
              <Wand2 size={26} />
            )}
          </div>

          <div>
            <span className="profile-type">Origem</span>
            <h2>{title}</h2>
            <p>
              {filteredDecks.length}{" "}
              {filteredDecks.length === 1 ? "deck encontrado" : "decks encontrados"}
            </p>
          </div>
        </div>

        <div className="origin-decks-list">
          {filteredDecks.length === 0 ? (
            <div className="loading-box">Nenhum deck encontrado nessa origem.</div>
          ) : (
            filteredDecks.map((deck, index) => (
              <LeaderboardCard
                key={deck.name}
                item={deck}
                index={index}
                type="deck"
                onClick={() => onSelectDeck(deck)}
              />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AuthorDecksModal({
  author,
  decks,
  onSelectDeck,
  onClose,
}: {
  author: Player | null;
  decks: Deck[];
  onSelectDeck: (deck: Deck) => void;
  onClose: () => void;
}) {
  if (!author) return null;

  const filteredDecks = decks.filter((deck) => {
    if (!deck.autor) return false;
    return deck.autor.nome === author.name;
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="author-decks-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="author-decks-header">
          <div className="author-decks-icon">
            {author.iconeKeyrune ? (
              <i className={author.iconeKeyrune} />
            ) : author.photoUrl ? (
              <img src={author.photoUrl} alt={author.name} />
            ) : (
              <Users size={26} />
            )}
          </div>

          <div>
            <span className="profile-type">Autor</span>
            <h2>Decks de {author.name}</h2>
            <p>
              {filteredDecks.length}{" "}
              {filteredDecks.length === 1
                ? "deck encontrado"
                : "decks encontrados"}
            </p>
          </div>
        </div>

        <div className="author-decks-list">
          {filteredDecks.length === 0 ? (
            <div className="loading-box">
              Nenhum deck cadastrado para esse autor.
            </div>
          ) : (
            filteredDecks.map((deck, index) => (
              <LeaderboardCard
                key={deck.name}
                item={deck}
                index={index}
                type="deck"
                onClick={() => onSelectDeck(deck)}
              />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData>({
    updatedAt: null,
    fblthp: null,
    leaderboards: {
      geral: {
        label: "Geral",
        players: [],
        decks: [],
      },
      mes: {
        label: "Mês",
        players: [],
        decks: [],
      },
      semestre: {
        label: "Semestre",
        players: [],
        decks: [],
      },
    },
    activity: emptyActivity,
  });

  const [activeView, setActiveView] = useState<ViewKey>("ranking");

  const [activePeriod, setActivePeriod] = useState<PeriodKey>("geral");

  const [showAllDecks, setShowAllDecks] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProfile, setSelectedProfile] = useState<
  { type: "player"; item: Player } | { type: "deck"; item: Deck } | null
  >(null);

  const [isLargeScreen, setIsLargeScreen] = useState(
    window.matchMedia("(min-width: 900px)").matches
  );

  const [showFblthpInfo, setShowFblthpInfo] = useState(false);

  const [selectedOrigin, setSelectedOrigin] = useState<DeckOriginInfo>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<Player | null>(null);

  const allDecks = useMemo(
    () => normalizeDecks(data.leaderboards.geral.decks),
    [data.leaderboards.geral.decks]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 900px)");

    function handleChange(event: MediaQueryListEvent) {
      setIsLargeScreen(event.matches);
    }

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView, activePeriod]);

  async function loadData() {
    try {
      setError("");
      setLoading(true);

      const response = await fetch(`${API_URL}?t=${Date.now()}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os dados da liga.");
      }

      const json = await response.json();
      setData(json);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao carregar os dados.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setShowAllDecks(false);
  }, [activePeriod, activeView]);

  const activeLeaderboard =
  data.leaderboards?.[activePeriod] ?? {
    label: "Geral",
    players: [],
    decks: [],
  };

  const players = useMemo(
    () => normalizePlayers(activeLeaderboard.players),
    [activeLeaderboard.players]
  );

  const decks = useMemo(
    () => normalizeDecks(activeLeaderboard.decks),
    [activeLeaderboard.decks]
  );

  const initialDeckLimit = Math.max(players.length - 1, 1);

  const visibleDecks = showAllDecks
  ? decks
  : decks.slice(0, initialDeckLimit);

  const hasMoreDecks = decks.length > visibleDecks.length;

  useIdlePageAutoScroll({
    enabled:
      activeView === "ranking" &&
      selectedProfile === null &&
      isLargeScreen &&
      !loading,
    idleDelay: 10000,
    scrollSpeed: 0.9,
    edgePause: 3000,
    resetKey: `${activeView}-${activePeriod}-${players.length}-${decks.length}-${visibleDecks.length}-${showAllDecks}`,
  });

  return (
    <main className="page">
      <div className="container">
        <header className="hero">
          <div>
            <div className="badge">
              <Trophy size={14} />
              Liga Commander
            </div>

            <h1>Leaderboard - Formato Pina</h1>

            <p>
              Ranking automático por winrate. Em caso de empate, vence quem tem
              mais partidas registradas.
            </p>
          </div>

          <button onClick={loadData} disabled={loading} className="refresh-button">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Atualizar
          </button>
        </header>

        <MainTabs activeView={activeView} onChange={setActiveView} />

        {activeView === "ranking" ? (
          <PeriodTabs activePeriod={activePeriod} onChange={setActivePeriod} />
        ) : null}

        {error ? (
          <div className="error-box">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        ) : null}

        {loading && !players.length && !decks.length ? (
          <div className="loading-box">Carregando dados da liga...</div>
        ) : activeView === "activity" ? (
          <ActivityView
            activity={data.activity || emptyActivity}
            players={players}
            decks={decks}
            onSelectPlayer={(player) =>
              setSelectedProfile({ type: "player", item: player })
            }
            onSelectDeck={(deck) =>
              setSelectedProfile({ type: "deck", item: deck })
            }
          />
        ) : (
          <>
            <div className="leaderboards-grid">
              <Section
                icon={<Users size={22} />}
                title={`Melhores jogadores - ${activeLeaderboard.label}`}
                subtitle="Ordenado por winrate; desempate por número de partidas."
              >
                {players.map((player, index) => (
                  <LeaderboardCard
                    key={player.name}
                    item={player}
                    index={index}
                    type="player"
                    onClick={() => setSelectedProfile({ type: "player", item: player })}
                    onFblthpClick={() => setShowFblthpInfo(true)}
                  />
                ))}
              </Section>

              <Section
                icon={<Wand2 size={22} />}
                title={`Melhores decks - ${activeLeaderboard.label}`}
                subtitle="Ordenado por winrate; desempate por número de aparições."
              >
                {visibleDecks.map((deck, index) => (
                  <LeaderboardCard
                    key={deck.name}
                    item={deck}
                    index={index}
                    type="deck"
                    onClick={() => setSelectedProfile({ type: "deck", item: deck })}
                  />
                ))}

                {hasMoreDecks ? (
                  <button
                    className="show-more-decks-button"
                    onClick={() => setShowAllDecks(true)}
                  >
                    Mostrar mais decks
                    <span>
                      {decks.length - visibleDecks.length} restantes
                    </span>
                  </button>
                ) : showAllDecks && decks.length > initialDeckLimit ? (
                  <button
                    className="show-more-decks-button show-less-decks-button"
                    onClick={() => setShowAllDecks(false)}
                  >
                    Mostrar menos
                  </button>
                ) : null}
              </Section>
            </div>
          </>
        )}

        <footer>
          {data.updatedAt
            ? `Última atualização: ${data.updatedAt}`
            : "Dados carregados do Google Sheets"}
        </footer>
      </div>

      <ProfileModal
        selected={selectedProfile}
        players={players}
        decks={allDecks}
        onSelectPlayer={(player) =>
          setSelectedProfile({ type: "player", item: player })
        }
        onSelectDeck={(deck) =>
          setSelectedProfile({ type: "deck", item: deck })
        }
        onFblthpClick={() => setShowFblthpInfo(true)}
        onOriginClick={(origin) => setSelectedOrigin(origin)}
        onAuthorIconClick={(player) => setSelectedAuthor(player)}
        onClose={() => setSelectedProfile(null)}
      />

      {selectedOrigin ? (
        <OriginDecksModal
          origin={selectedOrigin}
          decks={allDecks}
          onSelectDeck={(deck) => {
            setSelectedOrigin(null);
            setSelectedProfile({ type: "deck", item: deck });
          }}
          onClose={() => setSelectedOrigin(null)}
        />
      ) : null}

      {selectedAuthor ? (
        <AuthorDecksModal
          author={selectedAuthor}
          decks={allDecks}
          onSelectDeck={(deck) => {
            setSelectedAuthor(null);
            setSelectedProfile({ type: "deck", item: deck });
          }}
          onClose={() => setSelectedAuthor(null)}
        />
      ) : null}

      {showFblthpInfo ? (
        <FblthpInfoModal
          fblthp={data.fblthp}
          onClose={() => setShowFblthpInfo(false)}
        />
      ) : null}
    </main>
  );
}