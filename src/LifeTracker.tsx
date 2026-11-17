import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { getDeckBackgroundImage, isAvailableDeck, readDeckCategories } from "./deckMetadata";
import { DeckLabels } from "./DeckLabels";
import "./lifeTracker.css";

type PlayerMarkerType = "poison" | "experience" | "radiation";

type PlayerMarkers = Record<PlayerMarkerType, number>;

const PLAYER_MARKER_LABELS: Record<PlayerMarkerType, string> = {
  poison: "Veneno",
  experience: "Experiência",
  radiation: "Radiação",
};

const PLAYER_MARKER_SHORT_LABELS: Record<PlayerMarkerType, string> = {
  poison: "VEN",
  experience: "EXP",
  radiation: "RAD",
};

const PLAYER_MARKER_ICONS: Record<PlayerMarkerType, string> = {
  poison: "☠",
  experience: "✦",
  radiation: "☢",
};

type LifePlayerSlot = {
  id: string;
  label: string;
  life: number;
  pendingDelta: number;
  deltaVisible: boolean;
  playerName: string;
  playerCanonicalName: string;
  playerIcon: string;
  deckName: string; // Identificador estável usado para registrar partidas.
  deckDisplayName: string; // Nome amigável exibido no app.
  deckImageUrl: string;
  deckCommanderName: string;
  deckSecondaryCommanderName: string;
  deckSecondaryCommanderType: string;
  commanderDamage: Record<string, number>;
  selfCommanderDamage: Record<string, number>;
  markers: PlayerMarkers;
  isEliminated: boolean;
  eliminatedByPlayerId: string;
};

const LIFE_TOTAL_OPTIONS = [20, 25, 30, 40, 50, 60];
const PLAYER_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

// A causa visual depende de um único comandante com 21+ de dano.
// Não somar danos de comandantes diferentes.
type LifeEliminationCause = "commander" | "poison" | "normal";

const LIFE_ELIMINATION_ICONS: Record<LifeEliminationCause, string> = {
  commander: "ss-e01", // Archenemy: Nicol Bolas (zero, não a letra O).
  poison: "ss-nph",    // New Phyrexia.
  normal: "ss-bok",    // Betrayers of Kamigawa.
};

function getLifeEliminationCause(player: LifePlayerSlot): LifeEliminationCause {
  // Ambos os registros são por comandante, não por jogador.
  const defeatedByCommander =
    Object.values(player.commanderDamage).some((damage) => damage >= 21) ||
    Object.values(player.selfCommanderDamage).some((damage) => damage >= 21);

  if (defeatedByCommander) return "commander";
  if ((player.markers.poison ?? 0) >= 10) return "poison";
  return "normal";
}

const DASHBOARD_API_URL =
  "https://api.corneliomove.com.br/mtg-api/api/dashboard";

const MATCH_API_URL =
  "https://api.corneliomove.com.br/mtg-api/api/matches";
const LIFE_TRANSFER_API_URL =
  "https://api.corneliomove.com.br/mtg-api/api/life-transfers";

type LifeTransferSnapshot = {
  version: 1;
  requestId: string;
  startedAt: string;
  startingLife: number;
  playerCount: number;
  players: LifePlayerSlot[];
};

type LifeTransferSummary = {
  id: string;
  revision: number;
  updatedAt: string;
  startedAt: string;
  playerCount: number;
  players: Array<{ name: string; deck: string; eliminated: boolean }>;
};

type ActiveLifeTransfer = { id: string; revision: number };

function transferSnapshot(
  players: LifePlayerSlot[], startingLife: number, playerCount: number,
  requestId: string, startedAt: string
): LifeTransferSnapshot {
  return {
    version: 1,
    requestId,
    startedAt,
    startingLife,
    playerCount,
    players: players.map(player => ({ ...player, pendingDelta: 0, deltaVisible: false })),
  };
}

async function transferApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Servidor indisponível (${response.status}).`);
  }
  return body as T;
}


function createMatchRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type LeaguePlayerOption = {
  name: string;
  canonicalName: string;
  icon: string;
  matches: number;
  favoriteDeckName: string;
  bestDeckName: string;
};

type LeagueDeckOption = {
  categories: string[];
  inactive: boolean;
  name: string; // Identificador interno do deck.
  displayName: string;
  commander: string;
  imageUrl: string;
  secondaryCommander: string;
  secondaryCommanderImageUrl: string;
  secondaryCommanderType: string;
  authorName: string; // Identificador interno do autor.
  authorDisplayName: string;
};

type DashboardApiPlayer = {
  jogador?: string;
  player?: string;
  nome?: string;
  nomeExibicao?: string;
  iconeKeyrune?: string;
  keyruneIcon?: string;
  icon?: string;
  icone?: string;
  partidas?: number | string;
  jogos?: number | string;
  appearances?: number | string;
  totalPartidas?: number | string;
  deckFavorito?: unknown;
  melhorDeck?: unknown;
};

type DashboardApiDeck = {
  categorias?: string[];
  inativo?: boolean;
  excluido?: boolean;
  deck?: string;
  nome?: string;
  comandante?: string;
  commander?: string;

  fotoUrl?: string;
  arteUrl?: string;
  artUrl?: string;
  imageUrl?: string;
  photoUrl?: string;

  comandanteSecundario?: string;
  secondaryCommander?: string;

  fotoComandanteSecundario?: string;
  secondaryCommanderImageUrl?: string;

  tipoComandanteSecundario?: string;
  secondaryCommanderType?: string;

  autor?: unknown;
  author?: unknown;
  autorNome?: string;
  authorName?: string;
  owner?: string;
};

type DashboardApiResponse = {
  catalog?: {
    players?: DashboardApiPlayer[];
    decks?: DashboardApiDeck[];
  };

  leaderboards?: {
    geral?: {
      players?: DashboardApiPlayer[];
      decks?: DashboardApiDeck[];
    };
  };
};

type CommanderDamageSource = {
    damageKey: string;
    sourcePlayer: LifePlayerSlot;
    commanderName: string;
    commanderSlot: "primary" | "secondary";
    iconClass: string;
    damage: number;
  };

type SelectionModalState = {
  playerSlotId: string;
  type: "player" | "deck";
} | null;

function normalizeKeyruneIcon(icon: string) {
  const cleanIcon = icon.trim();

  if (!cleanIcon) return "";
  if (cleanIcon.startsWith("ss-")) return cleanIcon;

  return `ss-${cleanIcon}`;
}

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mergeCatalogWithLeaderboardStats<T extends Record<string, unknown>>(
  catalogItems: T[],
  leaderboardItems: T[],
  getName: (item: T) => string
) {
  const leaderboardMap = new Map<string, T>();

  leaderboardItems.forEach((item) => {
    const name = normalizeComparableText(getName(item));

    if (name) {
      leaderboardMap.set(name, item);
    }
  });

  const mergedItems = catalogItems.map((catalogItem) => {
    const name = normalizeComparableText(getName(catalogItem));
    const leaderboardItem = leaderboardMap.get(name);

    if (!leaderboardItem) {
      return catalogItem;
    }

    return {
      ...catalogItem,
      partidas:
        leaderboardItem.partidas ??
        leaderboardItem.jogos ??
        catalogItem.partidas ??
        catalogItem.jogos ??
        0,
      jogos:
        leaderboardItem.jogos ??
        leaderboardItem.partidas ??
        catalogItem.jogos ??
        catalogItem.partidas ??
        0,
      appearances:
        leaderboardItem.appearances ??
        leaderboardItem.aparicoes ??
        catalogItem.appearances ??
        catalogItem.aparicoes ??
        0,
      totalPartidas:
        leaderboardItem.totalPartidas ??
        leaderboardItem.jogos ??
        leaderboardItem.partidas ??
        catalogItem.totalPartidas ??
        0,
      aparicoes:
        leaderboardItem.aparicoes ??
        leaderboardItem.appearances ??
        catalogItem.aparicoes ??
        catalogItem.appearances ??
        0,
      vitorias:
        leaderboardItem.vitorias ??
        catalogItem.vitorias ??
        0,
      winrate:
        leaderboardItem.winrate ??
        catalogItem.winrate ??
        0,
      melhorDeck:
        leaderboardItem.melhorDeck ?? catalogItem.melhorDeck,
      deckFavorito:
        catalogItem.deckFavorito ?? leaderboardItem.deckFavorito,
    };
  });

  const catalogNames = new Set(
    catalogItems.map((item) => normalizeComparableText(getName(item)))
  );

  const missingLeaderboardItems = leaderboardItems.filter((item) => {
    const name = normalizeComparableText(getName(item));
    return name && !catalogNames.has(name);
  });

  return [...mergedItems, ...missingLeaderboardItems];
}

function isSameText(a: string, b: string) {
  return normalizeComparableText(a) === normalizeComparableText(b);
}

function getSelectedPlayerNamesExcludingSlot(
  players: LifePlayerSlot[],
  currentSlotId?: string
) {
  return players
    .filter((player) => player.id !== currentSlotId)
    .map((player) => player.playerCanonicalName || player.playerName)
    .filter(Boolean);
}

function getSelectedDeckNamesExcludingSlot(
  players: LifePlayerSlot[],
  currentSlotId?: string
) {
  return players
    .filter((player) => player.id !== currentSlotId)
    .map((player) => player.deckName)
    .filter(Boolean);
}

function getApiMiniName(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    return String(
      record.deck ||
        record.jogador ||
        record.player ||
        record.legacy_name ||
        record.nome ||
        record.name ||
        ""
    ).trim();
  }

  return "";
}

function getApiDisplayName(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  return String(
    record.nomeExibicao ||
    record.nome ||
    record.name ||
    record.jogador ||
    record.deck ||
    ""
  ).trim();
}

function normalizeNumber(value: number | string | undefined) {
  if (value === undefined || value === null) return 0;

  const parsed = Number(String(value).replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

  async function requestOrientationMode(mode: "portrait" | "landscape") {
  try {
    const root = document.documentElement;

    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen();
    }

    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };

    if (orientation.lock) {
      await orientation.lock(mode);
    }
  } catch (error) {
    console.warn(`Não foi possível travar em ${mode}:`, error);
  }
}

async function requestLandscapeMode() {
  await requestOrientationMode("landscape");
}

async function requestPortraitMode() {
  await requestOrientationMode("portrait");
}

export default function LifeTrackerApp() {
  const [startingLife, setStartingLife] = useState(40);
  const [playerCount, setPlayerCount] = useState(4);
  const [matchStarted, setMatchStarted] = useState(false);
  const [players, setPlayers] = useState<LifePlayerSlot[]>([]);

  const [leaguePlayers, setLeaguePlayers] = useState<LeaguePlayerOption[]>([]);
  const [leagueDecks, setLeagueDecks] = useState<LeagueDeckOption[]>([]);
  const [selectionModal, setSelectionModal] = useState<SelectionModalState>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [leagueDataLoading, setLeagueDataLoading] = useState(false);
  const [leagueDataError, setLeagueDataError] = useState("");
  const [markerModalPlayerId, setMarkerModalPlayerId] = useState<string | null>(
    null
  );
  const [killModalTargetPlayerId, setKillModalTargetPlayerId] = useState<string | null>(null);
  const [commanderDamageModalPlayerId, setCommanderDamageModalPlayerId] = useState<string | null>(null);

  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState("");
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [matchSubmitError, setMatchSubmitError] = useState("");

  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const deltaTimeoutsRef = useRef<Record<string, number>>({});
  const holdStartTimeRef = useRef(0);
  // O toque na area livre so vira mudanca de vida quando nao for rolagem.
  const boardHoldTimeoutRef = useRef<number | null>(null);
  const boardGestureRef = useRef<{
    pointerId: number;
    playerId: string;
    direction: 1 | -1;
    startX: number;
    startY: number;
    holding: boolean;
  } | null>(null);
  const [fullscreenError, setFullscreenError] = useState("");

  const matchRequestIdRef = useRef("");
  const matchStartedAtRef = useRef("");
  const activeTransferRef = useRef<ActiveLifeTransfer | null>(null);
  const transferSavedRef = useRef("");
  const transferInFlightRef = useRef<Promise<void> | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferListOpen, setTransferListOpen] = useState(false);
  const [transferListLoading, setTransferListLoading] = useState(false);
  const [transferSessions, setTransferSessions] = useState<LifeTransferSummary[]>([]);
  const [transferListError, setTransferListError] = useState("");

  function currentTransferSnapshot(): LifeTransferSnapshot {
    return transferSnapshot(
      players, startingLife, players.length,
      matchRequestIdRef.current, matchStartedAtRef.current
    );
  }

  // Evita substituir uma partida atualizada em outro celular.
  // Uma gravacao precisa terminar antes da proxima iniciar.
  async function persistActiveTransfer(snapshot: LifeTransferSnapshot, keepalive = false): Promise<void> {
    while (transferInFlightRef.current) {
      await transferInFlightRef.current.catch(() => undefined);
    }
    const active = activeTransferRef.current;
    if (!active) return;
    const serialized = JSON.stringify(snapshot);
    if (serialized === transferSavedRef.current) return;
    const work = (async () => {
      const result = await transferApi<{ ok: true; revision: number }>(
        `${LIFE_TRANSFER_API_URL}/${encodeURIComponent(active.id)}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, keepalive,
          body: JSON.stringify({ expectedRevision: active.revision, snapshot }) }
      );
      // Nao alterar a referencia se o usuario abriu outra partida enquanto enviava.
      if (activeTransferRef.current === active) {
        active.revision = result.revision;
        transferSavedRef.current = serialized;
        setTransferError("");
      }
    })();
    transferInFlightRef.current = work;
    try { await work; }
    finally {
      if (transferInFlightRef.current === work) transferInFlightRef.current = null;
    }
  }

  // Ao retomar, qualquer alteracao na mesa volta para o servidor.
  useEffect(() => {
    if (!matchStarted || !activeTransferRef.current || !players.length) return;
    const snapshot = currentTransferSnapshot();
    if (JSON.stringify(snapshot) === transferSavedRef.current) return;
    const timeout = window.setTimeout(() => {
      void persistActiveTransfer(snapshot).catch((error) => {
        setTransferError(error instanceof Error ? error.message : "Não foi possível sincronizar a partida.");
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [matchStarted, players, startingLife, playerCount]);

  // Tenta enviar a ultima mudanca tambem quando o navegador vai para segundo plano.
  useEffect(() => {
    if (!matchStarted || !activeTransferRef.current) return;
    const flushWhenHidden = () => {
      if (!document.hidden || !activeTransferRef.current) return;
      void persistActiveTransfer(currentTransferSnapshot(), true).catch((error) => {
        setTransferError(error instanceof Error ? error.message : "Falha ao salvar alterações.");
      });
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => document.removeEventListener("visibilitychange", flushWhenHidden);
  }, [matchStarted, players, startingLife, playerCount]);

  async function handoffMatch() {
    if (transferBusy) return;
    setTransferBusy(true);
    setTransferError("");
    try {
      const snapshot = currentTransferSnapshot();
      if (activeTransferRef.current) {
        await persistActiveTransfer(snapshot);
      } else {
        const result = await transferApi<{ ok: true; id: string; revision: number }>(
          LIFE_TRANSFER_API_URL,
          { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot }) }
        );
        activeTransferRef.current = { id: result.id, revision: result.revision };
        transferSavedRef.current = JSON.stringify(snapshot);
      }
      await resetMatch();
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Falha ao salvar a partida.");
    } finally { setTransferBusy(false); }
  }

  async function loadTransferList() {
    setTransferListOpen(true);
    setTransferListLoading(true);
    setTransferListError("");
    try {
      const result = await transferApi<{ ok: true; sessions: LifeTransferSummary[] }>(LIFE_TRANSFER_API_URL);
      setTransferSessions(result.sessions);
    } catch (error) {
      setTransferListError(error instanceof Error ? error.message : "Não foi possível consultar as partidas.");
    } finally { setTransferListLoading(false); }
  }

  async function continueTransfer(id: string) {
    if (transferBusy) return;
    setTransferBusy(true);
    setTransferListError("");
    void requestLandscapeMode();
    try {
      const result = await transferApi<{
        ok: true; id: string; revision: number; snapshot: LifeTransferSnapshot
      }>(`${LIFE_TRANSFER_API_URL}/${encodeURIComponent(id)}`);
      const snapshot = result.snapshot;
      if (!Array.isArray(snapshot.players) || snapshot.players.length !== snapshot.playerCount) {
        throw new Error("Os dados desta partida estão incompletos.");
      }
      matchRequestIdRef.current = snapshot.requestId;
      matchStartedAtRef.current = snapshot.startedAt;
      activeTransferRef.current = { id: result.id, revision: result.revision };
      transferSavedRef.current = JSON.stringify(snapshot);
      setStartingLife(snapshot.startingLife);
      setPlayerCount(snapshot.playerCount);
      setPlayers(snapshot.players);
      setTransferError("");
      setFinishConfirmOpen(false);
      setWinnerModalOpen(false);
      setTransferListOpen(false);
      setMatchStarted(true);
    } catch (error) {
      setTransferListError(error instanceof Error ? error.message : "Falha ao recuperar a partida.");
    } finally { setTransferBusy(false); }
  }

  async function removeTransfer(id: string) {
    if (!window.confirm("Excluir definitivamente este gancho de partida?")) return;
    setTransferListError("");
    try {
      await transferApi<{ ok: true }>(`${LIFE_TRANSFER_API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
      setTransferSessions(current => current.filter(session => session.id !== id));
    } catch (error) {
      setTransferListError(error instanceof Error ? error.message : "Erro ao excluir gancho.");
    }
  }


  // Recalcula a altura visível após rotação, mudanças nas barras do navegador
  // e retorno do app do segundo plano, sem reiniciar o estado da partida.
  useEffect(() => {
    const syncViewport = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--life-safe-height", `${height}px`);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelBoardGesture();
        clearHoldTimers();
      }
      else {
        syncViewport();
        window.requestAnimationFrame(syncViewport);
      }
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.documentElement.style.removeProperty("--life-safe-height");
    };
  }, []);

  useEffect(() => {
    async function loadLeagueData() {
      try {
        setLeagueDataLoading(true);
        setLeagueDataError("");

        const response = await fetch(
          `${DASHBOARD_API_URL}?t=${Date.now()}`
        );

        if (!response.ok) {
          throw new Error("Não foi possível carregar jogadores e decks.");
        }

        const data = (await response.json()) as DashboardApiResponse;

        const catalogPlayers = data.catalog?.players || [];
        const leaderboardPlayers = data.leaderboards?.geral?.players || [];

        const catalogDecks = data.catalog?.decks || [];
        const leaderboardDecks = data.leaderboards?.geral?.decks || [];

        const rawPlayers = mergeCatalogWithLeaderboardStats(
          catalogPlayers,
          leaderboardPlayers,
          (player) =>
            String(player.jogador || player.player || player.nome || "")
        );

        const rawDecks = mergeCatalogWithLeaderboardStats(
          catalogDecks,
          leaderboardDecks,
          (deck) => String(deck.deck || deck.nome || "")
        );

        const normalizedPlayers = rawPlayers
        .map((player) => ({
          name:
            player.nomeExibicao ||
            player.jogador ||
            player.player ||
            player.nome ||
            "Jogador sem nome",

          canonicalName:
            player.jogador ||
            player.player ||
            player.nome ||
            "Jogador sem nome",

          icon: normalizeKeyruneIcon(
            player.iconeKeyrune ||
              player.keyruneIcon ||
              player.icon ||
              player.icone ||
              ""
          ),

          matches: normalizeNumber(
            player.partidas ||
              player.jogos ||
              player.appearances ||
              player.totalPartidas
          ),

          favoriteDeckName: getApiMiniName(player.deckFavorito),
          bestDeckName: getApiMiniName(player.melhorDeck),
        }))
        .filter((player) => player.name.trim())
        .sort((a, b) => {
          if (b.matches !== a.matches) {
            return b.matches - a.matches;
          }

          return a.name.localeCompare(b.name);
        });

        const normalizedDecks = rawDecks
          .filter(isAvailableDeck)
          .map((deck) => ({
            categories: readDeckCategories(deck.categorias),
            inactive: deck.inativo === true,
            name: deck.deck || deck.nome || "Deck sem nome",
            displayName: deck.nome || deck.deck || "Deck sem nome",
            commander: deck.comandante || deck.commander || "",
            secondaryCommander:
              deck.comandanteSecundario ||
              deck.secondaryCommander ||
              "",

            secondaryCommanderImageUrl:
              deck.fotoComandanteSecundario ||
              deck.secondaryCommanderImageUrl ||
              "",

            secondaryCommanderType:
              deck.tipoComandanteSecundario ||
              deck.secondaryCommanderType ||
              "",
            imageUrl: getDeckBackgroundImage(deck),
            authorName:
              deck.owner ||
              getApiMiniName(deck.autor) ||
              getApiMiniName(deck.author) ||
              deck.autorNome ||
              deck.authorName ||
              "",
            authorDisplayName:
              getApiDisplayName(deck.autor) ||
              getApiDisplayName(deck.author) ||
              deck.autorNome ||
              deck.authorName ||
              "",
          }))
          .filter((deck) => deck.name.trim())
          .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));

        setLeaguePlayers(normalizedPlayers);
        setLeagueDecks(normalizedDecks);
      } catch (error) {
        if (error instanceof Error) {
          setLeagueDataError(error.message);
        } else {
          setLeagueDataError("Erro ao carregar jogadores e decks.");
        }
      } finally {
        setLeagueDataLoading(false);
      }
    }

    loadLeagueData();
  }, []);

  useEffect(() => {
    if (!matchStarted) {
      requestPortraitMode();
    }
  }, [matchStarted]);

  async function startMatch() {
    await requestLandscapeMode();
    const slots: LifePlayerSlot[] = Array.from(
      { length: playerCount },
      (_, index) => ({
        id: `player-${index + 1}`,
        label: `Jogador ${index + 1}`,
        life: startingLife,
        pendingDelta: 0,
        deltaVisible: false,
        playerName: "",
        playerCanonicalName: "",
        playerIcon: "",
        deckName: "",
        deckDisplayName: "",
        deckImageUrl: "",
        deckCommanderName: "",
        deckSecondaryCommanderName: "",
        deckSecondaryCommanderType: "",
        commanderDamage: {},
        selfCommanderDamage: {},
        markers: {
          poison: 0,
          experience: 0,
          radiation: 0,
        },
        isEliminated: false,
        eliminatedByPlayerId: "",
      })
    );

    activeTransferRef.current = null;
    transferSavedRef.current = "";
    matchRequestIdRef.current = createMatchRequestId();
    matchStartedAtRef.current = new Date().toISOString();

    setPlayers(slots);
    setMatchStarted(true);
  }

  async function resetMatch() {
    try {
      const orientationApi = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };

      if (orientationApi.unlock) {
        orientationApi.unlock();
      }

      await requestPortraitMode();

    } catch (error) {
      console.warn("Não foi possível sair do fullscreen/orientação:", error);
    }

    cancelBoardGesture();
    clearHoldTimers();

    setFinishConfirmOpen(false);

    setWinnerModalOpen(false);
    setSelectedWinnerId("");
    setMatchSubmitError("");
    setSelectionModal(null);
    setCommanderDamageModalPlayerId(null);
    setMarkerModalPlayerId(null);

    matchRequestIdRef.current = "";
    matchStartedAtRef.current = "";
    activeTransferRef.current = null;
    transferSavedRef.current = "";
    setTransferError("");

    setMatchStarted(false);
    setPlayers([]);
  }

  function adjustLife(playerId: string, amount: number) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              life: player.life + amount,
              pendingDelta: player.pendingDelta + amount,
              deltaVisible: true,
            }
          : player
      )
    );

    if (deltaTimeoutsRef.current[playerId]) {
      window.clearTimeout(deltaTimeoutsRef.current[playerId]);
    }

    deltaTimeoutsRef.current[playerId] = window.setTimeout(() => {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === playerId
            ? {
                ...player,
                pendingDelta: 0,
                deltaVisible: false,
              }
            : player
        )
      );
    }, 1800);
  }

  function adjustCommanderDamage(
  targetPlayerId: string,
  damageKey: string,
  amount: number
) {
  setPlayers((currentPlayers) =>
    currentPlayers.map((player) => {
      if (player.id !== targetPlayerId) {
        return player;
      }

      const currentDamage = player.commanderDamage[damageKey] || 0;
      const nextDamage = Math.max(0, currentDamage + amount);

      return {
        ...player,
        commanderDamage: {
          ...player.commanderDamage,
          [damageKey]: nextDamage,
        },
      };
    })
  );
}

  function openMarkerModal(playerId: string) {
  setMarkerModalPlayerId(playerId);
}

function closeMarkerModal() {
  setMarkerModalPlayerId(null);
}

function openFinishConfirm() {
  setMatchSubmitError("");
  setFullscreenError("");
  setFinishConfirmOpen(true);
}

// Um gesto direto no botao permite solicitar novamente fullscreen no celular.
// A orientacao e opcional: falhar o lock nao impede a tela cheia.
async function reopenGameFullscreen() {
  setFullscreenError("");
  try {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      if (!root.requestFullscreen) {
        setFullscreenError("Este navegador nao oferece tela cheia nesta pagina.");
        return;
      }
      await root.requestFullscreen();
    }
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (mode: string) => Promise<void>;
      };
      await orientation.lock?.("landscape");
    } catch {
      // Alguns browsers nao permitem travar orientacao; fullscreen permanece ativo.
    }
    setFinishConfirmOpen(false);
  } catch {
    setFullscreenError("Nao foi possivel entrar em tela cheia. Tente pelo navegador ou use o modo paisagem.");
  }
}

function closeFinishConfirm() {
  setFinishConfirmOpen(false);
}

function confirmMatchFinished() {
  setFinishConfirmOpen(false);
  setWinnerModalOpen(true);
  setSelectedWinnerId("");
}

function closeWinnerModal() {
  if (matchSubmitting) return;

  setWinnerModalOpen(false);
  setSelectedWinnerId("");
  setMatchSubmitError("");
}

async function submitMatchResult() {
  const winner = players.find(
    (player) => player.id === selectedWinnerId
  );

  if (!winner) {
    setMatchSubmitError("Selecione o jogador vencedor.");
    return;
  }

  if (!getPlayerCanonicalName(winner) || !winner.deckName) {
    setMatchSubmitError(
      "O vencedor precisa ter jogador e deck selecionados."
    );
    return;
  }

  const invalidPlayer = players.find(
    (player) =>
      !getPlayerCanonicalName(player) ||
      !player.deckName
  );

  if (invalidPlayer) {
    setMatchSubmitError(
      "Todos os jogadores precisam ter jogador e deck selecionados."
    );
    return;
  }

  try {
    setMatchSubmitting(true);
    setMatchSubmitError("");

    if (!matchRequestIdRef.current) {
      matchRequestIdRef.current = createMatchRequestId();
    }

    if (!matchStartedAtRef.current) {
      matchStartedAtRef.current = new Date().toISOString();
    }

    const manuallyMarkedKillEvents = players
    .filter(
      (player) =>
        player.isEliminated &&
        player.eliminatedByPlayerId
    )
    .map((player) => {
      const killer = players.find(
        (possibleKiller) =>
          possibleKiller.id ===
          player.eliminatedByPlayerId
      );

      return {
        killerPlayerName: killer
          ? getPlayerCanonicalName(killer)
          : "",
        killerDeckName: killer?.deckName || "",
        eliminatedPlayerName:
          getPlayerCanonicalName(player),
        eliminatedDeckName: player.deckName || "",
      };
    })
    .filter(
      (event) =>
        event.killerPlayerName &&
        event.eliminatedPlayerName
    );

  const winnerFinishingKillEvents = players
    .filter((player) => player.id !== winner.id)
    .filter((player) => !player.isEliminated)
    .map((player) => ({
      killerPlayerName:
        getPlayerCanonicalName(winner),
      killerDeckName: winner.deckName || "",
      eliminatedPlayerName:
        getPlayerCanonicalName(player),
      eliminatedDeckName: player.deckName || "",
    }));

  const killEvents = [
    ...manuallyMarkedKillEvents,
    ...winnerFinishingKillEvents,
  ];

    const payload = {
      requestId: matchRequestIdRef.current,
      startedAt: matchStartedAtRef.current,
      winnerPlayerName:
        getPlayerCanonicalName(winner),
      winnerDeckName: winner.deckName,
      killEvents,
      players: players.map((player) => ({
        id: player.id,
        label: player.label,
        playerName:
          getPlayerCanonicalName(player),
        deckName: player.deckName || "",
        life: player.life,
        commanderDamage: player.commanderDamage,
        markers: player.markers,
        isEliminated: player.isEliminated,
        eliminatedByPlayerId:
          player.eliminatedByPlayerId,
        isWinner: player.id === winner.id,
      })),
    };

    const response = await fetch(MATCH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response
      .json()
      .catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.error ||
          "Não foi possível registrar a partida."
      );
    }

    console.log(
      `Partida ${result.matchId} registrada com sucesso.`
    );

    // O resultado foi registrado: remover o gancho so depois do sucesso.
    // A API tambem limpa por requestId, para tolerar perda de conexao neste DELETE.
    const completedTransfer = activeTransferRef.current;
    if (completedTransfer) {
      try {
        await transferApi(`${LIFE_TRANSFER_API_URL}/${encodeURIComponent(completedTransfer.id)}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.warn("O resultado foi enviado, mas a limpeza do gancho nao confirmou:", error);
      }
    }
    activeTransferRef.current = null;
    transferSavedRef.current = "";
    await requestPortraitMode();

    matchRequestIdRef.current = "";
    matchStartedAtRef.current = "";

    setWinnerModalOpen(false);
    setSelectedWinnerId("");
    setMatchStarted(false);
    setPlayers([]);
  } catch (error) {
    console.error(
      "Erro ao registrar partida:",
      error
    );

    setMatchSubmitError(
      error instanceof Error
        ? error.message
        : "Não foi possível enviar a partida."
    );
  } finally {
    setMatchSubmitting(false);
  }
}

function adjustSelfCommanderDamage(
  playerId: string,
  damageKey: string,
  amount: number
) {
  setPlayers((currentPlayers) =>
    currentPlayers.map((player) => {
      if (player.id !== playerId) {
        return player;
      }

      const currentDamage = player.selfCommanderDamage[damageKey] || 0;
      const nextDamage = Math.max(0, currentDamage + amount);

      return {
        ...player,
        selfCommanderDamage: {
          ...player.selfCommanderDamage,
          [damageKey]: nextDamage,
        },
      };
    })
  );
}

function adjustPlayerMarker(
  playerId: string,
  markerType: PlayerMarkerType,
  amount: number
) {
  setPlayers((currentPlayers) =>
    currentPlayers.map((player) => {
      if (player.id !== playerId) {
        return player;
      }

      const currentValue = player.markers[markerType] || 0;
      const nextValue = Math.max(0, currentValue + amount);

      return {
        ...player,
        markers: {
          ...player.markers,
          [markerType]: nextValue,
        },
      };
    })
  );
}

function getVisibleMarkers(player: LifePlayerSlot) {
  return (Object.keys(player.markers) as PlayerMarkerType[])
    .map((markerType) => ({
      type: markerType,
      value: player.markers[markerType],
    }))
    .filter((marker) => marker.value > 0);
}

  function getHoldDelay() {
    const elapsed = Date.now() - holdStartTimeRef.current;

    if (elapsed > 2500) return 45;
    if (elapsed > 1600) return 70;
    if (elapsed > 900) return 105;
    if (elapsed > 400) return 145;

    return 210;
  }

  function clearHoldTimers() {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function startHoldingLife(playerId: string, direction: 1 | -1) {
    clearHoldTimers();

    holdStartTimeRef.current = Date.now();
    adjustLife(playerId, direction);

    function tick() {
      adjustLife(playerId, direction);

      if (holdIntervalRef.current) {
        window.clearInterval(holdIntervalRef.current);
      }

      holdIntervalRef.current = window.setInterval(tick, getHoldDelay());
    }

    holdTimeoutRef.current = window.setTimeout(() => {
      tick();
    }, 260);
  }

  function stopHoldingLife() {
    clearHoldTimers();
  }

  function cancelBoardGesture() {
    if (boardHoldTimeoutRef.current !== null) {
      window.clearTimeout(boardHoldTimeoutRef.current);
      boardHoldTimeoutRef.current = null;
    }
    if (boardGestureRef.current?.holding) {
      stopHoldingLife();
    }
    boardGestureRef.current = null;
  }

  // Segurar uma metade livre repete +/-; arrastar a tela cancela o gesto.
  // O lado e determinado pela posicao REAL dos botoes, mesmo nos cards girados.
  function handleBoardPointerDown(event: PointerEvent<HTMLDivElement>, playerId: string) {
    if (!event.isPrimary || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, input, select, textarea, [role="button"], [role="link"]')) {
      return;
    }

    const minus = event.currentTarget.querySelector<HTMLButtonElement>(".life-minus-button");
    const plus = event.currentTarget.querySelector<HTMLButtonElement>(".life-plus-button");
    if (!minus || !plus) return;

    const minusRect = minus.getBoundingClientRect();
    const plusRect = plus.getBoundingClientRect();
    const minusX = minusRect.left + minusRect.width / 2;
    const plusX = plusRect.left + plusRect.width / 2;
    const midpoint = (minusX + plusX) / 2;
    const clickedPlus = plusX >= minusX
      ? event.clientX >= midpoint
      : event.clientX <= midpoint;

    cancelBoardGesture();
    const gesture = {
      pointerId: event.pointerId,
      playerId,
      direction: (clickedPlus ? 1 : -1) as 1 | -1,
      startX: event.clientX,
      startY: event.clientY,
      holding: false,
    };
    boardGestureRef.current = gesture;

    // Um toque curto aplica uma vez na soltura. Assim, scroll nao muda a vida.
    // Pressionar por mais tempo aciona a mesma repeticao rapida dos botoes.
    boardHoldTimeoutRef.current = window.setTimeout(() => {
      if (boardGestureRef.current !== gesture) return;
      boardHoldTimeoutRef.current = null;
      gesture.holding = true;
      startHoldingLife(playerId, gesture.direction);
    }, 330);
  }

  function handleBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = boardGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 12) {
      cancelBoardGesture();
    }
  }

  function handleBoardPointerUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = boardGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!gesture.holding) {
      adjustLife(gesture.playerId, gesture.direction);
    }
    cancelBoardGesture();
  }

  function handleBoardPointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (boardGestureRef.current?.pointerId === event.pointerId) {
      cancelBoardGesture();
    }
  }

  function openSelectionModal(playerSlotId: string, type: "player" | "deck") {
    setSelectionModal({ playerSlotId, type });
    setSearchTerm("");
  }

  function closeSelectionModal() {
    setSelectionModal(null);
    setSearchTerm("");
  }

  function selectPlayer(playerSlotId: string, selectedPlayer: LeaguePlayerOption) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerSlotId
          ? {
              ...player,
              playerName: selectedPlayer.name,
              playerCanonicalName: selectedPlayer.canonicalName,
              playerIcon: selectedPlayer.icon,
            }
          : player
      )
    );

    closeSelectionModal();
  }

  function selectDeck(playerSlotId: string, selectedDeck: LeagueDeckOption) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerSlotId
          ? {
              ...player,
              deckName: selectedDeck.name,
              deckDisplayName: selectedDeck.displayName,
              deckImageUrl: selectedDeck.imageUrl,
              deckCommanderName: selectedDeck.commander,
              deckSecondaryCommanderName: selectedDeck.secondaryCommander,
              deckSecondaryCommanderType: selectedDeck.secondaryCommanderType,
            }
          : player
      )
    );

    closeSelectionModal();
  }

  function openCommanderDamageModal(playerId: string) {
    setCommanderDamageModalPlayerId(playerId);
  }

  function closeCommanderDamageModal() {
    setCommanderDamageModalPlayerId(null);
  }

  function openKillModal(playerId: string) {
    setKillModalTargetPlayerId(playerId);
  }

  function closeKillModal() {
    setKillModalTargetPlayerId(null);
  }

  function eliminatePlayer(targetPlayerId: string, killerPlayerId: string) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === targetPlayerId
          ? {
              ...player,
              isEliminated: true,
              eliminatedByPlayerId: killerPlayerId,
            }
          : player
      )
    );

    closeKillModal();
  }

  function undoElimination(playerId: string) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              isEliminated: false,
              eliminatedByPlayerId: "",
            }
          : player
      )
    );
  }

  function getPlayerDisplayName(player: LifePlayerSlot) {
    return player.playerName || player.label;
  }

  function getPlayerCanonicalName(player: LifePlayerSlot) {
    return player.playerCanonicalName || player.playerName || player.label;
  }

  function getPlayerKiller(player: LifePlayerSlot) {
    if (!player.eliminatedByPlayerId) {
      return null;
    }

    return (
      players.find(
        (possibleKiller) => possibleKiller.id === player.eliminatedByPlayerId
      ) || null
    );
  }

  function getPlayerDisplayIcon(player: LifePlayerSlot) {
    return player.playerIcon || "ss-cmd";
  }

  function getCommanderDamageKey(
    sourcePlayerId: string,
    commanderSlot: "primary" | "secondary"
  ) {
    return `${sourcePlayerId}:${commanderSlot}`;
  }

  function hasSecondaryCommanderDamageSource(player: LifePlayerSlot) {
    return Boolean(
      player.deckSecondaryCommanderType.trim() &&
        player.deckSecondaryCommanderName.trim()
    );
  }

  function getPrimaryCommanderName(player: LifePlayerSlot) {
    return (
      player.deckCommanderName ||
      player.deckDisplayName ||
      player.deckName ||
      player.playerName ||
      player.label
    );
  }

  function getSecondaryCommanderIcon(player: LifePlayerSlot) {
    const baseIcon = getPlayerDisplayIcon(player) || "ss-cmd";

    if (baseIcon.includes("ss-mythic")) {
      return baseIcon.replace("ss-mythic", "ss-uncommon");
    }

    if (/\bss-(common|uncommon|rare|mythic|special|bonus)\b/.test(baseIcon)) {
      return baseIcon.replace(
        /\bss-(common|uncommon|rare|mythic|special|bonus)\b/g,
        "ss-uncommon"
      );
    }

    return `${baseIcon} ss-uncommon`;
  }

  function getCommanderDamageEntries(player: LifePlayerSlot) {
  const entries: CommanderDamageSource[] = [];

  players
    .filter((sourcePlayer) => sourcePlayer.id !== player.id)
    .forEach((sourcePlayer) => {
      const primaryKey = getCommanderDamageKey(sourcePlayer.id, "primary");

      entries.push({
        damageKey: primaryKey,
        sourcePlayer,
        commanderName: getPrimaryCommanderName(sourcePlayer),
        commanderSlot: "primary",
        iconClass: getPlayerDisplayIcon(sourcePlayer),
        damage: player.commanderDamage[primaryKey] || 0,
      });

      if (hasSecondaryCommanderDamageSource(sourcePlayer)) {
        const secondaryKey = getCommanderDamageKey(
          sourcePlayer.id,
          "secondary"
        );

        entries.push({
          damageKey: secondaryKey,
          sourcePlayer,
          commanderName: sourcePlayer.deckSecondaryCommanderName,
          commanderSlot: "secondary",
          iconClass: getSecondaryCommanderIcon(sourcePlayer),
          damage: player.commanderDamage[secondaryKey] || 0,
        });
      }
    });

  return entries;
}

function getSelfCommanderDamageEntries(player: LifePlayerSlot) {
  const entries: CommanderDamageSource[] = [];

  const primaryKey = getCommanderDamageKey(player.id, "primary");

  entries.push({
    damageKey: primaryKey,
    sourcePlayer: player,
    commanderName: getPrimaryCommanderName(player),
    commanderSlot: "primary",
    iconClass: getPlayerDisplayIcon(player),
    damage: player.selfCommanderDamage[primaryKey] || 0,
  });

  if (hasSecondaryCommanderDamageSource(player)) {
    const secondaryKey = getCommanderDamageKey(player.id, "secondary");

    entries.push({
      damageKey: secondaryKey,
      sourcePlayer: player,
      commanderName: player.deckSecondaryCommanderName,
      commanderSlot: "secondary",
      iconClass: getSecondaryCommanderIcon(player),
      damage: player.selfCommanderDamage[secondaryKey] || 0,
    });
  }

  return entries;
}

function hasVisibleMarkerInfo(player: LifePlayerSlot) {
  const hasMarkers = getVisibleMarkers(player).length > 0;

  const hasSelfCommanderDamage = getSelfCommanderDamageEntries(player).some(
    (entry) => entry.damage > 0
  );

  return hasMarkers || hasSelfCommanderDamage;
}

  function getDeckSelectionPriority(
    deck: LeagueDeckOption,
    selectedPlayer: LeaguePlayerOption | null
  ) {
    if (!selectedPlayer) {
      return 4;
    }

    const deckName = normalizeComparableText(deck.name);
    const playerName = normalizeComparableText(selectedPlayer.canonicalName);
    const favoriteDeckName = normalizeComparableText(
      selectedPlayer.favoriteDeckName
    );
    const bestDeckName = normalizeComparableText(selectedPlayer.bestDeckName);
    const authorName = normalizeComparableText(deck.authorName);

    const deckDisplayName = normalizeComparableText(deck.displayName);

    // Favoritos e melhores decks usam a chave canônica; reconhece também
    // referências legadas que guardaram somente o nome de exibição.
    if (
      favoriteDeckName &&
      (deckName === favoriteDeckName || deckDisplayName === favoriteDeckName)
    ) {
      return 0;
    }

    if (
      bestDeckName &&
      (deckName === bestDeckName || deckDisplayName === bestDeckName)
    ) {
      return 1;
    }

    if (authorName && authorName === playerName) {
      return 2;
    }

    return 3;
  }

  const filteredLeaguePlayers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const currentSlotId =
      selectionModal?.type === "player" ? selectionModal.playerSlotId : undefined;

    const alreadySelectedPlayers = getSelectedPlayerNamesExcludingSlot(
      players,
      currentSlotId
    );

    return leaguePlayers.filter((player) => {
      const isAlreadySelected = alreadySelectedPlayers.some((selectedName) =>
        isSameText(selectedName, player.canonicalName)
      );

      if (isAlreadySelected) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        player.name.toLowerCase().includes(search) ||
        player.canonicalName.toLowerCase().includes(search)
      );
    });
  }, [leaguePlayers, searchTerm, players, selectionModal]);

  const selectedDeckSlotPlayer =
    selectionModal?.type === "deck"
      ? players.find((player) => player.id === selectionModal.playerSlotId)
      : null;

  const selectedLeaguePlayerForDeckModal =
    selectedDeckSlotPlayer?.playerCanonicalName
      ? leaguePlayers.find(
          (player) =>
            normalizeComparableText(player.canonicalName) ===
            normalizeComparableText(selectedDeckSlotPlayer.playerCanonicalName)
        ) || null
      : null;

  const filteredLeagueDecks = useMemo(() => {
    const search = normalizeComparableText(searchTerm);
    const currentSlotId =
      selectionModal?.type === "deck" ? selectionModal.playerSlotId : undefined;

    const alreadySelectedDecks = getSelectedDeckNamesExcludingSlot(
      players,
      currentSlotId
    );

    const filteredDecks = leagueDecks.filter((deck) => {
      const isAlreadySelected = alreadySelectedDecks.some((selectedDeckName) =>
        isSameText(selectedDeckName, deck.name)
      );

      if (isAlreadySelected) return false;

      // Decks inativos não aparecem na lista geral: só podem ser encontrados
      // se o usuário pesquisar pelo nome (interno ou de exibição).
      if (!search) return !deck.inactive;

      const matchesName =
        normalizeComparableText(deck.displayName).includes(search) ||
        normalizeComparableText(deck.name).includes(search);

      if (deck.inactive) return matchesName;

      return (
        matchesName ||
        normalizeComparableText(deck.commander).includes(search) ||
        normalizeComparableText(deck.authorDisplayName).includes(search) ||
        normalizeComparableText(deck.authorName).includes(search)
      );
    });

    return filteredDecks.slice().sort((a, b) => {
      // Mesmo se um deck inativo for favorito, ele aparece após os ativos.
      if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;

      const priorityA = getDeckSelectionPriority(
        a,
        selectedLeaguePlayerForDeckModal
      );
      const priorityB = getDeckSelectionPriority(
        b,
        selectedLeaguePlayerForDeckModal
      );

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.displayName.localeCompare(b.displayName, "pt-BR");
    });
  }, [
    leagueDecks,
    searchTerm,
    selectedLeaguePlayerForDeckModal,
    players,
    selectionModal,
  ]);

  const commanderDamageModalPlayer = players.find(
    (player) => player.id === commanderDamageModalPlayerId
  );

  const markerModalPlayer = players.find(
    (player) => player.id === markerModalPlayerId
  );

  const killModalTargetPlayer = players.find(
    (player) => player.id === killModalTargetPlayerId
  );

  const killModalKillerOptions = killModalTargetPlayer
    ? players.filter((player) => player.id !== killModalTargetPlayer.id)
    : [];

  if (matchStarted) {
    return (
      <main className="life-page">
        <section
          className={[
            "life-board",
            "life-board-table",
            `life-board-${players.length}`,
          ].join(" ")}
        >
          {players.map((player, index) => (
            <div
              className={`life-player-card life-player-card-companion life-player-position-${
                index + 1
              } ${player.deckImageUrl ? "life-player-card-has-deck-bg" : ""} ${
                player.isEliminated
                  ? `life-player-eliminated life-eliminated-${getLifeEliminationCause(player)}`
                  : ""
              }`}
              key={player.id}
              style={
                player.deckImageUrl
                  ? ({
                      "--life-deck-bg": `url("${player.deckImageUrl}")`,
                    } as CSSProperties)
                  : undefined
              }
            >

              <div
                className="life-player-rotator"
                onPointerDown={(event) => handleBoardPointerDown(event, player.id)}
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                onPointerCancel={handleBoardPointerCancel}
                onPointerLeave={handleBoardPointerCancel}
                onContextMenu={(event) => {
                  const target = event.target;
                  if (target instanceof Element && !target.closest('button, a, input, select, textarea')) {
                    event.preventDefault();
                  }
                }}
              >
                <div className="life-player-card-bg" />
                {player.isEliminated ? (
                  <span className="life-elimination-watermark" aria-hidden="true">
                    <i
                      className={`ss ${LIFE_ELIMINATION_ICONS[getLifeEliminationCause(player)]} ss-common`}
                    />
                  </span>
                ) : null}
                <div className="life-player-header">
                  <button
                    className="life-slot-button life-player-slot"
                    type="button"
                    onClick={() => openSelectionModal(player.id, "player")}
                    title="Selecionar jogador"
                  >
                    <i
                      className={`ss ${
                        player.playerIcon || "ss-cmd"
                      } life-slot-icon life-slot-icon-player`}
                      aria-hidden="true"
                    />
                    <span>Jogador</span>
                    <strong>{player.playerName || player.label}</strong>
                  </button>

                  <button
                    className="life-slot-button life-deck-slot"
                    type="button"
                    onClick={() => openSelectionModal(player.id, "deck")}
                    title="Selecionar deck"
                  >
                    <i
                      className="ss ss-c17 life-slot-icon life-slot-icon-deck"
                      aria-hidden="true"
                    />
                    <span>Deck</span>
                    <strong>{player.deckDisplayName || player.deckName || "Selecionar deck"}</strong>
                  </button>
                </div>

                <div className="life-companion-grid">
                  <div className="life-utility-column life-utility-column-left">
                    <button
                      className={
                        player.isEliminated
                          ? "life-small-action life-kill-action life-kill-action-undo"
                          : "life-small-action life-kill-action"
                      }
                      type="button"
                      onClick={() =>
                        player.isEliminated
                          ? undoElimination(player.id)
                          : openKillModal(player.id)
                      }
                      title={player.isEliminated ? "Desfazer eliminação" : "Eliminar jogador"}
                    >
                      <span>{player.isEliminated ? "Desfazer" : "Matar"}</span>
                    </button>
                  </div>

                  <button
                    className="life-hold-button life-minus-button"
                    type="button"
                    onPointerDown={() => startHoldingLife(player.id, -1)}
                    onPointerUp={stopHoldingLife}
                    onPointerCancel={stopHoldingLife}
                    onPointerLeave={stopHoldingLife}
                  >
                    −
                  </button>

                  <div className="life-center-zone">
                    <div className="life-total-zone">
                      <strong>{player.life}</strong>
                        {player.isEliminated ? (() => {
                          const killer = getPlayerKiller(player);

                          return (
                            <div className="life-eliminated-badge">
                              <span className="life-eliminated-killer-icon">
                                <i
                                  className={`ss ${killer?.playerIcon || "ss-cmd"}`}
                                  aria-hidden="true"
                                />
                              </span>

                              <span className="life-eliminated-text">
                                <strong>Eliminado</strong>
                                <span>
                                  por {killer ? getPlayerDisplayName(killer) : "jogador desconhecido"}
                                </span>
                              </span>
                            </div>
                          );
                        })() : null}

                        {player.deltaVisible && player.pendingDelta !== 0 ? (
                        <span
                          className={
                            player.pendingDelta > 0
                              ? "life-delta life-delta-positive"
                              : "life-delta life-delta-negative"
                          }
                        >
                          {player.pendingDelta > 0 ? "+" : ""}
                          {player.pendingDelta}
                        </span>
                      ) : null}
                    </div>

                  </div>

                  <button
                    className="life-hold-button life-plus-button"
                    type="button"
                    onPointerDown={() => startHoldingLife(player.id, 1)}
                    onPointerUp={stopHoldingLife}
                    onPointerCancel={stopHoldingLife}
                    onPointerLeave={stopHoldingLife}
                  >
                    +
                  </button>

                  <div className="life-utility-column life-utility-column-right">
                    <button
                      className={
                        getVisibleMarkers(player).length > 0
                          ? "life-small-action life-small-action-marker-active"
                          : "life-small-action"
                      }
                      type="button"
                      onClick={() => openMarkerModal(player.id)}
                      title="Marcadores"
                    >
                      <span>Marc.</span>
                    </button>
                  </div>
                </div>
                <div className="life-status-strip" role="group" aria-label={`Danos e marcadores de ${player.playerName || player.label}`}>
                    <button
                      className="commander-summary"
                      type="button"
                      onClick={() => openCommanderDamageModal(player.id)}
                      title="Ver dano de comandante"
                      aria-label={`Dano de comandante de ${player.playerName || player.label}`}
                    >
                      {!getCommanderDamageEntries(player).some((entry) => entry.damage > 0) ? (
                        <span className="life-status-empty-icon" title="Sem dano de comandante">
                          <i className="ss ss-cmd ss-common" aria-hidden="true" />
                        </span>
                      ) : null}
                      {getCommanderDamageEntries(player).filter((entry) => entry.damage > 0).map((entry) => (
                        <span
                          className={
                            entry.damage > 0
                              ? "commander-summary-item commander-summary-item-active"
                              : "commander-summary-item"
                          }
                          key={entry.damageKey}
                          title={entry.commanderName}
                        >
                          <i
                            className={`ss ${entry.iconClass} commander-summary-icon`}
                            aria-hidden="true"
                          />

                          <strong>{entry.damage}</strong>
                        </span>
                      ))}
                    </button>

                    <button
                        className="marker-summary"
                        type="button"
                        onClick={() => openMarkerModal(player.id)}
                        title="Ver marcadores"
                        aria-label={`Marcadores de ${player.playerName || player.label}`}
                      >
                        {!hasVisibleMarkerInfo(player) ? (
                          <span className="life-status-empty-icon" title="Sem marcadores">
                            <i className="ss ss-nph ss-common" aria-hidden="true" />
                          </span>
                        ) : null}
                        {getVisibleMarkers(player).map((marker) => (
                          <span
                            className={`marker-summary-item marker-summary-${marker.type}`}
                            key={marker.type}
                          >
                            <span className="marker-summary-icon">
                              {PLAYER_MARKER_ICONS[marker.type]}
                            </span>

                            <strong>{marker.value}</strong>
                          </span>
                        ))}

                        {getSelfCommanderDamageEntries(player)
                        .filter((entry) => entry.damage > 0)
                        .map((entry) => (
                          <span
                            className="marker-summary-item marker-summary-self-commander"
                            key={`self-${entry.damageKey}`}
                            title={`Dano do próprio comandante: ${entry.commanderName}`}
                          >
                            <i
                              className={`ss ${entry.iconClass} marker-summary-icon`}
                              aria-hidden="true"
                            />

                            <strong>{entry.damage}</strong>
                          </span>
                        ))}
                      </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        {transferError && activeTransferRef.current ? (
          <div className="life-transfer-sync-warning" role="alert">
            <span>{transferError}</span>
            <button type="button" onClick={() => { void persistActiveTransfer(currentTransferSnapshot()).catch(
              error => setTransferError(error instanceof Error ? error.message : "Erro ao sincronizar.")
            ); }}>Tentar novamente</button>
          </div>
        ) : null}
        <button
          className="finish-match-button"
          type="button"
          onClick={openFinishConfirm}
          title="Finalizar partida"
        >
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            aria-hidden="true"
          />
        </button>

        {finishConfirmOpen ? (
          <div className="match-result-backdrop" onClick={closeFinishConfirm}>
            <div
              className="match-result-modal match-result-confirm"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="match-result-header">
                <span>Finalizar partida</span>
                <strong>A partida acabou?</strong>
                <p>Confirme para selecionar o vencedor e enviar o resultado.</p>
              </div>

              {transferError ? (
                <p className="match-result-fullscreen-error" role="alert">{transferError}</p>
              ) : null}
              {fullscreenError ? (
                <p className="match-result-fullscreen-error" role="alert">{fullscreenError}</p>
              ) : null}

              <div className="match-result-actions">
                <button
                  className="match-result-secondary"
                  type="button"
                  onClick={closeFinishConfirm}
                >
                  Ainda não
                </button>

                <button
                  className="match-result-fullscreen"
                  type="button"
                  onClick={() => { void reopenGameFullscreen(); }}
                >
                  Tela Cheia
                </button>

                <button
                  className="match-result-transfer"
                  type="button"
                  disabled={transferBusy}
                  onClick={() => { void handoffMatch(); }}
                >
                  <i className="ss ss-mb1 ss-mythic" aria-hidden="true" />
                  <span>{transferBusy ? "Salvando partida..." : "Trocar de Celular"}</span>
                </button>

                <button
                  className="match-result-danger"
                  type="button"
                  onClick={resetMatch}
                >
                  Nova Partida
                </button>

                <button
                  className="match-result-primary"
                  type="button"
                  onClick={confirmMatchFinished}
                >
                  Sim, acabou
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {winnerModalOpen ? (
          <div className="match-result-backdrop" onClick={closeWinnerModal}>
            <div
              className="match-result-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="match-result-header">
                <span>Resultado</span>
                <strong>Quem venceu?</strong>
                <p>Selecione o jogador vencedor para registrar a partida.</p>
              </div>

              <div className="winner-list">
                {players.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className={
                      selectedWinnerId === player.id
                        ? "winner-option winner-option-active"
                        : "winner-option"
                    }
                    onClick={() => setSelectedWinnerId(player.id)}
                  >
                    <i
                      className={`ss ${
                        player.playerIcon || "ss-cmd"
                      } winner-option-icon`}
                      aria-hidden="true"
                    />

                    <div>
                      <strong>{player.playerName || player.label}</strong>

                      {player.deckName ? <span>{player.deckDisplayName || player.deckName}</span> : null}
                    </div>
                  </button>
                ))}
              </div>

              {matchSubmitError ? (
                <p className="match-result-error">{matchSubmitError}</p>
              ) : null}

              <div className="match-result-actions">
                <button
                  className="match-result-secondary"
                  type="button"
                  onClick={closeWinnerModal}
                  disabled={matchSubmitting}
                >
                  Cancelar
                </button>

                <button
                  className="match-result-primary"
                  type="button"
                  onClick={submitMatchResult}
                  disabled={matchSubmitting}
                >
                  {matchSubmitting ? "Enviando..." : "Enviar resultado"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectionModal ? (
          <div className="life-selection-backdrop" onClick={closeSelectionModal}>
            <div
              className="life-selection-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="life-selection-header">
                <div>
                  <span>
                    {selectionModal.type === "player"
                      ? "Selecionar jogador"
                      : "Selecionar deck"}
                  </span>
                  <strong>
                    {selectionModal.type === "player"
                      ? "Quem está neste slot?"
                      : "Qual deck está sendo usado?"}
                  </strong>
                </div>

                <button type="button" onClick={closeSelectionModal}>
                  ×
                </button>
              </div>

              <input
                className="life-selection-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  selectionModal.type === "player"
                    ? "Buscar jogador..."
                    : "Buscar deck ou comandante..."
                }
              />

              {leagueDataLoading ? (
                <p className="life-selection-empty">
                  Carregando dados da liga...
                </p>
              ) : null}

              {leagueDataError ? (
                <p className="life-selection-empty">{leagueDataError}</p>
              ) : null}

              <div className="life-selection-list">
                {selectionModal.type === "player"
                  ? filteredLeaguePlayers.map((playerOption) => (
                      <button
                        key={playerOption.name}
                        type="button"
                        className="life-selection-item"
                        onClick={() =>
                          selectPlayer(
                            selectionModal.playerSlotId,
                            playerOption
                          )
                        }
                      >
                        <div className="life-selection-player-row">
                          <i
                            className={`ss ${
                              playerOption.icon || "ss-cmd"
                            } life-selection-player-icon`}
                            aria-hidden="true"
                          />
                          <strong>{playerOption.name}</strong>
                        </div>
                      </button>
                    ))
                  : filteredLeagueDecks.map((deck) => (
                      <button
                        key={deck.name}
                        type="button"
                        className="life-selection-item"
                        onClick={() =>
                          selectDeck(selectionModal.playerSlotId, deck)
                        }
                      >
                        <strong>{deck.displayName}</strong>
                        <DeckLabels inactive={deck.inactive} compact />
                        {deck.commander ? <span>{deck.commander}</span> : null}
                      </button>
                    ))}

                {selectionModal.type === "player" &&
                !filteredLeaguePlayers.length &&
                !leagueDataLoading ? (
                  <p className="life-selection-empty">
                    Nenhum jogador encontrado.
                  </p>
                ) : null}

                {selectionModal.type === "deck" &&
                !filteredLeagueDecks.length &&
                !leagueDataLoading ? (
                  <p className="life-selection-empty">Nenhum deck encontrado.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {commanderDamageModalPlayer ? (
          <div
            className="commander-modal-backdrop"
            onClick={closeCommanderDamageModal}
          >
            <div
              className="commander-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="commander-modal-header">
                <div>
                  <span>Dano de comandante</span>
                  <strong>
                    {commanderDamageModalPlayer.playerName ||
                      commanderDamageModalPlayer.label}
                  </strong>

                  {commanderDamageModalPlayer.deckName ? (
                    <small>{commanderDamageModalPlayer.deckDisplayName || commanderDamageModalPlayer.deckName}</small>
                  ) : null}
                </div>

                <button type="button" onClick={closeCommanderDamageModal}>
                  ×
                </button>
              </div>

              <div className="commander-modal-list">
                {getCommanderDamageEntries(commanderDamageModalPlayer).map((entry) => (
                  <div className="commander-modal-row" key={entry.damageKey}>
                    <div className="commander-modal-player">
                      <i
                        className={`ss ${entry.iconClass} commander-modal-icon`}
                        aria-hidden="true"
                      />

                      <div>
                        <strong>{entry.commanderName}</strong>

                        <span>
                          {entry.sourcePlayer.playerName || entry.sourcePlayer.label}
                        </span>
                      </div>
                    </div>

                    <div className="commander-modal-controls">
                      <button
                        type="button"
                        onClick={() =>
                          adjustCommanderDamage(
                            commanderDamageModalPlayer.id,
                            entry.damageKey,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <strong
                        className={
                          entry.damage >= 21
                            ? "commander-modal-damage commander-modal-damage-lethal"
                            : "commander-modal-damage"
                        }
                      >
                        {entry.damage}
                      </strong>

                      <button
                        type="button"
                        onClick={() =>
                          adjustCommanderDamage(
                            commanderDamageModalPlayer.id,
                            entry.damageKey,
                            1
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {markerModalPlayer ? (
          <div className="marker-modal-backdrop" onClick={closeMarkerModal}>
            <div
              className="marker-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="marker-modal-header">
                <div>
                  <span>Marcadores</span>

                  <strong>{markerModalPlayer.playerName || markerModalPlayer.label}</strong>

                  {markerModalPlayer.deckName ? (
                    <small>{markerModalPlayer.deckDisplayName || markerModalPlayer.deckName}</small>
                  ) : null}
                </div>

                <button type="button" onClick={closeMarkerModal}>
                  ×
                </button>
              </div>

              <div className="marker-modal-list">
                {(Object.keys(markerModalPlayer.markers) as PlayerMarkerType[]).map(
                  (markerType) => {
                    const value = markerModalPlayer.markers[markerType];

                    return (
                      <div className="marker-modal-row" key={markerType}>
                        <div className={`marker-modal-info marker-modal-${markerType}`}>
                          <span className="marker-modal-symbol">
                            {PLAYER_MARKER_ICONS[markerType]}
                          </span>

                          <div>
                            <strong>{PLAYER_MARKER_LABELS[markerType]}</strong>
                            <span>{PLAYER_MARKER_SHORT_LABELS[markerType]}</span>
                          </div>
                        </div>

                        <div className="marker-modal-controls">
                          <button
                            type="button"
                            onClick={() =>
                              adjustPlayerMarker(markerModalPlayer.id, markerType, -1)
                            }
                          >
                            −
                          </button>

                          <strong>{value}</strong>

                          <button
                            type="button"
                            onClick={() =>
                              adjustPlayerMarker(markerModalPlayer.id, markerType, 1)
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}

                {getSelfCommanderDamageEntries(markerModalPlayer).length > 0 ? (
                  <div className="marker-modal-section-title">
                    Dano do próprio comandante
                  </div>
                ) : null}

                {getSelfCommanderDamageEntries(markerModalPlayer).map((entry) => (
                  <div
                    className="marker-modal-row marker-modal-self-commander-row"
                    key={`self-modal-${entry.damageKey}`}
                  >
                    <div className="marker-modal-info marker-modal-self-commander">
                      <i
                        className={`ss ${entry.iconClass} marker-modal-symbol marker-modal-symbol-icon`}
                        aria-hidden="true"
                      />

                      <div>
                        <strong>{entry.commanderName}</strong>
                        <span>
                          {entry.commanderSlot === "secondary"
                            ? "Comandante secundário"
                            : "Comandante principal"}
                        </span>
                      </div>
                    </div>

                    <div className="marker-modal-controls">
                      <button
                        type="button"
                        onClick={() =>
                          adjustSelfCommanderDamage(
                            markerModalPlayer.id,
                            entry.damageKey,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <strong>{entry.damage}</strong>

                      <button
                        type="button"
                        onClick={() =>
                          adjustSelfCommanderDamage(
                            markerModalPlayer.id,
                            entry.damageKey,
                            1
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {killModalTargetPlayer ? (
          <div className="life-modal-backdrop" onClick={closeKillModal}>
            <div
              className="life-modal life-kill-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="life-modal-header">
                <div>
                  <span>Eliminar jogador</span>
                  <strong>
                    Quem matou {getPlayerDisplayName(killModalTargetPlayer)}?
                  </strong>
                </div>

                <button
                  className="life-modal-close"
                  type="button"
                  onClick={closeKillModal}
                >
                  ×
                </button>
              </div>

              <div className="life-killer-options">
                {killModalKillerOptions.map((killer) => (
                  <button
                    key={killer.id}
                    className="life-killer-option"
                    type="button"
                    onClick={() => eliminatePlayer(killModalTargetPlayer.id, killer.id)}
                  >
                    <span className="life-killer-icon">
                      <i
                        className={`ss ${
                          killer.playerIcon || "ss-cmd"
                        }`}
                        aria-hidden="true"
                      />
                    </span>

                    <span>
                      <strong>{getPlayerDisplayName(killer)}</strong>
                      <small>{killer.deckDisplayName || killer.deckName || "Sem deck selecionado"}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

      </main>
    );
  }

  return (
    <main className="life-page life-setup-page">
      <header className="life-topbar">
        <div>
          <span>Marcador de Vida</span>
          <strong>MTG Life Tracker</strong>
        </div>
      </header>

      <section className="life-setup-panel">
        <div className="life-setup-hero">
          <span>Liga Commander</span>
          <h1>Configurar partida</h1>
          <p>
            Defina a vida inicial e quantidade de jogadores.
          </p>
        </div>

        <div className="life-config-group">
          <h2>Vida inicial</h2>
          <div className="life-option-grid life-option-grid-six">
            {LIFE_TOTAL_OPTIONS.map((value) => (
              <button
                key={value}
                className={
                  startingLife === value
                    ? "life-option life-option-active"
                    : "life-option"
                }
                onClick={() => setStartingLife(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="life-config-group">
          <h2>Contagem de jogadores</h2>
          <div className="life-option-grid life-option-grid-count">
            {PLAYER_COUNT_OPTIONS.map((value) => (
              <button
                key={value}
                className={
                  playerCount === value
                    ? "life-option life-option-active"
                    : "life-option"
                }
                onClick={() => setPlayerCount(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <button className="life-start-button" onClick={startMatch}>
          Iniciar Partida
        </button>
        <button
          className="life-transfer-list-button"
          type="button"
          onClick={() => { void loadTransferList(); }}
          aria-label="Partidas salvas — trocar de celular"
          title="Partidas salvas"
        >
          <i className="ss ss-mb1 ss-mythic" aria-hidden="true" />
        </button>
      </section>

      {transferListOpen ? (
        <div className="life-transfer-backdrop" onClick={() => setTransferListOpen(false)}>
          <section
            className="life-transfer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="life-transfer-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <header className="life-transfer-heading">
              <div className="life-transfer-heading-icon" aria-hidden="true">
                <i className="ss ss-mb1 ss-mythic" />
              </div>
              <div className="life-transfer-heading-text">
                <span>Trocar de celular</span>
                <h2 id="life-transfer-modal-title">Partidas salvas</h2>
                <p>Escolha uma partida para continuar de onde parou.</p>
              </div>
              <button
                className="life-transfer-close"
                type="button"
                onClick={() => setTransferListOpen(false)}
                aria-label="Fechar partidas salvas"
              >×</button>
            </header>
            <div className="life-transfer-toolbar">
              <span>Partidas disponíveis</span>
              <button
                type="button"
                className="life-transfer-refresh"
                onClick={() => { void loadTransferList(); }}
                disabled={transferListLoading}
              >
                <span aria-hidden="true">↻</span> Atualizar
              </button>
            </div>
            {transferListError ? <p className="life-transfer-error" role="alert">{transferListError}</p> : null}
            {transferListLoading ? (
              <p className="life-transfer-empty" role="status">Buscando partidas salvas...</p>
            ) : !transferSessions.length ? (
              <div className="life-transfer-empty">
                <i className="ss ss-mb1 ss-mythic" aria-hidden="true" />
                <strong>Nenhuma partida salva</strong>
                <span>Use “Trocar de Celular” durante uma partida para salvá-la aqui.</span>
              </div>
            ) : null}
            {!transferListLoading ? (
              <div className="life-transfer-items">
                {transferSessions.map(session => (
                  <article className="life-transfer-item" key={session.id}>
                    <div className="life-transfer-details">
                      <div className="life-transfer-item-meta">
                        <strong>{session.playerCount} jogadores</strong>
                        <time dateTime={session.updatedAt}>
                          {new Date(session.updatedAt).toLocaleString("pt-BR")}
                        </time>
                      </div>
                      <div className="life-transfer-item-players">
                        {session.players.map((player, index) => (
                          <div
                            className={`life-transfer-player${player.eliminated ? " life-transfer-player-out" : ""}`}
                            key={`${session.id}-${index}`}
                          >
                            <span>{player.name || `Jogador ${index + 1}`}{player.eliminated ? " †" : ""}</span>
                            {player.deck ? <small>{player.deck}</small> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="life-transfer-item-actions">
                      <button
                        type="button"
                        className="life-transfer-continue"
                        disabled={transferBusy}
                        onClick={() => { void continueTransfer(session.id); }}
                      >
                        {transferBusy ? "Abrindo..." : "Continuar partida"}
                      </button>
                      <button
                        type="button"
                        className="life-transfer-delete"
                        disabled={transferBusy}
                        onClick={() => { void removeTransfer(session.id); }}
                      >Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
