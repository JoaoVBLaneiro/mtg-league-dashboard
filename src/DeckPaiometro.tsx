import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { EMPTY_PAIO_CONFIG, fetchPaioConfig, catalogEntry, type PaioConfig } from "./paioConfig";
import {
  calculatePaio,
  fetchPaioRatings,
  normalizePaioName,
  parsePaioAssignments,
  type PaioItem,
  type PaioRating,
} from "./paiometroDeck";
import {
  fetchDeckPaioGameChangers,
  fetchDeckPaioVisuals,
  paioScryfallSearchUrl,
  paioVisualNames,
  type PaioCardVisual,
} from "./deckPaioScryfall";
import "./paiometroDeck.css";

type Props = {
  name: string;
  decklistTexto: string;
  paiometroConceitos: unknown;
  commander: string;
  secondaryCommander: string;
};

function paioTone(score: number) {
  // Zero: verde. Dez: vermelho suave. Acima de dez: vermelho intenso.
  const t = Math.min(1, score / 10);
  const hue = 140 - 130 * t;
  const light = score <= 10 ? 63 - 13 * t : Math.max(39, 50 - (score - 10) * 2);
  return {
    "--paio-tone": `hsl(${hue.toFixed(0)} 80% ${light.toFixed(0)}%)`,
    "--paio-tint": `hsla(${hue.toFixed(0)} 75% 40% / .28)`,
  } as CSSProperties;
}

function DeckPaioArtwork({
  cardName,
  visual,
  isGameChanger,
  loading,
}: {
  cardName: string;
  visual?: PaioCardVisual;
  isGameChanger: boolean;
  loading: boolean;
}) {
  return (
    <a
      className="paio-dialog-card-art-link"
      href={visual?.scryfallUrl ?? paioScryfallSearchUrl(cardName)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Ver ${cardName} no Scryfall`}
      aria-label={`Abrir ${cardName} no Scryfall (nova aba)`}
    >
      {visual?.imageUrl ? (
        <img src={visual.imageUrl} alt={cardName} loading="lazy" />
      ) : (
        <span className="paio-dialog-card-art-placeholder">
          <strong>{cardName}</strong>
          <small>{loading ? "Carregando arte..." : "Ver no Scryfall"}</small>
        </span>
      )}
      {isGameChanger ? <span className="paio-dialog-gc-badge">GC</span> : null}
    </a>
  );
}

function DeckPaioCard({
  item, visuals, gameChangers, loading, onOpenFamily, config,
}: {
  item: PaioItem;
  visuals: Record<string, PaioCardVisual>;
  gameChangers: Set<string>;
  loading: boolean;
  onOpenFamily: (item: PaioItem) => void;
  config: PaioConfig;
}) {
  const isCombo = Boolean(item.comboPairs?.length);
  const isFamily = item.origin !== "decklist";
  const names = item.matchedCards?.length
    ? item.matchedCards
    : item.origin === "manual" ? paioVisualNames(item.detail ?? "") : [item.name];
  // No deck, a arte da família deve vir primeiro de uma carta identificada nele.
  // A arte definida pelo admin só é usada quando nenhuma das cartas tem imagem.
  const candidates = [...names, catalogEntry(config, item.name)?.artCard ?? ""].filter(Boolean);
  const representative = candidates.find((cardName) => visuals[normalizePaioName(cardName)]?.imageUrl)
    ?? candidates[0] ?? item.name;
  const cardVisual = visuals[normalizePaioName(representative)];
  const familyLabel = isCombo
    ? `${item.comboPairs?.length} combos completos; +${item.points} uma única vez`
    : `${item.name}: ${names.length} ${names.length === 1 ? "carta" : "cartas"} (${item.instances ?? names.length} instâncias); +${item.points} uma única vez`;

  return (
    <article className="paio-dialog-art-card" title={isFamily ? familyLabel : `${item.name}: +${item.points}`}>
      {isCombo ? (
        <button type="button" className="paio-family-card-open paio-combo-family-cover" onClick={() => onOpenFamily(item)} aria-label="Abrir todos os combos">
          {item.comboPairs?.[0].map((cardName) => {
            const image = visuals[normalizePaioName(cardName)]?.imageUrl;
            return <span key={cardName}>{image ? <img src={image} alt={cardName} loading="lazy" /> : <span className="paio-dialog-card-art-placeholder">{cardName}</span>}</span>;
          })}
          <span className="paio-dialog-cycle-badge">{item.comboPairs?.length} {item.comboPairs?.length === 1 ? "combo" : "combos"}</span>
        </button>
      ) : isFamily ? (
        <button
          type="button"
          className="paio-family-card-open"
          onClick={() => onOpenFamily(item)}
          aria-label={`Abrir cartas de ${item.name}`}
        >
          {cardVisual?.imageUrl ? <img src={cardVisual.imageUrl} alt="" loading="lazy" /> : (
            <span className="paio-dialog-card-art-placeholder"><strong>{item.name}</strong><small>{loading ? "Carregando arte..." : "Ver cartas da família"}</small></span>
          )}
          <span className="paio-dialog-cycle-badge">{item.threshold ? `${item.instances ?? names.length}/${item.threshold} cartas` : `${names.length} ${names.length === 1 ? "carta" : "cartas"}`}</span>
        </button>
      ) : (
        <div className="paio-dialog-card-art">
          <DeckPaioArtwork
            cardName={item.name}
            visual={visuals[normalizePaioName(item.name)]}
            isGameChanger={gameChangers.has(normalizePaioName(item.name))}
            loading={loading}
          />
        </div>
      )}
      <div className="paio-dialog-art-gradient" aria-hidden="true" />
      <div className="paio-dialog-art-caption">
        <strong>{item.name}</strong>
        {isCombo ? <small>Família de combos · clique para ver todos os pares</small>
          : isFamily ? <small>Família · pontua uma única vez · clique para ver as cartas</small> : null}
        <div className="paio-dialog-art-bottom">
          <span className="paio-dialog-art-points">+{item.points} pts</span>
          <ExternalLink size={14} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function PaioFamilyModal({
  item, visuals, gameChangers, loading, onClose,
}: {
  item: PaioItem;
  visuals: Record<string, PaioCardVisual>;
  gameChangers: Set<string>;
  loading: boolean;
  onClose: () => void;
}) {
  const names = item.matchedCards?.length ? item.matchedCards : paioVisualNames(item.detail ?? "");
  return (
    <div className="paio-family-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="paio-family-dialog" role="dialog" aria-modal="true" aria-label={`Cartas de ${item.name}`}>
        <div className="paio-dialog-heading">
          <div>
            <span className="paio-dialog-kicker">FAMÍLIA · +{item.points} PONTOS</span>
            <h2>{item.name}</h2>
            <p>{item.comboPairs?.length
              ? `${item.comboPairs.length} ${item.comboPairs.length === 1 ? "combo completo" : "combos completos"} · a família pontua uma única vez`
              : `${names.length} ${names.length === 1 ? "carta identificada" : "cartas identificadas"} · ${item.instances ?? names.length} ${item.instances === 1 ? "instância" : "instâncias"} na decklist${item.threshold ? ` · mínimo ${item.threshold}` : ""}`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar família"><X size={20} /></button>
        </div>
        <div className="paio-dialog-art-grid paio-family-grid">
          {item.comboPairs?.length ? item.comboPairs.map((pair) => (
            <div className="paio-family-individual paio-family-combo" key={pair.map(normalizePaioName).sort().join("::")}>
              <div className="paio-family-combo-pair">
                {pair.map((name) => <DeckPaioArtwork key={name} cardName={name} visual={visuals[normalizePaioName(name)]} isGameChanger={gameChangers.has(normalizePaioName(name))} loading={loading} />)}
              </div>
              <strong>{pair.join(" + ")}</strong>
            </div>
          )) : names.map((name) => (
            <div className="paio-family-individual" key={name}>
              <DeckPaioArtwork
                cardName={name}
                visual={visuals[normalizePaioName(name)]}
                isGameChanger={gameChangers.has(normalizePaioName(name))}
                loading={loading}
              />
              <strong>{name}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DeckPaiometro({ name, decklistTexto, paiometroConceitos, commander, secondaryCommander }: Props) {
  const [ratings, setRatings] = useState<PaioRating[] | null>(null);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [visuals, setVisuals] = useState<Record<string, PaioCardVisual>>({});
  const [gameChangers, setGameChangers] = useState<Set<string>>(new Set());
  const [loadingArts, setLoadingArts] = useState(false);
  const [config, setConfig] = useState<PaioConfig>(EMPTY_PAIO_CONFIG);
  const [activeFamily, setActiveFamily] = useState<PaioItem | null>(null);
  const assignments = useMemo(() => parsePaioAssignments(paiometroConceitos), [paiometroConceitos]);

  useEffect(() => {
    let active = true;
    function load() {
      void fetchPaioRatings().then((data) => {
        if (active) { setRatings(data); setError(""); }
      }).catch(() => {
        if (active) setError("Não foi possível consultar os pontos agora.");
      });
    }
    load();
    const interval = window.setInterval(load, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    let active = true;
    const loadConfig = () => { void fetchPaioConfig().then((value) => { if (active) setConfig(value); }).catch(() => {}); };
    loadConfig();
    const interval = window.setInterval(loadConfig, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { if (activeFamily) setActiveFamily(null); else setIsOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, activeFamily]);

  const summary = useMemo(
    () => calculatePaio(decklistTexto, assignments, ratings ?? [], [commander, secondaryCommander], config),
    [decklistTexto, assignments, ratings, commander, secondaryCommander, config],
  );
  const known = ratings !== null && (summary.hasDecklist || summary.items.length > 0);

  const visualNames = useMemo(() => [...new Set(summary.items.flatMap((item) => [
    ...(item.matchedCards?.length ? item.matchedCards : item.origin === "manual" ? paioVisualNames(item.detail ?? "") : [item.name]),
    catalogEntry(config, item.name)?.artCard ?? "",
  ].filter(Boolean)))], [summary.items, config]);

  useEffect(() => {
    if (!isOpen || !visualNames.length) return;
    let active = true;
    setLoadingArts(true);
    void fetchDeckPaioVisuals(visualNames)
      .then((fetched) => { if (active) setVisuals(fetched); })
      .catch(() => { /* O modal mantém os links caso o Scryfall esteja indisponível. */ })
      .finally(() => { if (active) setLoadingArts(false); });
    void fetchDeckPaioGameChangers()
      .then((names) => { if (active) setGameChangers(names); })
      .catch(() => { /* Mantém o Paiômetro mesmo sem selos GC. */ });
    return () => { active = false; };
  }, [isOpen, visualNames]);


  return (
    <>
      <button
        type="button"
        className="deck-paio-box"
        style={known ? paioTone(summary.total) : ({ "--paio-tone": "#94a3b8", "--paio-tint": "rgba(71,85,105,.2)" } as CSSProperties)}
        onClick={() => setIsOpen(true)}
        title="Clique para ver quais cartas e conceitos somam pontos no Paiômetro"
      >
        <span>Paiômetro</span>
        <strong>{ratings ? (known ? `${summary.total} pts` : "—") : "..."}</strong>
        <small>{known ? `${summary.items.length} item${summary.items.length === 1 ? "" : "s"} pontuado${summary.items.length === 1 ? "" : "s"}` : "Ver detalhes"}</small>
      </button>

      {isOpen ? createPortal(
        <div className="paio-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
          <div className="paio-dialog paio-dialog-grid-modal" role="dialog" aria-modal="true" aria-labelledby="paio-dialog-title" style={paioTone(summary.total)}>
            <div className="paio-dialog-heading">
              <div><span className="paio-dialog-kicker">PAIÔMETRO</span><h2 id="paio-dialog-title">{name}</h2></div>
              <button type="button" aria-label="Fechar Paiômetro" onClick={() => setIsOpen(false)}><X size={22} /></button>
            </div>
            {error ? <p className="paio-dialog-error">{error}</p> : null}
            {ratings === null ? <p>Carregando pontuação...</p> : (
              <>
                <div className="paio-dialog-total"><strong>{known ? summary.total : "—"}</strong><span>pontos de paia</span></div>
                <p className="paio-dialog-guidance">Um deck saudável e pouco paia costuma ter até 10 pontos no Paiômetro.</p>
                {!summary.hasDecklist ? <p className="paio-dialog-warning">Este deck não tem decklist em texto cadastrada. O resultado é {summary.items.length ? "parcial: considera apenas comandantes identificados e atribuições manuais." : "indisponível até o cadastro da decklist."}</p> : null}
                {summary.items.length ? (
                  <section className="paio-dialog-groups" aria-label="Cartas e conceitos do deck">
                    <div className="paio-dialog-group-heading">
                      <h3>Cartas e conceitos</h3>
                      <small>{summary.items.length} {summary.items.length === 1 ? "ocorrência" : "ocorrências"} · ordenadas por pontos</small>
                    </div>
                    <div className="paio-dialog-art-grid">
                      {summary.items.map((entry, index) => <DeckPaioCard
                        key={`${entry.origin}:${entry.name}:${entry.detail ?? index}`}
                        item={entry}
                        visuals={visuals}
                        gameChangers={gameChangers}
                        loading={loadingArts}
                        config={config}
                        onOpenFamily={(item) => setActiveFamily(item)}
                      />)}
                    </div>
                  </section>
                ) : <p className="paio-dialog-empty">Nenhuma carta ou conceito pontuado foi encontrado.</p>}
                {activeFamily ? <PaioFamilyModal
                  item={activeFamily}
                  visuals={visuals}
                  gameChangers={gameChangers}
                  loading={loadingArts}
                  onClose={() => setActiveFamily(null)}
                /> : null}
                <small className="paio-dialog-footnote">Clique nas artes para abrir as cartas no Scryfall. Cada carta individual conta uma vez. Famílias, inclusive combos de duas cartas, pontuam uma única vez. Categorias por tags exigem o mínimo de cartas indicado. Clique numa família para conferir as artes. Médias arredondadas com .50 para baixo e acima de .50 para cima.</small>
              </>
            )}
          </div>
        </div>, document.body) : null}
    </>
  );
}
