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
  commanderDamage: Record<string, number>;
  markers: PlayerMarkers;
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
  authorName: string;
};

type DashboardApiResponse = {
  leaderboards?: {
    geral?: {
      players?: Array<{
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
      }>;
      decks?: Array<{
        deck?: string;
        nome?: string;
        comandante?: string;
        commander?: string;
        fotoUrl?: string;
        imageUrl?: string;
        photoUrl?: string;
        autor?: unknown;
        author?: unknown;
        autorNome?: string;
        authorName?: string;
      }>;
    };
  };
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

        const rawPlayers = data.leaderboards?.geral?.players || [];
        const rawDecks = data.leaderboards?.geral?.decks || [];

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
            imageUrl: deck.fotoUrl || deck.imageUrl || deck.photoUrl || "",
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

  async function requestLandscapeMode() {
    try {
      const root = document.documentElement;

      if (!document.fullscreenElement && root.requestFullscreen) {
        await root.requestFullscreen();
      }

      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };

      if (orientation.lock) {
        await orientation.lock("landscape");
      }
    } catch (error) {
      console.warn("Não foi possível travar em landscape:", error);
    }
  }

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
        commanderDamage: {},
        markers: {
          poison: 0,
          experience: 0,
          radiation: 0,
        },
      })
    );

    setPlayers(slots);
    setMatchStarted(true);
  }

  function resetMatch() {
    try {
      if (screen.orientation?.unlock) {
        screen.orientation.unlock();
      }

      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Não foi possível sair do fullscreen/orientação:", error);
    }

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
    sourcePlayerId: string,
    amount: number
  ) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        if (player.id !== targetPlayerId) return player;

        const currentDamage = player.commanderDamage[sourcePlayerId] || 0;
        const nextDamage = Math.max(0, currentDamage + amount);

        return {
          ...player,
          commanderDamage: {
            ...player.commanderDamage,
            [sourcePlayerId]: nextDamage,
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

    const payload = {
      action: "registerMatchResult",
      startedAt: new Date().toISOString(),
      winnerPlayerName: winner.playerName || winner.label,
      winnerDeckName: winner.deckName || "",
      players: players.map((player) => ({
        id: player.id,
        label: player.label,
        playerName: player.playerName || player.label,
        deckName: player.deckName || "",
        life: player.life,
        commanderDamage: player.commanderDamage,
        markers: player.markers,
        isWinner: player.id === winner.id,
      })),
    };

    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload),
    });

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

  function getPlayerDisplayIcon(player: LifePlayerSlot) {
    return player.playerIcon || "ss-cmd";
  }

  function getCommanderDamageEntries(targetPlayer: LifePlayerSlot) {
    return players
      .filter((sourcePlayer) => sourcePlayer.id !== targetPlayer.id)
      .map((sourcePlayer) => ({
        sourcePlayer,
        damage: targetPlayer.commanderDamage[sourcePlayer.id] || 0,
      }));
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

  if (matchStarted) {
    return (
      <main className="life-page">
        <header className="life-topbar">
          <div>
            <span>Marcador de Vida</span>
            <strong>Partida em andamento</strong>
          </div>

          <button className="life-topbar-button" onClick={resetMatch}>
            Nova partida
          </button>
        </header>

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
              } ${player.deckImageUrl ? "life-player-card-has-deck-bg" : ""}`}
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
                      {getCommanderDamageEntries(player).map(({ sourcePlayer, damage }) => (
                        <span
                          className={
                            damage > 0
                              ? "commander-summary-item commander-summary-item-active"
                              : "commander-summary-item"
                          }
                          key={sourcePlayer.id}
                        >
                          <i
                            className={`ss ${getPlayerDisplayIcon(
                              sourcePlayer
                            )} commander-summary-icon`}
                            aria-hidden="true"
                          />

                          <strong>{damage}</strong>
                        </span>
                      ))}
                    </button>

                    {getVisibleMarkers(player).length > 0 ? (
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
                {getCommanderDamageEntries(commanderDamageModalPlayer).map(
                  ({ sourcePlayer, damage }) => (
                    <div className="commander-modal-row" key={sourcePlayer.id}>
                      <div className="commander-modal-player">
                        <i
                          className={`ss ${getPlayerDisplayIcon(
                            sourcePlayer
                          )} commander-modal-icon`}
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            {sourcePlayer.playerName || sourcePlayer.label}
                          </strong>
                          {sourcePlayer.deckName ? (
                            <span>{sourcePlayer.deckName}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="commander-modal-controls">
                        <button
                          type="button"
                          onClick={() =>
                            adjustCommanderDamage(
                              commanderDamageModalPlayer.id,
                              sourcePlayer.id,
                              -1
                            )
                          }
                        >
                          −
                        </button>

                        <strong
                          className={
                            damage >= 21
                              ? "commander-modal-damage commander-modal-damage-lethal"
                              : "commander-modal-damage"
                          }
                        >
                          {damage}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            adjustCommanderDamage(
                              commanderDamageModalPlayer.id,
                              sourcePlayer.id,
                              1
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                )}
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

        <button
          className="life-topbar-button"
          onClick={() => {
            window.location.hash = "";
          }}
        >
          Ranking
        </button>
      </header>

      <section className="life-setup-panel">
        <div className="life-setup-hero">
          <span>Liga Commander</span>
          <h1>Configurar partida</h1>
          <p>
            Defina a vida inicial, quantidade de jogadores e orientação da mesa.
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
