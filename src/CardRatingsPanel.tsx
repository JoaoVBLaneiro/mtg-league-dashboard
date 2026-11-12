import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageSquarePlus, RefreshCw, Search } from "lucide-react";
import "./cardRatings.css";
import { EMPTY_PAIO_CONFIG, fetchPaioConfig, catalogEntry, paioThresholds, normalizePaioKey, type PaioConfig } from "./paioConfig";

type CardRating = { name: string; average: number; votes?: number };
type RankingResponse = {
  cards: CardRating[];
  totalCards: number;
  updatedAt: string;
  stale?: boolean;
};

type ScryfallCard = {
  name: string;
  scryfall_uri?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: { image_uris?: { normal?: string; large?: string } }[];
};

type CardVisual = {
  imageUrl?: string;
  scryfallUrl?: string;
};

type ConceptOverride = {
  destinationUrl: string;
  representativeName: string;
};

type DisplayCard = CardRating & {
  key: string;
  lookupName: string;
  destinationUrl: string;
  roundedScore: number;
  isConcept: boolean;
};

const API_URL = "https://api.corneliomove.com.br/mtg-api/api/cards/ranking";
const FORM_URL = "https://forms.gle/sLXPYiA46CgXTVhk6";
const SCRYFALL_COLLECTION_URL = "https://api.scryfall.com/cards/collection";
const SCRYFALL_GAME_CHANGERS_URL = "https://api.scryfall.com/cards/search?q=is%3Agame-changer&unique=cards";
const EDHREC_COMBOS_URL = "https://edhrec.com/combos";

const CONCEPT_OVERRIDES: Record<string, ConceptOverride> = {
  "Triomas Tipais no geral": {
    destinationUrl: scryfallSearchUrl("otag:triome"),
    representativeName: "Ketria Triome",
  },
  "Shock Lands no geral": {
    destinationUrl: scryfallSearchUrl("otag:shockland"),
    representativeName: "Overgrown Tomb",
  },
  "Shocklands no Geral": {
    destinationUrl: scryfallSearchUrl("otag:shockland"),
    representativeName: "Overgrown Tomb",
  },
  "Old Duals no Geral": {
    destinationUrl: scryfallSearchUrl("otag:cycle-abu-dual-land"),
    representativeName: "Volcanic Island",
  },
  "Fetch Lands no geral": {
    destinationUrl: scryfallSearchUrl("otag:cycle-fetchland"),
    representativeName: "Arid Mesa",
  },
  "Cartas de Combates Extra": {
    destinationUrl: scryfallSearchUrl("otag:extra-combat-phase"),
    representativeName: "Seize the Day",
  },
  "Cartas de Combates Extras": {
    destinationUrl: scryfallSearchUrl("otag:extra-combat-phase"),
    representativeName: "Seize the Day",
  },
  "Punish de Draw": {
    destinationUrl: scryfallSearchUrl("otag:draw-hate"),
    representativeName: "Sheoldred, The Apocalypse",
  },
  "Combos de Duas Cartas": {
    destinationUrl: EDHREC_COMBOS_URL,
    representativeName: "Frenetic Efreet",
  },
  "Mass Land Denial": {
    destinationUrl: scryfallSearchUrl("otag:mass-land-denial"),
    representativeName: "Blood Moon",
  },
  "Mass Land Destruction": {
    destinationUrl: scryfallSearchUrl("otag:mass-land-destruction otag:removal-land"),
    representativeName: "Armageddon",
  },
  "Cartas de Turno Extra": {
    destinationUrl: scryfallSearchUrl("otag:extra-turn"),
    representativeName: "Nexus of Fate",
  },
};

function scryfallSearchUrl(query: string) {
  return `https://scryfall.com/search?q=${encodeURIComponent(query)}`;
}

function normalizeNameKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function roundPiaoScore(value: number) {
  const integer = Math.floor(value);
  const decimal = value - integer;
  if (decimal <= 0.5) return integer;
  return Math.ceil(value);
}

function fallbackScryfallUrl(name: string) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!\"${name}\"`)}`;
}

function extractCardVisual(card: ScryfallCard | null) {
  if (!card) return {};
  const imageUrl = card.image_uris?.normal
    ?? card.image_uris?.large
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.large;

  return {
    imageUrl,
    scryfallUrl: card.scryfall_uri ?? fallbackScryfallUrl(card.name),
  } satisfies CardVisual;
}

async function fetchNamedCard(name: string) {
  const urls = [
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`,
  ];

  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) continue;
    return (await response.json()) as ScryfallCard;
  }

  return null;
}

async function fetchScryfallCollection(names: string[]) {
  const uniqueNames = [...new Set(names)];
  const chunks: string[][] = [];
  for (let index = 0; index < uniqueNames.length; index += 75) {
    chunks.push(uniqueNames.slice(index, index + 75));
  }

  const visualMap: Record<string, CardVisual> = {};

  await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(SCRYFALL_COLLECTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifiers: chunk.map((name) => ({ name })),
        }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível consultar as imagens das cartas no Scryfall.");
      }

      const payload: { data?: ScryfallCard[] } = await response.json();
      for (const card of payload.data ?? []) {
        visualMap[normalizeNameKey(card.name)] = extractCardVisual(card);
      }
    }),
  );

  const unresolvedNames = uniqueNames.filter((name) => {
    const visual = visualMap[normalizeNameKey(name)];
    return !visual?.imageUrl;
  });

  await Promise.all(
    unresolvedNames.map(async (name) => {
      const card = await fetchNamedCard(name);
      if (!card) return;
      visualMap[normalizeNameKey(name)] = extractCardVisual(card);
    }),
  );

  return visualMap;
}

async function fetchGameChangerSet() {
  const names = new Set<string>();
  let nextUrl: string | null = SCRYFALL_GAME_CHANGERS_URL;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      throw new Error("Não foi possível consultar a lista de Game Changers no Scryfall.");
    }

    const payload: {
      data?: { name?: string }[];
      has_more?: boolean;
      next_page?: string;
    } = await response.json();

    for (const card of payload.data ?? []) {
      if (card.name) names.add(normalizeNameKey(card.name));
    }

    nextUrl = payload.has_more ? payload.next_page ?? null : null;
  }

  return names;
}

function expandDisplayCards(cards: CardRating[], config: PaioConfig) {
  return cards.flatMap<DisplayCard>((card) => {
    if (card.name === "Three Visits / Nature's Lore") {
      return ["Three Visits", "Nature's Lore"].map((name) => ({
        ...card,
        key: `${card.name}::${name}`,
        name,
        lookupName: name,
        destinationUrl: fallbackScryfallUrl(name),
        roundedScore: Math.max(0, Math.min(10, roundPiaoScore(card.average))),
        isConcept: false,
      }));
    }

    const threshold = paioThresholds(config).find((rule) => normalizePaioKey(rule.concept) === normalizePaioKey(card.name));
    const thresholdArt = threshold?.tagKey === "counterspell" ? "Counterspell" : threshold?.tagKey === "boardwipe" ? "Wrath of God" : undefined;
    const concept = CONCEPT_OVERRIDES[card.name];
    const override = catalogEntry(config, card.name);
    return [{
      ...card,
      key: card.name,
      name: card.name,
      lookupName: override?.artCard || thresholdArt || (override?.kind === "card" ? card.name : concept?.representativeName ?? card.name),
      destinationUrl: override?.linkUrl || (thresholdArt ? fallbackScryfallUrl(thresholdArt) : undefined) || (override?.kind === "card" ? fallbackScryfallUrl(card.name) : concept?.destinationUrl ?? fallbackScryfallUrl(override?.artCard || card.name)),
      roundedScore: Math.max(0, Math.min(10, roundPiaoScore(card.average))),
      isConcept: Boolean(threshold) || override?.kind === "concept" || (override?.kind !== "card" && Boolean(concept)),
    }];
  });
}

export default function CardRatingsPanel() {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [visualsByLookupName, setVisualsByLookupName] = useState<Record<string, CardVisual>>({});
  const [gameChangers, setGameChangers] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<PaioConfig>(EMPTY_PAIO_CONFIG);

  useEffect(() => {
    let active = true;

    async function load(initial: boolean) {
      if (!initial && active) setRefreshing(true);
      try {
        const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("As médias ainda não estão disponíveis no servidor.");
        const payload: RankingResponse = await response.json();
        if (!Array.isArray(payload.cards)) throw new Error("Resposta inválida da API de cartas.");
        if (active) {
          setData(payload);
          setError("");
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Falha ao atualizar médias.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load(true);
    const interval = window.setInterval(() => void load(false), 5 * 60 * 1000);
    const refresh = () => void load(false);
    window.addEventListener("mtg-refresh-card-ratings", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("mtg-refresh-card-ratings", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadConfig = () => { void fetchPaioConfig().then((value) => { if (active) setConfig(value); }).catch(() => {}); };
    loadConfig();
    const interval = window.setInterval(loadConfig, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const displayCards = useMemo(() => expandDisplayCards(data?.cards ?? [], config), [data, config]);

  useEffect(() => {
    if (!displayCards.length) return;
    let active = true;

    void Promise.all([
      fetchScryfallCollection(displayCards.map((card) => card.lookupName)),
      fetchGameChangerSet(),
    ])
      .then(([visualMap, gcSet]) => {
        if (!active) return;
        setVisualsByLookupName(visualMap);
        setGameChangers(gcSet);
      })
      .catch(() => {
        if (!active) return;
        // Mantém o painel funcional mesmo se o Scryfall falhar.
      });

    return () => {
      active = false;
    };
  }, [displayCards]);

  const filteredCards = useMemo(() => {
    const query = search.toLocaleLowerCase("pt-BR").trim();
    return displayCards
      .filter((card) => card.name.toLocaleLowerCase("pt-BR").includes(query))
      .sort((a, b) => {
        if (b.roundedScore !== a.roundedScore) return b.roundedScore - a.roundedScore;
        if (b.average !== a.average) return b.average - a.average;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [displayCards, search]);

  const groups = useMemo(() => {
    const map = new Map<number, typeof filteredCards>();
    for (const card of filteredCards) {
      const list = map.get(card.roundedScore) ?? [];
      list.push(card);
      map.set(card.roundedScore, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filteredCards]);

  return (
    <section className="card-ratings-panel" aria-labelledby="card-ratings-title">
      <div className="card-ratings-intro">
        <div className="card-ratings-heading">
          <div className="card-ratings-eyebrow">Votação da comunidade</div>
          <h2 id="card-ratings-title">Paiômetro</h2>
          <p>Cartas paias medidas em pontos de 0 a 10 pela comunidade.</p>
        </div>

        <div className="card-ratings-intro-actions">
          <a
            className="card-ratings-opinion"
            href={FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageSquarePlus size={17} /> Expresse sua opinião
          </a>

          <button
            className="card-ratings-refresh"
            type="button"
            disabled={loading || refreshing}
            onClick={() => window.dispatchEvent(new Event("mtg-refresh-card-ratings"))}
          >
            <RefreshCw size={17} className={refreshing ? "spin" : ""} /> Atualizar médias
          </button>
        </div>
      </div>

      {data?.stale ? (
        <p className="card-ratings-warning">Exibindo a última consulta disponível. Não foi possível obter uma atualização recente.</p>
      ) : null}

      {error ? <p className="card-ratings-warning" role="alert">{error}</p> : null}
      {loading && !data ? <p className="card-ratings-message">Carregando notas das cartas...</p> : null}

      {data ? (
        <>
          <div className="card-ratings-toolbar">
            <label className="card-ratings-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar carta pelo nome..."
                aria-label="Buscar carta pelo nome"
              />
            </label>
          </div>

          {groups.length ? (
            <div className="card-ratings-groups">
              {groups.map(([score, cards]) => (
                <section key={score} className="card-ratings-group" aria-labelledby={`group-${score}`}>
                  <div className="card-ratings-group-header">
                    <div>
                      <h3 id={`group-${score}`}>{score} {score === 1 ? "ponto" : "pontos"}</h3>
                      <p>{cards.length} {cards.length === 1 ? "carta" : "cartas"} nesta faixa</p>
                    </div>
                  </div>

                  <div className="card-ratings-grid">
                    {cards.map((card) => {
                      const visual = visualsByLookupName[normalizeNameKey(card.lookupName)];
                      const isGameChanger = !card.isConcept && gameChangers.has(normalizeNameKey(card.name));
                      const destination = card.destinationUrl || visual?.scryfallUrl || fallbackScryfallUrl(card.name);

                      return (
                        <a
                          key={card.key}
                          className={`card-ratings-scryfall-card${visual?.imageUrl ? " has-image" : " no-image"}`}
                          href={destination}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={card.name}
                        >
                          {visual?.imageUrl ? (
                            <img src={visual.imageUrl} alt={card.name} loading="lazy" />
                          ) : (
                            <div className="card-ratings-fallback-art">
                              <strong>{card.name}</strong>
                              <span>Imagem indisponível</span>
                            </div>
                          )}

                          {isGameChanger ? <span className="card-ratings-gc-badge">GC</span> : null}

                          <div className="card-ratings-card-meta">
                            <div className="card-ratings-card-name">
                              <strong>{card.name}</strong>
                              <ExternalLink size={13} aria-hidden="true" />
                            </div>
                            <div className="card-ratings-card-scores">
                              <span className="card-ratings-card-rounded">{card.roundedScore} pts</span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="card-ratings-message">Nenhuma carta corresponde à sua busca.</p>
          )}

          <p className="card-ratings-footnote">
            Cartas etiquetadas com <strong>GC</strong> fazem parte da lista <em>Game Changer</em> do Scryfall. As médias são atualizadas automaticamente a cada 5 minutos.
          </p>
        </>
      ) : null}
    </section>
  );
}
