import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  playerIcon: string;
  deckName: string;
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
const PLAYER_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];

const API_URL =
  "https://script.google.com/macros/s/AKfycbwureAMUuD7InHeJL72eailwyiYe-tafREBax46DTpqG4yNPnMrcs_ZGTQluvh-csNi/exec";

type LeaguePlayerOption = {
  name: string;
  icon: string;
  matches: number;
  favoriteDeckName: string;
  bestDeckName: string;
};

type LeagueDeckOption = {
  name: string;
  commander: string;
  imageUrl: string;
  secondaryCommander: string;
  secondaryCommanderImageUrl: string;
  secondaryCommanderType: string;
  authorName: string;
};

type DashboardApiPlayer = {
  jogador?: string;
  player?: string;
  nome?: string;
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
    .map((player) => player.playerName)
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
      record.nome ||
        record.name ||
        record.jogador ||
        record.player ||
        record.deck ||
        ""
    ).trim();
  }

  return "";
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

  useEffect(() => {
    async function loadLeagueData() {
      try {
        setLeagueDataLoading(true);
        setLeagueDataError("");

        const response = await fetch(`${API_URL}?t=${Date.now()}`);

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
          .map((deck) => ({
            name: deck.deck || deck.nome || "Deck sem nome",
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
            imageUrl:
              deck.arteUrl ||
              deck.artUrl ||
              deck.fotoUrl ||
              deck.imageUrl ||
              deck.photoUrl ||
              "",
            authorName:
              getApiMiniName(deck.autor) ||
              getApiMiniName(deck.author) ||
              deck.autorNome ||
              deck.authorName ||
              "",
          }))
          .filter((deck) => deck.name.trim())
          .sort((a, b) => a.name.localeCompare(b.name));

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
        playerIcon: "",
        deckName: "",
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

    clearHoldTimers();

    setFinishConfirmOpen(false);

    setWinnerModalOpen(false);
    setSelectedWinnerId("");
    setMatchSubmitError("");
    setSelectionModal(null);
    setCommanderDamageModalPlayerId(null);
    setMarkerModalPlayerId(null);

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
  setFinishConfirmOpen(true);
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
  const winner = players.find((player) => player.id === selectedWinnerId);

  if (!winner) {
    setMatchSubmitError("Selecione o jogador vencedor.");
    return;
  }

  try {
    setMatchSubmitting(true);
    setMatchSubmitError("");

    const manuallyMarkedKillEvents = players
      .filter((player) => player.isEliminated && player.eliminatedByPlayerId)
      .map((player) => {
        const killer = players.find(
          (possibleKiller) => possibleKiller.id === player.eliminatedByPlayerId
        );

        return {
          killerPlayerName: killer ? getPlayerDisplayName(killer) : "",
          killerDeckName: killer?.deckName || "",
          eliminatedPlayerName: getPlayerDisplayName(player),
          eliminatedDeckName: player.deckName || "",
        };
      })
      .filter(
        (event) => event.killerPlayerName && event.eliminatedPlayerName
      );

    const winnerFinishingKillEvents = players
      .filter((player) => player.id !== winner.id)
      .filter((player) => !player.isEliminated)
      .map((player) => ({
        killerPlayerName: getPlayerDisplayName(winner),
        killerDeckName: winner.deckName || "",
        eliminatedPlayerName: getPlayerDisplayName(player),
        eliminatedDeckName: player.deckName || "",
      }));

    const killEvents = [
      ...manuallyMarkedKillEvents,
      ...winnerFinishingKillEvents,
    ];

    const payload = {
      action: "registerMatchResult",
      startedAt: new Date().toISOString(),
      winnerPlayerName: winner.playerName || winner.label,
      winnerDeckName: winner.deckName || "",
      killEvents,
      players: players.map((player) => ({
        id: player.id,
        label: player.label,
        playerName: player.playerName || player.label,
        deckName: player.deckName || "",
        life: player.life,
        commanderDamage: player.commanderDamage,
        markers: player.markers,
        isEliminated: player.isEliminated,
        eliminatedByPlayerId: player.eliminatedByPlayerId,
        isWinner: player.id === winner.id,
      })),
    };

    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload),
    });

    await requestPortraitMode();

    setWinnerModalOpen(false);
    setSelectedWinnerId("");
    setMatchStarted(false);
    setPlayers([]);
  } catch (error) {
    setMatchSubmitError("Não foi possível enviar a partida.");
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
    const playerName = normalizeComparableText(selectedPlayer.name);
    const favoriteDeckName = normalizeComparableText(
      selectedPlayer.favoriteDeckName
    );
    const bestDeckName = normalizeComparableText(selectedPlayer.bestDeckName);
    const authorName = normalizeComparableText(deck.authorName);

    if (favoriteDeckName && deckName === favoriteDeckName) {
      return 0;
    }

    if (bestDeckName && deckName === bestDeckName) {
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
        isSameText(selectedName, player.name)
      );

      if (isAlreadySelected) {
        return false;
      }

      if (!search) {
        return true;
      }

      return player.name.toLowerCase().includes(search);
    });
  }, [leaguePlayers, searchTerm, players, selectionModal]);

  const selectedDeckSlotPlayer =
    selectionModal?.type === "deck"
      ? players.find((player) => player.id === selectionModal.playerSlotId)
      : null;

  const selectedLeaguePlayerForDeckModal =
    selectedDeckSlotPlayer?.playerName
      ? leaguePlayers.find(
          (player) =>
            normalizeComparableText(player.name) ===
            normalizeComparableText(selectedDeckSlotPlayer.playerName)
        ) || null
      : null;

  const filteredLeagueDecks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
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

      if (isAlreadySelected) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        deck.name.toLowerCase().includes(search) ||
        deck.commander.toLowerCase().includes(search) ||
        deck.authorName.toLowerCase().includes(search)
      );
    });

    return filteredDecks.slice().sort((a, b) => {
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

      return a.name.localeCompare(b.name);
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
                player.isEliminated ? "life-player-eliminated" : ""
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

              <div className="life-player-rotator">
                <div className="life-player-card-bg" />
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
                    <strong>{player.deckName || "Selecionar deck"}</strong>
                  </button>
                </div>

                <div className="life-companion-grid">
                  <div className="life-utility-column life-utility-column-left">
                    <button
                      className="life-small-action"
                      type="button"
                      onClick={() => openCommanderDamageModal(player.id)}
                      title="Dano de comandante"
                    >
                      <span>Dano</span>
                    </button>

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

                    <button
                      className="commander-summary"
                      type="button"
                      onClick={() => openCommanderDamageModal(player.id)}
                      title="Ver dano de comandante"
                    >
                      {getCommanderDamageEntries(player).map((entry) => (
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

                    {hasVisibleMarkerInfo(player) ? (
                      <button
                        className="marker-summary"
                        type="button"
                        onClick={() => openMarkerModal(player.id)}
                        title="Ver marcadores"
                      >
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
                    ) : null}
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
              </div>
            </div>
          ))}
        </section>

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

              <div className="match-result-actions">
                <button
                  className="match-result-secondary"
                  type="button"
                  onClick={closeFinishConfirm}
                >
                  Ainda não
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

                      {player.deckName ? <span>{player.deckName}</span> : null}
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
                        <strong>{deck.name}</strong>
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
                    <small>{commanderDamageModalPlayer.deckName}</small>
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
                    <small>{markerModalPlayer.deckName}</small>
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
                      <small>{killer.deckName || "Sem deck selecionado"}</small>
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
          <div className="life-option-grid life-option-grid-six">
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
      </section>
    </main>
  );
}
