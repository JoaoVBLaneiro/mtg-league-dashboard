import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, ExternalLink, MessageSquarePlus, X } from "lucide-react";
import { EMPTY_PAIO_CONFIG, fetchPaioConfig, catalogEntry, type PaioConfig } from "./paioConfig";
import { calculatePaio, fetchPaioRatings, normalizePaioName, parsePaioAssignments, type PaioRating } from "./paiometroDeck";
import { fetchDeckPaioVisuals, readCachedPaioVisuals, paioScryfallSearchUrl, type PaioCardVisual } from "./deckPaioScryfall";
import "./playerPaiometro.css";

/** Usa sempre o ID do jogador quando disponível; nome de exibição é apenas fallback legado. */
type PaioAuthor = { jogador?: string; nome?: string } | null;
export type PlayerPaioDeck = {
  name: string;
  displayName?: string;
  imageUrl?: string;
  commander?: string;
  secondaryCommander?: string;
  decklistTexto?: string;
  paiometroConceitos?: unknown;
  autor?: PaioAuthor;
  inactive?: boolean;
  deleted?: boolean;
};

type PlayerPaioProps<T extends PlayerPaioDeck> = {
  player: { name: string; displayName?: string };
  decks: T[];
  onSelectDeck: (deck: T) => void;
  isTopProfile?: boolean;
};

type Frequency = {
  key: string;
  label: string;
  count: number;
  points: number;
  exampleCards: string[];
  representative: string;
  isFamily: boolean;
  /** Preserva as cartas e os pares concretos de cada deck, não apenas a união da família. */
  occurrences: Array<{ deckId: string; points: number; cards: string[]; comboPairs: string[][] }>;
};

function tone(score: number | null): CSSProperties {
  if (score === null) {
    return { "--paio-tone": "#94a3b8", "--paio-tint": "rgba(71,85,105,.2)" } as CSSProperties;
  }
  const t = Math.min(1, score / 10);
  const hue = 140 - 130 * t;
  const light = score <= 10 ? 63 - 13 * t : Math.max(39, 50 - (score - 10) * 2);
  return {
    "--paio-tone": `hsl(${hue.toFixed(0)} 80% ${light.toFixed(0)}%)`,
    "--paio-tint": `hsla(${hue.toFixed(0)} 75% 40% / .28)`,
  } as CSSProperties;
}

const fmt = (number: number) => number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PlayerPaiometro<T extends PlayerPaioDeck>({
  player, decks, onSelectDeck, isTopProfile = true,
}: PlayerPaioProps<T>) {
  const [ratings, setRatings] = useState<PaioRating[] | null>(null);
  const [config, setConfig] = useState<PaioConfig>(EMPTY_PAIO_CONFIG);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedFrequencyKey, setSelectedFrequencyKey] = useState<string | null>(null);
  const [visuals, setVisuals] = useState<Record<string, PaioCardVisual>>({});

  useEffect(() => {
    let alive = true;
    const load = () => {
      void fetchPaioRatings()
        .then((result) => { if (alive) { setRatings(result); setError(""); } })
        .catch(() => { if (alive) setError("Não foi possível consultar as pontuações."); });
      void fetchPaioConfig()
        .then((result) => { if (alive) setConfig(result); })
        .catch(() => { if (alive) setError("Não foi possível atualizar as categorias."); });
    };
    load();
    const interval = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const ownedDecks = useMemo(() => {
    const id = normalizePaioName(player.name);
    const label = normalizePaioName(player.displayName || player.name);
    return decks.filter((deck) => {
      if (deck.inactive || deck.deleted || !deck.autor) return false;
      // Não substitui uma referência de ID por um nome de exibição potencialmente ambíguo.
      if (deck.autor.jogador?.trim()) return normalizePaioName(deck.autor.jogador) === id;
      const oldName = normalizePaioName(deck.autor.nome || "");
      return oldName === id || oldName === label;
    });
  }, [decks, player.name, player.displayName]);

  const rows = useMemo(() => ownedDecks.map((deck) => {
    const summary = calculatePaio(
      deck.decklistTexto || "",
      parsePaioAssignments(deck.paiometroConceitos),
      ratings || [],
      [deck.commander || "", deck.secondaryCommander || ""],
      config,
    );
    return { deck, summary, full: summary.hasDecklist, positive: summary.items.filter((item) => item.points > 0) };
  }).sort((a, b) => b.summary.total - a.summary.total ||
    (a.deck.displayName || a.deck.name).localeCompare(b.deck.displayName || b.deck.name, "pt-BR")),
  [ownedDecks, ratings, config]);

  const complete = useMemo(() => rows.filter((row) => row.full), [rows]);
  // Um deck sem decklist não pode ser apresentado como zero nem contaminar a média.
  const average = ratings && complete.length
    ? complete.reduce((sum, row) => sum + row.summary.total, 0) / complete.length
    : null;

  const frequencies = useMemo<Frequency[]>(() => {
    const found = new Map<string, Frequency>();
    for (const { positive, full, deck } of rows) {
      if (!full) continue;
      const seen = new Set<string>();
      for (const item of positive) {
        const key = normalizePaioName(item.name);
        if (seen.has(key)) continue;
        seen.add(key);
        const existing = found.get(key);
        const occurrence = {
          deckId: deck.name,
          points: item.points,
          cards: (item.matchedCards?.length ? item.matchedCards : item.origin === "decklist" ? [item.name] : [])
            .filter(Boolean),
          comboPairs: (item.comboPairs || []).filter((pair) => pair.length === 2),
        };
        if (existing) {
          existing.occurrences.push(occurrence);
          existing.count += 1;
          existing.points += item.points;
          for (const card of item.matchedCards || []) {
            if (!existing.exampleCards.some((old) => normalizePaioName(old) === normalizePaioName(card)))
              existing.exampleCards.push(card);
          }
        } else {
          found.set(key, {
            key, label: item.name, count: 1, points: item.points,
            exampleCards: [...(item.matchedCards || [])],
            representative: item.name,
            isFamily: item.origin !== "decklist",
            occurrences: [occurrence],
          });
        }
      }
    }
    const frequencies = [...found.values()].sort((a, b) =>
      b.count - a.count || b.points - a.points || a.label.localeCompare(b.label, "pt-BR"));
    for (const entry of frequencies) {
      const art = catalogEntry(config, entry.label)?.artCard;
      entry.representative = entry.isFamily
        ? entry.exampleCards[0] || art || entry.label
        : entry.label;
    }
    return frequencies;
  }, [rows, config]);

  const previewNames = useMemo(() => [...new Set(frequencies.slice(0, 16)
    .map((entry) => entry.representative).filter(Boolean))], [frequencies]);

  const selectedFrequency = useMemo(() =>
    frequencies.find((entry) => entry.key === selectedFrequencyKey) || null,
  [frequencies, selectedFrequencyKey]);

  const ownedById = useMemo(() => new Map(ownedDecks.map((deck) => [deck.name, deck])), [ownedDecks]);

  // Cada carta é relacionada somente aos decks em que foi registrada nesta família.
  // A contagem é por deck, não pela quantidade de cópias da carta.
  const detailCards = useMemo(() => {
    if (!selectedFrequency) return [];
    const found = new Map<string, { name: string; deckIds: string[] }>();
    for (const entry of selectedFrequency.occurrences) {
      for (const name of entry.cards) {
        const key = normalizePaioName(name);
        if (!key) continue;
        const card = found.get(key);
        if (card) {
          if (!card.deckIds.includes(entry.deckId)) card.deckIds.push(entry.deckId);
        } else {
          found.set(key, { name, deckIds: [entry.deckId] });
        }
      }
    }
    return [...found.values()].sort((a, b) => b.deckIds.length - a.deckIds.length ||
      a.name.localeCompare(b.name, "pt-BR"));
  }, [selectedFrequency]);

  // Para combos, a associação é com o PAR COMPLETO, nunca com uma carta isolada.
  const detailPairs = useMemo(() => {
    if (!selectedFrequency) return [];
    const pairs = new Map<string, { cards: string[]; deckIds: string[] }>();
    for (const entry of selectedFrequency.occurrences) {
      for (const names of entry.comboPairs) {
        const key = names.map(normalizePaioName).sort().join("::");
        if (!key) continue;
        const pair = pairs.get(key);
        if (pair) {
          if (!pair.deckIds.includes(entry.deckId)) pair.deckIds.push(entry.deckId);
        } else {
          pairs.set(key, { cards: names, deckIds: [entry.deckId] });
        }
      }
    }
    return [...pairs.values()].sort((a, b) => b.deckIds.length - a.deckIds.length ||
      a.cards.join(" + ").localeCompare(b.cards.join(" + "), "pt-BR"));
  }, [selectedFrequency]);

  const selectedVisualNames = useMemo(() => {
    if (!selectedFrequency) return [];
    return [...new Set([
      selectedFrequency.representative,
      ...detailCards.map((card) => card.name),
      ...detailPairs.flatMap((pair) => pair.cards),
    ].filter(Boolean))];
  }, [selectedFrequency, detailCards, detailPairs]);

  useEffect(() => {
    if (!open || !isTopProfile) return;
    const names = [...new Set([...previewNames, ...selectedVisualNames])];
    if (!names.length) return;
    let alive = true;
    setVisuals((current) => ({ ...current, ...readCachedPaioVisuals(names) }));
    void fetchDeckPaioVisuals(names)
      .then((fetched) => { if (alive) setVisuals((current) => ({ ...current, ...fetched })); })
      .catch(() => { /* Exibe nomes e mantém links mesmo sem arte. */ });
    return () => { alive = false; };
  }, [open, isTopProfile, previewNames, selectedVisualNames]);

  useEffect(() => {
    if (!open || !isTopProfile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (selectedFrequencyKey) setSelectedFrequencyKey(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, isTopProfile, selectedFrequencyKey]);

  const playerName = player.displayName || player.name;
  return (
    <>
      <button type="button" className="deck-paio-box player-paio-box" style={tone(average)}
        onClick={() => setOpen(true)} title={`Ver a média do Paiômetro dos decks ativos de ${playerName}`}>
        <span>Paiômetro</span>
        <strong>{ratings ? (average !== null ? `${fmt(average)} pts` : "—") : "..."}</strong>
        <small>{complete.length} {complete.length === 1 ? "deck ativo avaliado" : "decks ativos avaliados"}</small>
      </button>
      {open ? createPortal(
        <div className="paio-dialog-backdrop player-paio-backdrop"
          style={{ display: isTopProfile ? undefined : "none" }} aria-hidden={!isTopProfile}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="paio-dialog player-paio-modal" role="dialog" aria-modal={isTopProfile}
            aria-label={`Paiômetro de ${playerName}`} style={tone(average)}>
            <div className="paio-dialog-heading">
              <div><span className="paio-dialog-kicker">PAIÔMETRO DO JOGADOR</span><h2>{playerName}</h2></div>
              <div className="player-paio-modal-actions">
                <a className="paio-dialog-opinion" href="https://forms.gle/sLXPYiA46CgXTVhk6"
                  target="_blank" rel="noopener noreferrer"><MessageSquarePlus size={16} /> Expresse sua opinião</a>
                <button type="button" aria-label="Fechar Paiômetro" onClick={() => setOpen(false)}><X size={22} /></button>
              </div>
            </div>
            {error && <p className="paio-dialog-error">{error}</p>}
            <div className="player-paio-hero">
              <div className="paio-dialog-total"><strong>{average === null ? "—" : fmt(average)}</strong><span>média de pontos de paia</span></div>
              <p>{complete.length} {complete.length === 1 ? "deck ativo com decklist" : "decks ativos com decklist"} na média
                {rows.length !== complete.length ? ` · ${rows.length - complete.length} sem decklist completa` : ""}</p>
            </div>
            <section className="player-paio-section">
              <div className="player-paio-section-head"><h3>Decks de autoria</h3><span>{rows.length} ativos</span></div>
              {rows.length ? (
                <div className="player-paio-decks">
                  {rows.map(({ deck, summary, full }) => (
                    <button type="button" key={deck.name} className="player-paio-deck"
                      onClick={() => onSelectDeck(deck)} title={`Abrir perfil de ${deck.displayName || deck.name}`}>
                      {deck.imageUrl ? <img src={deck.imageUrl} alt="" loading="lazy" decoding="async" />
                        : <span className="player-paio-deck-placeholder">MTG</span>}
                      <span className="player-paio-deck-main"><strong>{deck.displayName || deck.name}</strong>
                        <small>{deck.commander || "Deck cadastrado"}{!full ? " · pontuação parcial" : ""}</small></span>
                      <span className="player-paio-deck-points" style={tone(full ? summary.total : null)}>
                        {full ? `${summary.total} pts` : "Parcial"}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="paio-dialog-empty">Este jogador não possui decks ativos cadastrados como autor.</p>}
            </section>
            <section className="player-paio-section">
              <div className="player-paio-section-head"><h3>Cartas e famílias mais utilizadas</h3>
                <span>por quantidade de decks</span></div>
              {frequencies.length ? (
                <div className="player-paio-frequencies">
                  {frequencies.slice(0, 16).map((entry, index) => {
                    const visual = visuals[normalizePaioName(entry.representative)];
                    return <button type="button" className="player-paio-frequency player-paio-frequency-button"
                      key={entry.key} onClick={() => setSelectedFrequencyKey(entry.key)}
                      aria-haspopup="dialog" aria-label={`Explorar ${entry.label} em ${entry.count} decks`}>
                      <span className="player-paio-position">#{index + 1}</span>
                      <span className="player-paio-art">
                        {visual?.imageUrl ? <img src={visual.imageUrl} alt="" loading="lazy" decoding="async" />
                          : <span>{entry.isFamily ? "Família" : "Carta"}</span>}
                      </span>
                      <span className="player-paio-frequency-main"><strong>{entry.label}</strong>
                        <small>{entry.isFamily ? "Família ou categoria" : "Carta individual"}</small>
                        {entry.exampleCards.length ? <small title={entry.exampleCards.join(", ")}>{entry.exampleCards.slice(0, 3).join(" · ")}{entry.exampleCards.length > 3 ? "…" : ""}</small> : null}
                      </span>
                      <span className="player-paio-frequency-count"><strong>{entry.count}</strong>
                        <small>{entry.count === 1 ? "deck" : "decks"}</small></span>
                      <ChevronRight size={17} className="player-paio-frequency-chevron" aria-hidden="true" />
                    </button>;
                  })}
                </div>
              ) : <p className="paio-dialog-empty">Nenhuma carta ou categoria com pontuação positiva foi encontrada.</p>}
              <small className="paio-dialog-footnote">Cada carta/família conta uma vez por deck, mesmo que tenha várias cópias. Combos contam como família adicional. Itens com 0 ponto são ocultados aqui e nos decks, mas permanecem na aba geral do Paiômetro.</small>
            </section>
          </div>
          {selectedFrequency ? (
            <div className="player-paio-detail-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedFrequencyKey(null);
            }}>
              <div className="paio-dialog player-paio-detail-modal" role="dialog" aria-modal="true"
                aria-label={`Detalhes de ${selectedFrequency.label}`}>
                <div className="player-paio-detail-heading">
                  <button type="button" className="player-paio-detail-back"
                    onClick={() => setSelectedFrequencyKey(null)}><ArrowLeft size={17} /> Voltar</button>
                  <button type="button" className="player-paio-detail-close" aria-label="Fechar detalhes"
                    onClick={() => setSelectedFrequencyKey(null)}><X size={22} /></button>
                </div>
                <span className="paio-dialog-kicker">PAIÔMETRO DO JOGADOR · EXPLORAR</span>
                <h2>{selectedFrequency.label}</h2>
                <p className="player-paio-detail-subtitle">{selectedFrequency.count} {selectedFrequency.count === 1 ? "deck contém" : "decks contêm"}
                  {selectedFrequency.isFamily ? " esta família ou categoria" : " esta carta"}.</p>

                {detailPairs.length ? (
                  <section className="player-paio-detail-section">
                    <h3>Combos completos encontrados</h3>
                    <div className="player-paio-detail-pairs">
                      {detailPairs.map((pair) => (
                        <div className="player-paio-detail-pair" key={pair.cards.map(normalizePaioName).sort().join("::")}>
                          <div className="player-paio-detail-pair-cards">
                            {pair.cards.map((name) => {
                              const visual = visuals[normalizePaioName(name)];
                              return <a key={normalizePaioName(name)} href={visual?.scryfallUrl || paioScryfallSearchUrl(name)}
                                target="_blank" rel="noopener noreferrer" title={`Ver ${name} no Scryfall`}>
                                {visual?.imageUrl ? <img src={visual.imageUrl} alt="" loading="lazy" decoding="async" /> : null}
                                <span>{name} <ExternalLink size={12} aria-hidden="true" /></span>
                              </a>;
                            })}
                          </div>
                          <div className="player-paio-detail-deck-links">
                            {pair.deckIds.map((id) => {
                              const deck = ownedById.get(id);
                              return deck ? <button type="button" key={id} onClick={() => onSelectDeck(deck)}>
                                {deck.displayName || deck.name} <ChevronRight size={13} /></button> : null;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {detailCards.length ? (
                  <section className="player-paio-detail-section">
                    <h3>{selectedFrequency.isFamily ? "Cartas desta categoria" : "Carta encontrada"}</h3>
                    <div className="player-paio-detail-cards">
                      {detailCards.map((card) => {
                        const visual = visuals[normalizePaioName(card.name)];
                        return <div className="player-paio-detail-card" key={normalizePaioName(card.name)}>
                          <a className="player-paio-detail-art" href={visual?.scryfallUrl || paioScryfallSearchUrl(card.name)}
                            title={`Ver ${card.name} no Scryfall`} target="_blank" rel="noopener noreferrer">
                            {visual?.imageUrl ? <img src={visual.imageUrl} alt="" loading="lazy" decoding="async" /> : <span>MTG</span>}
                          </a>
                          <div className="player-paio-detail-card-content">
                            <a href={visual?.scryfallUrl || paioScryfallSearchUrl(card.name)}
                              target="_blank" rel="noopener noreferrer">{card.name} <ExternalLink size={12} aria-hidden="true" /></a>
                            <small>{card.deckIds.length} {card.deckIds.length === 1 ? "deck" : "decks"}</small>
                            <div className="player-paio-detail-deck-links">
                              {card.deckIds.map((id) => {
                                const deck = ownedById.get(id);
                                return deck ? <button type="button" key={id} onClick={() => onSelectDeck(deck)}>
                                  {deck.displayName || deck.name} <ChevronRight size={13} /></button> : null;
                              })}
                            </div>
                          </div>
                        </div>;
                      })}
                    </div>
                  </section>
                ) : <p className="paio-dialog-empty">Esta categoria não possui nomes de cartas detalhados no cadastro.</p>}

                <section className="player-paio-detail-section">
                  <h3>Decks deste jogador que pontuam</h3>
                  <div className="player-paio-detail-decks">
                    {selectedFrequency.occurrences.map((occurrence) => {
                      const deck = ownedById.get(occurrence.deckId);
                      if (!deck) return null;
                      return <button type="button" key={occurrence.deckId} className="player-paio-detail-deck"
                        onClick={() => onSelectDeck(deck)}>
                        {deck.imageUrl ? <img src={deck.imageUrl} alt="" loading="lazy" decoding="async" /> : null}
                        <span><strong>{deck.displayName || deck.name}</strong>
                          <small>{occurrence.comboPairs.length ? occurrence.comboPairs.map((pair) => pair.join(" + ")).join(" · ")
                            : occurrence.cards.join(" · ") || "Classificado nesta categoria"}</small></span>
                        <b>+{occurrence.points} pts</b><ChevronRight size={18} aria-hidden="true" />
                      </button>;
                    })}
                  </div>
                </section>
                <small className="paio-dialog-footnote">As cartas são agrupadas por deck. Cada família pontua somente uma vez por deck, mesmo com várias cartas da categoria. Cartas com vínculo manual seguem o cadastro do Paiômetro.</small>
              </div>
            </div>
          ) : null}
        </div>, document.body) : null}
    </>
  );
}
