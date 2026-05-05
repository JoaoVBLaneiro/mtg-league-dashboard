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
};

type PeriodKey = "geral" | "mes" | "semestre";

type DashboardData = {
  updatedAt: string | null;
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
    }))
    .sort((a, b) => {
      if (b.winrate !== a.winrate) return b.winrate - a.winrate;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
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
}: {
  item: Player | Deck;
  index: number;
  type: "player" | "deck";
  onClick: () => void;
}) {
  const isPlayer = type === "player";

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
          <p>{[(item as Deck).commander, (item as Deck).colors].filter(Boolean).join(" • ")}</p>
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

function ProfileModal({
  selected,
  players,
  decks,
  onSelectPlayer,
  onSelectDeck,
  onClose,
}: {
  selected: { type: "player"; item: Player } | { type: "deck"; item: Deck } | null;
  players: Player[];
  decks: Deck[];
  onSelectPlayer: (player: Player) => void;
  onSelectDeck: (deck: Deck) => void;
  onClose: () => void;
}) {
  if (!selected) return null;

  const isPlayer = selected.type === "player";
  const item = selected.item;

  const image = isPlayer ? (item as Player).photoUrl : (item as Deck).imageUrl;

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
              <p className="profile-subtitle">
                {[(item as Deck).commander, (item as Deck).colors]
                  .filter(Boolean)
                  .join(" • ")}
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
  idleDelay = 13000,
  scrollSpeed = 0.5,
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

    function clearAnimation() {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
    }

    function getMaxScroll() {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ) - window.innerHeight;
    }

    function startAutoScroll() {
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

      idleTimer = window.setTimeout(startAutoScroll, idleDelay);
    }

    function step(timestamp: number) {
      if (!isAutoScrolling) return;

      const maxScroll = getMaxScroll();

      if (maxScroll <= 2) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      if (timestamp < pausedUntil) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      const currentScroll = window.scrollY;

      if (direction === 1 && currentScroll >= maxScroll - 2) {
        direction = -1;
        pausedUntil = timestamp + edgePause;
      } else if (direction === -1 && currentScroll <= 2) {
        direction = 1;
        pausedUntil = timestamp + edgePause;
      } else {
        window.scrollBy(0, direction * scrollSpeed);
      }

      animationFrame = requestAnimationFrame(step);
    }

    const userEvents = [
      "mousemove",
      "mousedown",
      "wheel",
      "touchstart",
      "keydown",
    ];

    userEvents.forEach((eventName) => {
      window.addEventListener(eventName, pauseAndRestartLater, {
        passive: true,
      });
    });

    pauseAndRestartLater();

    return () => {
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

export default function App() {
  const [data, setData] = useState<DashboardData>({
    updatedAt: null,
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
  });

  const [activePeriod, setActivePeriod] = useState<PeriodKey>("geral");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProfile, setSelectedProfile] = useState<
  { type: "player"; item: Player } | { type: "deck"; item: Deck } | null
  >(null);

  useIdlePageAutoScroll({
    enabled: selectedProfile === null,
    idleDelay: 10000,
    scrollSpeed: 0.55,
    edgePause: 3000,
    resetKey: activePeriod,
  });

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

        <PeriodTabs activePeriod={activePeriod} onChange={setActivePeriod} />

        {error ? (
          <div className="error-box">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        ) : null}

        {loading && !players.length && !decks.length ? (
          <div className="loading-box">Carregando dados da liga...</div>
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
                  />
                ))}
              </Section>

              <Section
                icon={<Wand2 size={22} />}
                title={`Melhores decks - ${activeLeaderboard.label}`}
                subtitle="Ordenado por winrate; desempate por número de aparições."
              >
                {decks.map((deck, index) => (
                  <LeaderboardCard
                    key={deck.name}
                    item={deck}
                    index={index}
                    type="deck"
                    onClick={() => setSelectedProfile({ type: "deck", item: deck })}
                  />
                ))}
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
        decks={decks}
        onSelectPlayer={(player) =>
          setSelectedProfile({ type: "player", item: player })
        }
        onSelectDeck={(deck) =>
          setSelectedProfile({ type: "deck", item: deck })
        }
        onClose={() => setSelectedProfile(null)}
      />
    </main>
  );
}