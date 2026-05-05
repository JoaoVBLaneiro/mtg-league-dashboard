import { useEffect, useMemo, useState } from "react";
import { Trophy, Users, Wand2, RefreshCw, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import "./index.css";

const API_URL = "https://script.google.com/macros/s/AKfycbwureAMUuD7InHeJL72eailwyiYe-tafREBax46DTpqG4yNPnMrcs_ZGTQluvh-csNi/exec";

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
};

type Player = {
  name: string;
  games: number;
  wins: number;
  winrate: number;
  photoUrl: string;
  title: string;
  bio: string;
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
};

type DashboardData = {
  players: RawPlayer[];
  decks: RawDeck[];
  updatedAt: string | null;
};

function formatPercent(value: number | string | undefined) {
  const number = Number(value || 0);
  return `${(number * 100).toFixed(1)}%`;
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
    }))
    .sort((a, b) => {
      if (b.winrate !== a.winrate) return b.winrate - a.winrate;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
}

function StatPill({ children }: { children: React.ReactNode }) {
  return <span className="stat-pill">{children}</span>;
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
        <h3>{item.name}</h3>

        <div className="stats">
          <StatPill>{formatPercent(item.winrate)} WR</StatPill>
          <StatPill>
            {gamesValue} {gamesLabel}
          </StatPill>
          <StatPill>{item.wins} vitórias</StatPill>
        </div>

        {isPlayer && (item as Player).title ? <p>{(item as Player).title}</p> : null}

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
  onClose,
}: {
  selected: { type: "player"; item: Player } | { type: "deck"; item: Deck } | null;
  onClose: () => void;
}) {
  if (!selected) return null;

  const isPlayer = selected.type === "player";
  const item = selected.item;

  const image = isPlayer ? (item as Player).photoUrl : (item as Deck).imageUrl;

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

        <div className="profile-stats">
          <div>
            <span>Winrate</span>
            <strong>{formatPercent(item.winrate)}</strong>
          </div>

          <div>
            <span>{isPlayer ? "Partidas" : "Aparições"}</span>
            <strong>
              {isPlayer ? (item as Player).games : (item as Deck).appearances}
            </strong>
          </div>

          <div>
            <span>Vitórias</span>
            <strong>{item.wins}</strong>
          </div>
        </div>

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

export default function App() {
  const [data, setData] = useState<DashboardData>({
    players: [],
    decks: [],
    updatedAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProfile, setSelectedProfile] = useState<
  { type: "player"; item: Player } | { type: "deck"; item: Deck } | null
  >(null);

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

  const players = useMemo(() => normalizePlayers(data.players), [data.players]);
  const decks = useMemo(() => normalizeDecks(data.decks), [data.decks]);

  return (
    <main className="page">
      <div className="container">
        <header className="hero">
          <div>
            <div className="badge">
              <Trophy size={14} />
              Liga Commander
            </div>

            <h1>MTG Leaderboard</h1>

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
            <Section
              icon={<Users size={22} />}
              title="Melhores jogadores"
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
              title="Melhores decks"
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
  onClose={() => setSelectedProfile(null)}
/>
    </main>
  );
}