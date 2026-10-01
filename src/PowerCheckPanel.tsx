import {
  CheckCircle2,
  HelpCircle,
  LoaderCircle,
  Save,
  Search,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


const API_BASE_URL =
  "https://api.corneliomove.com.br/mtg-api";

const DASHBOARD_URL =
  `${API_BASE_URL}/api/dashboard`;


type Score =
  number | null;


type DraftScore =
  number | null | undefined;


type PowerCheckCommunity = {
  powerLevel: number | null;
  powerVotes: number;
  saltLevel: number | null;
  saltVotes: number;
};


type PowerCheckDeck = {
  deckId: number;
  deck: string;
  commander: string;
  owner: string;
  photoUrl: string;
  active: boolean;
  hasVote: boolean;
  powerLevel: Score;
  saltLevel: Score;
  community: PowerCheckCommunity | null;
};


type PowerCheckResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    total: number;
    voted: number;
    pending: number;
  };
  decks?: PowerCheckDeck[];
};


type DashboardDeckStat = {
  deck?: string;
  nome?: string;
  aparicoes?: number | string;
  appearances?: number | string;
  jogos?: number | string;
  games?: number | string;
  winrate?: number | string;
};


type DashboardResponse = {
  leaderboards?: {
    geral?: {
      decks?: DashboardDeckStat[];
    };
  };
};


type DeckStat = {
  games: number;
  winrate: number;
};


type Draft = {
  powerLevel: DraftScore;
  saltLevel: DraftScore;
};


type Filter =
  | "pending"
  | "voted"
  | "all";


type SortMode =
  | "games"
  | "winrate"
  | "name";


function authHeaders(
  token: string,
) {
  return {
    Authorization:
      `Bearer ${token}`,
  };
}


function formatAverage(
  value: number | null,
) {
  if (
    value === null
    || value === undefined
    || Number.isNaN(value)
  ) {
    return "—";
  }

  return value.toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits:
        1,
      maximumFractionDigits:
        2,
    },
  );
}


function draftFromDeck(
  deck: PowerCheckDeck,
): Draft {
  if (!deck.hasVote) {
    return {
      powerLevel:
        undefined,
      saltLevel:
        undefined,
    };
  }

  return {
    powerLevel:
      deck.powerLevel,
    saltLevel:
      deck.saltLevel,
  };
}


function isCompleteDraft(
  draft: Draft | undefined,
): draft is {
  powerLevel: Score;
  saltLevel: Score;
} {
  return Boolean(
    draft
    && draft.powerLevel
      !== undefined
    && draft.saltLevel
      !== undefined,
  );
}


function isChangedDraft(
  deck: PowerCheckDeck,
  draft: Draft | undefined,
) {
  if (!isCompleteDraft(draft)) {
    return false;
  }

  if (!deck.hasVote) {
    return true;
  }

  return (
    draft.powerLevel
      !== deck.powerLevel
    || draft.saltLevel
      !== deck.saltLevel
  );
}


function formatWinrate(
  value: number,
) {
  return `${(
    value * 100
  ).toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits:
        1,
    },
  )}% WR`;
}


function VoteScale({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: DraftScore;
  disabled?: boolean;
  onChange: (
    value: Score,
  ) => void;
}) {
  return (
    <div className="power-check-metric">
      <div className="power-check-metric-heading">
        <strong>{label}</strong>

        <span>
          {value === undefined
            ? "Escolha uma opção"
            : value === null
              ? "Não sei"
              : `${value}/10`}
        </span>
      </div>

      <div
        className="power-check-scale"
        role="group"
        aria-label={label}
      >
        {Array.from(
          {
            length: 10,
          },
          (_, index) =>
            index + 1,
        ).map(
          (score) => (
            <button
              type="button"
              key={score}
              disabled={disabled}
              className={
                value === score
                  ? "selected"
                  : ""
              }
              aria-pressed={
                value === score
              }
              onClick={() =>
                onChange(score)
              }
            >
              {score}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={disabled}
          className={
            `power-check-unknown${
              value === null
                ? " selected"
                : ""
            }`
          }
          aria-pressed={
            value === null
          }
          onClick={() =>
            onChange(null)
          }
        >
          <HelpCircle
            size={15}
          />
          Não sei
        </button>
      </div>
    </div>
  );
}


export default function
PowerCheckPanel({
  token,
  targetDeck = "",
}: {
  token: string;
  targetDeck?: string;
}) {
  const [
    decks,
    setDecks,
  ] = useState<
    PowerCheckDeck[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<Filter>(
    "pending",
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    ownerFilter,
    setOwnerFilter,
  ] = useState("all");

  const [
    sortMode,
    setSortMode,
  ] = useState<SortMode>(
    "games",
  );

  const [
    deckStats,
    setDeckStats,
  ] = useState<
    Record<string, DeckStat>
  >({});

  const [
    drafts,
    setDrafts,
  ] = useState<
    Record<number, Draft>
  >({});

  const [
    savingDeckId,
    setSavingDeckId,
  ] = useState<
    number | null
  >(null);

  const [
    savingAll,
    setSavingAll,
  ] = useState(false);

  const [
    deepLinkDeckId,
    setDeepLinkDeckId,
  ] = useState<
    number | null
  >(null);

  const handledDeepLink =
    useRef("");



  function applyResponse(
    payload: PowerCheckResponse,
  ) {
    const nextDecks =
      payload.decks
      ?? [];

    setDecks(
      nextDecks,
    );

    setDrafts(
      Object.fromEntries(
        nextDecks.map(
          (deck) => [
            deck.deckId,
            draftFromDeck(
              deck,
            ),
          ],
        ),
      ),
    );
  }


  async function load() {
    try {
      setLoading(true);
      setError("");

      const [
        powerResponse,
        dashboardResponse,
      ] =
        await Promise.all([
          fetch(
            `${API_BASE_URL}/api/editor/power-check`,
            {
              headers:
                authHeaders(
                  token,
                ),
            },
          ),

          fetch(
            `${DASHBOARD_URL}?t=${Date.now()}`,
          ),
        ]);

      const powerJson =
        (await powerResponse.json()) as PowerCheckResponse;

      if (
        !powerResponse.ok
        || powerJson.ok === false
        || powerJson.error
      ) {
        throw new Error(
          powerJson.error
          || "Não foi possível carregar o Power Check.",
        );
      }

      const dashboardJson =
        dashboardResponse.ok
          ? (await dashboardResponse.json()) as DashboardResponse
          : {};

      const dashboardDecks =
        dashboardJson
          .leaderboards
          ?.geral
          ?.decks
        ?? [];

      setDeckStats(
        Object.fromEntries(
          dashboardDecks
            .map(
              (deck) => {
                const name =
                  String(
                    deck.deck
                    || deck.nome
                    || "",
                  ).trim();

                const games =
                  Number(
                    deck.aparicoes
                    ?? deck.appearances
                    ?? deck.jogos
                    ?? deck.games
                    ?? 0,
                  );

                const winrate =
                  Number(
                    deck.winrate
                    ?? 0,
                  );

                return [
                  name,
                  {
                    games:
                      Number.isFinite(
                        games,
                      )
                        ? games
                        : 0,

                    winrate:
                      Number.isFinite(
                        winrate,
                      )
                        ? winrate
                        : 0,
                  },
                ] as const;
              },
            )
            .filter(
              ([name]) =>
                Boolean(name),
            ),
        ),
      );

      applyResponse(
        powerJson,
      );

    } catch (loadError) {
      setError(
        loadError
        instanceof Error
          ? loadError.message
          : "Não foi possível carregar o Power Check.",
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => {
      void load();
    },
    [token],
  );


  const summary =
    useMemo(
      () => {
        const voted =
          decks.filter(
            (deck) =>
              deck.hasVote,
          ).length;

        return {
          total:
            decks.length,
          voted,
          pending:
            decks.length
            - voted,
        };
      },
      [decks],
    );


  const authors =
    useMemo(
      () =>
        Array.from(
          new Set(
            decks
              .map(
                (deck) =>
                  deck.owner.trim(),
              )
              .filter(Boolean),
          ),
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR",
            ),
        ),
      [decks],
    );


  const readyToSave =
    useMemo(
      () =>
        decks.filter(
          (deck) =>
            isChangedDraft(
              deck,
              drafts[
                deck.deckId
              ],
            ),
        ),
      [
        decks,
        drafts,
      ],
    );


  const visible =
    useMemo(
      () => {
        const needle =
          search
            .trim()
            .toLocaleLowerCase(
              "pt-BR",
            );

        return decks
          .filter(
            (deck) => {
              if (
                filter === "pending"
                && deck.hasVote
              ) {
                return false;
              }

              if (
                filter === "voted"
                && !deck.hasVote
              ) {
                return false;
              }

              if (
                ownerFilter
                  !== "all"
                && deck.owner
                  !== ownerFilter
              ) {
                return false;
              }

              if (!needle) {
                return true;
              }

              return [
                deck.deck,
                deck.commander,
                deck.owner,
              ]
                .join(" ")
                .toLocaleLowerCase(
                  "pt-BR",
                )
                .includes(
                  needle,
                );
            },
          )
          .sort(
            (a, b) => {
              const aStats =
                deckStats[
                  a.deck
                ] ?? {
                  games: 0,
                  winrate: 0,
                };

              const bStats =
                deckStats[
                  b.deck
                ] ?? {
                  games: 0,
                  winrate: 0,
                };

              if (
                sortMode
                === "winrate"
              ) {
                return (
                  bStats.winrate
                    - aStats.winrate
                  || bStats.games
                    - aStats.games
                  || a.deck.localeCompare(
                    b.deck,
                    "pt-BR",
                  )
                );
              }

              if (
                sortMode
                === "name"
              ) {
                return a.deck.localeCompare(
                  b.deck,
                  "pt-BR",
                );
              }

              return (
                bStats.games
                  - aStats.games
                || bStats.winrate
                  - aStats.winrate
                || a.deck.localeCompare(
                  b.deck,
                  "pt-BR",
                )
              );
            },
          );
      },
      [
        decks,
        deckStats,
        filter,
        ownerFilter,
        search,
        sortMode,
      ],
    );


  useEffect(
    () => {
      const requested =
        targetDeck.trim();

      if (
        !requested
        || !decks.length
      ) {
        return;
      }

      const normalized =
        requested.toLocaleLowerCase(
          "pt-BR",
        );

      const target =
        decks.find(
          (deck) =>
            deck.deck
              .trim()
              .toLocaleLowerCase(
                "pt-BR",
              )
            === normalized,
        );

      if (!target) {
        return;
      }

      const key =
        `${target.deckId}:${target.deck}`;

      if (
        handledDeepLink.current
        === key
      ) {
        return;
      }

      handledDeepLink.current =
        key;

      setFilter(
        "all",
      );
      setOwnerFilter(
        "all",
      );
      setSearch(
        target.deck,
      );
      setDeepLinkDeckId(
        target.deckId,
      );
    },
    [
      decks,
      targetDeck,
    ],
  );


  useEffect(
    () => {
      if (
        deepLinkDeckId
        === null
      ) {
        return;
      }

      const scrollTimer =
        window.setTimeout(
          () => {
            document
              .getElementById(
                `power-check-deck-${deepLinkDeckId}`,
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",
                block:
                  "center",
              });
          },
          80,
        );

      const highlightTimer =
        window.setTimeout(
          () =>
            setDeepLinkDeckId(
              null,
            ),
          3200,
        );

      return () => {
        window.clearTimeout(
          scrollTimer,
        );
        window.clearTimeout(
          highlightTimer,
        );
      };
    },
    [
      deepLinkDeckId,
      visible,
    ],
  );


  function updateDraft(
    deckId: number,
    metric:
      | "powerLevel"
      | "saltLevel",
    value: Score,
  ) {
    setDrafts(
      (current) => ({
        ...current,

        [deckId]: {
          ...(
            current[deckId]
            ?? {
              powerLevel:
                undefined,
              saltLevel:
                undefined,
            }
          ),

          [metric]:
            value,
        },
      }),
    );

    setNotice("");
  }


  async function save(
    deck: PowerCheckDeck,
  ) {
    const draft =
      drafts[deck.deckId];

    if (
      !draft
      || draft.powerLevel
        === undefined
      || draft.saltLevel
        === undefined
    ) {
      setNotice(
        'Escolha Power-Level e Salt-Level. Use "Não sei" quando não tiver opinião sobre uma das métricas.',
      );

      return;
    }

    try {
      setSavingDeckId(
        deck.deckId,
      );

      setError("");
      setNotice("");

      const response =
        await fetch(
          `${API_BASE_URL}/api/editor/power-check/${deck.deckId}`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",

              ...authHeaders(
                token,
              ),
            },

            body:
              JSON.stringify({
                powerLevel:
                  draft.powerLevel,

                saltLevel:
                  draft.saltLevel,
              }),
          },
        );

      const json =
        (await response.json()) as PowerCheckResponse;

      if (
        !response.ok
        || json.ok === false
        || json.error
      ) {
        throw new Error(
          json.error
          || "Não foi possível salvar a avaliação.",
        );
      }

      applyResponse(
        json,
      );

      setNotice(
        `Avaliação de ${deck.deck} salva.`,
      );

    } catch (saveError) {
      setError(
        saveError
        instanceof Error
          ? saveError.message
          : "Não foi possível salvar a avaliação.",
      );

    } finally {
      setSavingDeckId(
        null,
      );
    }
  }


  async function saveAll() {
    const targets =
      readyToSave
        .map(
          (deck) => ({
            deck,
            draft:
              drafts[
                deck.deckId
              ],
          }),
        )
        .filter(
          (
            item,
          ): item is {
            deck: PowerCheckDeck;
            draft: {
              powerLevel: Score;
              saltLevel: Score;
            };
          } =>
            isCompleteDraft(
              item.draft,
            ),
        );

    if (!targets.length) {
      setNotice(
        "Nenhuma avaliação completa foi alterada.",
      );
      return;
    }

    try {
      setSavingAll(true);
      setSavingDeckId(null);
      setError("");
      setNotice("");

      let latest:
        PowerCheckResponse
        | null =
          null;

      for (
        const {
          deck,
          draft,
        }
        of targets
      ) {
        const response =
          await fetch(
            `${API_BASE_URL}/api/editor/power-check/${deck.deckId}`,
            {
              method:
                "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                ...authHeaders(
                  token,
                ),
              },

              body:
                JSON.stringify({
                  powerLevel:
                    draft.powerLevel,

                  saltLevel:
                    draft.saltLevel,
                }),
            },
          );

        const json =
          (await response.json()) as PowerCheckResponse;

        if (
          !response.ok
          || json.ok === false
          || json.error
        ) {
          throw new Error(
            json.error
            || `Não foi possível salvar ${deck.deck}.`,
          );
        }

        latest =
          json;
      }

      if (latest) {
        applyResponse(
          latest,
        );
      }

      setNotice(
        targets.length === 1
          ? "1 avaliação salva."
          : `${targets.length} avaliações salvas.`,
      );

    } catch (saveError) {
      const message =
        saveError
        instanceof Error
          ? `${saveError.message} As avaliações anteriores deste lote podem já ter sido salvas.`
          : "Não foi possível concluir o salvamento em lote.";

      await load();

      setError(
        message,
      );

    } finally {
      setSavingAll(false);
    }
  }


  return (
    <>
      <div className="editor-page-heading power-check-heading">
        <div>
          <span>
            Avaliação da comunidade
          </span>

          <h1>
            Power Check
          </h1>

          <p>
            Dê uma nota de 1 a 10 para Power-Level e Salt-Level. Se não souber avaliar uma métrica, marque Não sei.
          </p>
        </div>

        <div className="power-check-heading-actions">
          <div className="power-check-progress">
            <strong>
              {summary.voted}/{summary.total}
            </strong>

            <span>
              decks avaliados
            </span>
          </div>

          <button
            type="button"
            className="editor-primary-button power-check-save-all"
            disabled={
              savingAll
              || savingDeckId
                !== null
              || readyToSave.length
                === 0
            }
            onClick={() =>
              void saveAll()
            }
          >
            {savingAll ? (
              <LoaderCircle
                size={17}
                className="spin"
              />
            ) : (
              <Save size={17} />
            )}

            {savingAll
              ? "Salvando..."
              : `Salvar todos (${readyToSave.length})`}
          </button>
        </div>
      </div>

      <div className="power-check-toolbar">
        <div
          className="power-check-filters"
          role="tablist"
          aria-label="Filtrar avaliações"
        >
          <button
            type="button"
            className={
              filter === "pending"
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter(
                "pending",
              )
            }
          >
            Não avaliados
            <span>
              {summary.pending}
            </span>
          </button>

          <button
            type="button"
            className={
              filter === "voted"
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter(
                "voted",
              )
            }
          >
            Avaliados
            <span>
              {summary.voted}
            </span>
          </button>

          <button
            type="button"
            className={
              filter === "all"
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter(
                "all",
              )
            }
          >
            Todos
            <span>
              {summary.total}
            </span>
          </button>
        </div>

        <div className="power-check-tools">
          <label className="power-check-search">
            <Search size={17} />

            <input
              value={search}
              onChange={
                (event) =>
                  setSearch(
                    event.target.value,
                  )
              }
              placeholder="Buscar deck..."
            />
          </label>

          <label className="power-check-select">
            <span>Autor</span>
            <select
              value={ownerFilter}
              onChange={
                (event) =>
                  setOwnerFilter(
                    event.target.value,
                  )
              }
            >
              <option value="all">
                Todos os autores
              </option>

              {authors.map(
                (author) => (
                  <option
                    key={author}
                    value={author}
                  >
                    {author}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="power-check-select">
            <span>Ordenar</span>
            <select
              value={sortMode}
              onChange={
                (event) =>
                  setSortMode(
                    event.target.value as SortMode,
                  )
              }
            >
              <option value="games">
                Mais partidas
              </option>
              <option value="winrate">
                Maior winrate
              </option>
              <option value="name">
                Nome A-Z
              </option>
            </select>
          </label>
        </div>
      </div>

      {notice ? (
        <div className="power-check-notice">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      ) : null}

      {error ? (
        <div className="editor-notice editor-notice-error">
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="power-check-loading">
          <LoaderCircle
            size={22}
            className="spin"
          />
          Carregando decks...
        </div>
      ) : null}

      {!loading
      && !visible.length ? (
        <div className="power-check-empty">
          <Zap size={24} />
          <strong>
            Nenhum deck neste filtro
          </strong>
          <span>
            Tente outro filtro ou outra busca.
          </span>
        </div>
      ) : null}

      {!loading
      && visible.length ? (
        <div className="power-check-list">
          {visible.map(
            (deck) => {
              const draft =
                drafts[deck.deckId]
                ?? {
                  powerLevel:
                    undefined,
                  saltLevel:
                    undefined,
                };

              const saving =
                savingDeckId
                === deck.deckId;

              const stats =
                deckStats[
                  deck.deck
                ] ?? {
                  games: 0,
                  winrate: 0,
                };

              return (
                <article
                  id={
                    `power-check-deck-${deck.deckId}`
                  }
                  className={
                    `power-check-card${
                      deck.hasVote
                        ? " voted"
                        : ""
                    }${
                      deepLinkDeckId
                      === deck.deckId
                        ? " power-check-deep-link-target"
                        : ""
                    }`
                  }
                  key={deck.deckId}
                >
                  <div className="power-check-card-header">
                    <div className="power-check-deck-image">
                      {deck.photoUrl ? (
                        <img
                          src={
                            deck.photoUrl
                          }
                          alt=""
                        />
                      ) : (
                        <Zap
                          size={24}
                        />
                      )}
                    </div>

                    <div className="power-check-deck-copy">
                      <div className="power-check-deck-title-row">
                        <h2>
                          {deck.deck}
                        </h2>

                        {deck.hasVote ? (
                          <span className="power-check-voted-badge">
                            <CheckCircle2 size={14} />
                            Avaliado
                          </span>
                        ) : null}

                        {!deck.active ? (
                          <span className="power-check-inactive-badge">
                            Inativo
                          </span>
                        ) : null}
                      </div>

                      {deck.commander ? (
                        <p>
                          {deck.commander}
                          {deck.owner
                            ? ` · ${deck.owner}`
                            : ""}
                        </p>
                      ) : deck.owner ? (
                        <p>
                          {deck.owner}
                        </p>
                      ) : null}

                      <div className="power-check-deck-stats">
                        <span>
                          {stats.games} {stats.games === 1 ? "partida" : "partidas"}
                        </span>
                        <span>
                          {formatWinrate(
                            stats.winrate,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <VoteScale
                    label="Power-Level"
                    value={
                      draft.powerLevel
                    }
                    disabled={
                      saving
                      || savingAll
                    }
                    onChange={
                      (value) =>
                        updateDraft(
                          deck.deckId,
                          "powerLevel",
                          value,
                        )
                    }
                  />

                  <VoteScale
                    label="Salt-Level"
                    value={
                      draft.saltLevel
                    }
                    disabled={
                      saving
                      || savingAll
                    }
                    onChange={
                      (value) =>
                        updateDraft(
                          deck.deckId,
                          "saltLevel",
                          value,
                        )
                    }
                  />

                  {deck.hasVote
                  && deck.community ? (
                    <div className="power-check-community">
                      <div>
                        <span>
                          Comunidade · Power
                        </span>
                        <strong>
                          {formatAverage(
                            deck.community
                              .powerLevel,
                          )}
                        </strong>
                        <small>
                          {deck.community.powerVotes} voto{deck.community.powerVotes === 1 ? "" : "s"} válido{deck.community.powerVotes === 1 ? "" : "s"}
                        </small>
                      </div>

                      <div>
                        <span>
                          Comunidade · Salt
                        </span>
                        <strong>
                          {formatAverage(
                            deck.community
                              .saltLevel,
                          )}
                        </strong>
                        <small>
                          {deck.community.saltVotes} voto{deck.community.saltVotes === 1 ? "" : "s"} válido{deck.community.saltVotes === 1 ? "" : "s"}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <p className="power-check-bias-note">
                      A média da comunidade aparece depois que você salvar sua avaliação.
                    </p>
                  )}

                  <div className="power-check-card-footer">
                    <button
                      type="button"
                      className="editor-primary-button"
                      disabled={
                        savingAll
                        || saving
                        || draft.powerLevel
                          === undefined
                        || draft.saltLevel
                          === undefined
                      }
                      onClick={() =>
                        void save(
                          deck,
                        )
                      }
                    >
                      {saving ? (
                        <LoaderCircle
                          size={17}
                          className="spin"
                        />
                      ) : (
                        <Save
                          size={17}
                        />
                      )}

                      {saving
                        ? "Salvando..."
                        : deck.hasVote
                          ? "Atualizar avaliação"
                          : "Salvar avaliação"}
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      ) : null}

      {!loading ? (
        <div className="power-check-bulk-footer">
          <button
            type="button"
            className="editor-primary-button power-check-save-all"
            disabled={
              savingAll
              || savingDeckId
                !== null
              || readyToSave.length
                === 0
            }
            onClick={() =>
              void saveAll()
            }
          >
            {savingAll ? (
              <LoaderCircle
                size={17}
                className="spin"
              />
            ) : (
              <Save size={17} />
            )}

            {savingAll
              ? "Salvando..."
              : `Salvar todos (${readyToSave.length})`}
          </button>
        </div>
      ) : null}
    </>
  );
}
