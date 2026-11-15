import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X, ChevronRight, ArrowLeft } from "lucide-react";
import { fetchDeckPaioVisuals, readCachedPaioVisuals, paioScryfallSearchUrl, type PaioCardVisual } from "./deckPaioScryfall";
import { normalizePaioName } from "./paiometroDeck";
import { paioThresholds, normalizePaioKey, type PaioConfig, type PaioThreshold } from "./paioConfig";
import { buildPaioUsageIndex, cardUsage, comboUsage, familyMembers, familyUsage, thresholdUsage, type PaioUsageDeck, type PaioUsageMatch } from "./paioDeckUsage";
import "./paioUsageBrowser.css";

export type PaioBrowseItem = { name: string; lookupName: string; destinationUrl: string; roundedScore: number; isConcept: boolean };
type View<T extends PaioUsageDeck> =
  | { kind: "card"; name: string; points?: number; lookupName?: string }
  | { kind: "combo"; name: string; pair: string[] }
  | { kind: "family"; name: string; points: number; link: string }
  | { kind: "threshold"; name: string; points: number; rule: PaioThreshold }
  | { kind: "tagDeck"; name: string; rule: PaioThreshold; match: PaioUsageMatch<T> };

function Art({ name, visual, isGameChanger, onClick }: { name: string; visual?: PaioCardVisual; isGameChanger?: boolean; onClick?: () => void }) {
  const content = <>{visual?.imageUrl ? <img src={visual.imageUrl} alt={name} loading="lazy" decoding="async" /> : <span className="paio-usage-placeholder">{name}</span>}{isGameChanger ? <span className="paio-usage-gc" title="Game Changer">GC</span> : null}<span className="paio-usage-art-name">{name}</span></>;
  return onClick ? <button type="button" className="paio-usage-art" onClick={onClick} title={`Ver decks com ${name}`}>{content}</button>
    : <a className="paio-usage-art" href={visual?.scryfallUrl || paioScryfallSearchUrl(name)} target="_blank" rel="noopener noreferrer" title={`Abrir ${name} no Scryfall`}>{content}</a>;
}
function DeckRows<T extends PaioUsageDeck>({ matches, onSelect, showCount = false, countUnit = "carta" }: { matches: PaioUsageMatch<T>[]; onSelect: (match: PaioUsageMatch<T>) => void; showCount?: boolean; countUnit?: "carta" | "combo" }) {
  const [query, setQuery] = useState("");
  const filtered = matches.filter(({ deck }) => normalizePaioName(`${deck.displayName} ${deck.commander}`).includes(normalizePaioName(query)));
  return <div className="paio-usage-decks">
    {matches.length > 5 ? <input className="paio-usage-search" aria-label="Buscar deck" placeholder="Buscar deck ou comandante..." value={query} onChange={e => setQuery(e.target.value)} /> : null}
    {filtered.map(match => <button type="button" className="paio-usage-deck-row" key={match.deck.name} onClick={() => onSelect(match)}>
      {match.deck.imageUrl ? <img src={match.deck.imageUrl} alt="" loading="lazy" decoding="async" /> : <span className="paio-usage-deck-placeholder" />}
      <span className="paio-usage-deck-info"><strong>{match.deck.displayName}</strong><small>{match.deck.commander}{match.deck.inactive ? " · Inativo" : ""}</small></span>
      {showCount ? <span className="paio-usage-count">{match.count} {countUnit}{match.count === 1 ? "" : "s"}</span> : null}<ChevronRight size={18} aria-hidden="true" />
    </button>)}
    {!filtered.length ? <p className="paio-usage-muted">{matches.length ? "Nenhum deck corresponde à busca." : "Nenhum deck identificado nas listas cadastradas."}</p> : null}
  </div>;
}

function Layer({ title, active, canBack, onClose, children }: { title: string; active: boolean; canBack: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const lastScroll = useRef(0);
  useEffect(() => {
    if (!active) return;
    const el = dialog.current;
    if (!el) return;
    el.scrollTop = lastScroll.current;
    (lastFocus.current && el.contains(lastFocus.current) ? lastFocus.current : el.querySelector<HTMLElement>(".paio-usage-close"))?.focus({ preventScroll: true });
  }, [active]);
  return <div className="paio-usage-backdrop" style={{ display: active ? undefined : "none" }} inert={!active} aria-hidden={!active}
    onMouseDown={e => { if (active && e.target === e.currentTarget) onClose(); }}>
    <div ref={dialog} className="paio-usage-dialog" role="dialog" aria-modal={active} aria-label={title}
      onScroll={e => { if (active) lastScroll.current = e.currentTarget.scrollTop; }}
      onFocusCapture={e => { lastFocus.current = e.target as HTMLElement; }}
      onKeyDown={e => {
        if (e.key !== "Tab") return;
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }}>
      <header className="paio-usage-header"><div>{canBack ? <button type="button" className="paio-usage-back" onClick={onClose}><ArrowLeft size={16} /> Voltar</button> : null}<span className="paio-usage-eyebrow">PAIÔMETRO · EXPLORAR</span><h2>{title}</h2></div><button type="button" className="paio-usage-close" aria-label="Fechar modal" onClick={onClose}><X size={22} /></button></header>
      {children}
    </div>
  </div>;
}

export default function PaioUsageBrowser<T extends PaioUsageDeck>({ item, config, decks, loading, failed, suspended, gameChangers, onClose, onOpenDeck }: {
  item: PaioBrowseItem; config: PaioConfig; decks: T[]; loading: boolean; failed: boolean; suspended: boolean; gameChangers: Set<string>; onClose: () => void; onOpenDeck: (deck: T) => void;
}) {
  const [stack, setStack] = useState<View<T>[]>(() => {
    const rule = paioThresholds(config).find(r => normalizePaioKey(r.concept) === normalizePaioKey(item.name));
    return [rule ? { kind: "threshold", name: item.name, points: item.roundedScore, rule } : item.isConcept ? { kind: "family", name: item.name, points: item.roundedScore, link: item.destinationUrl } : { kind: "card", name: item.name, lookupName: item.lookupName, points: item.roundedScore }];
  });
  const [visuals, setVisuals] = useState<Record<string, PaioCardVisual>>({});
  const opener = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const index = useMemo(() => buildPaioUsageIndex(decks), [decks]);
  const top = stack[stack.length - 1];
  const close = () => { if (stack.length > 1) setStack(prev => prev.slice(0, -1)); else onClose(); };
  const openCard = (name: string) => setStack(prev => [...prev, { kind: "card", name }]);
  const openCombo = (pair: string[]) => setStack(prev => [...prev, { kind: "combo", name: pair.join(" + "), pair }]);
  const topNames = useMemo(() => top.kind === "card" ? [top.lookupName || top.name] : top.kind === "combo" ? top.pair : top.kind === "family" ? familyMembers(top.name, config).cards : top.kind === "tagDeck" ? top.match.cards : [], [top, config]);
  useEffect(() => {
    let active = true;
    if (!topNames.length) return;
    setVisuals(prev => ({ ...prev, ...readCachedPaioVisuals(topNames) }));
    void fetchDeckPaioVisuals(topNames).then(result => { if (active) setVisuals(prev => ({ ...prev, ...result })); }).catch(() => {});
    return () => { active = false; };
  }, [topNames]);
  useEffect(() => {
    if (suspended) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (stack.length > 1) setStack(prev => prev.slice(0,-1)); else onClose();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [stack.length, suspended, onClose]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); };
  }, []);
  const art = (name: string) => visuals[normalizePaioName(name)];
  const status = loading && !decks.length ? <p className="paio-usage-muted">Carregando decklists da liga...</p> : failed && !decks.length ? <p className="paio-usage-muted">Não foi possível carregar os decks. Tente atualizar o dashboard.</p> : null;
  return createPortal(<>{stack.map((view, i) => <Layer key={i} title={view.name} active={!suspended && i === stack.length - 1} canBack={i > 0} onClose={close}>
    {view.kind === "card" ? (() => {
      const matches = cardUsage(index, view.name);
      return <div className="paio-usage-card-layout"><div><Art name={view.name} visual={art(view.lookupName || view.name)} isGameChanger={gameChangers.has(normalizePaioName(view.name))} /> <a className="paio-usage-link" href={art(view.lookupName || view.name)?.scryfallUrl || paioScryfallSearchUrl(view.name)} target="_blank" rel="noopener noreferrer">Ver no Scryfall <ExternalLink size={15}/></a>{view.points !== undefined ? <p className="paio-usage-muted">{view.points} pontos no Paiômetro</p> : null}</div><div><h3>{matches.length} {matches.length === 1 ? "deck contém" : "decks contêm"} esta carta</h3>{status || <DeckRows matches={matches} onSelect={match => onOpenDeck(match.deck)} />}</div></div>;
    })() : view.kind === "combo" ? (() => {
      const matches = comboUsage(index, view.pair);
      return <><p className="paio-usage-muted">{matches.length} {matches.length === 1 ? "deck contém" : "decks contêm"} as duas cartas juntas. A pontuação do combo continua pertencendo à família.</p>
        <div className="paio-usage-grid paio-usage-combo-detail">{view.pair.map(name => <Art key={name} name={name} visual={art(name)} isGameChanger={gameChangers.has(normalizePaioName(name))} />)}</div>
        <h3>Decks com este combo</h3>{status || <DeckRows matches={matches} onSelect={match => onOpenDeck(match.deck)} />}</>;
    })() : view.kind === "family" ? (() => {
      const members = familyMembers(view.name, config);
      const matches = familyUsage(index, view.name, config);
      const isCombo = normalizePaioKey(view.name) === normalizePaioKey("Combos de Duas Cartas");
      return <><p className="paio-usage-muted">{view.points} pontos · {members.cards.length} cartas cadastradas nesta família. Clique em uma carta para ver os decks.</p><a className="paio-usage-link" href={view.link} target="_blank" rel="noopener noreferrer">Ver referência da família <ExternalLink size={15}/></a>
      {members.pairs.length ? <div className="paio-usage-grid paio-usage-pairs">{members.pairs.map(pair => <div className="paio-usage-pair" key={pair.map(normalizePaioName).sort().join("::")}><div>{pair.map(name => <Art key={name} name={name} visual={art(name)} isGameChanger={gameChangers.has(normalizePaioName(name))} onClick={() => openCard(name)} />)}</div><button type="button" className="paio-usage-pair-open" onClick={() => openCombo(pair)}><strong>{pair.join(" + ")}</strong><small>Ver decks com este combo <ChevronRight size={14}/></small></button></div>)}</div> : <div className="paio-usage-grid">{members.cards.map(name => <Art key={name} name={name} visual={art(name)} isGameChanger={gameChangers.has(normalizePaioName(name))} onClick={() => openCard(name)} />)}</div>}
      {!members.cards.length ? <p className="paio-usage-muted">Ainda não há cartas cadastradas nesta família. O administrador pode adicionar associações no Paiômetro.</p> : null}
      <section className="paio-usage-family-decks"><h3>{matches.length} {matches.length === 1 ? "deck" : "decks"} {isCombo ? "com combos completos" : "com cartas desta família"}</h3><p className="paio-usage-muted">{isCombo ? "Considera apenas pares completos." : "Inclui qualquer deck que contenha ao menos uma carta cadastrada na família."}</p>{status || <DeckRows matches={matches} showCount countUnit={isCombo ? "combo" : "carta"} onSelect={match => onOpenDeck(match.deck)} />}</section></>;
    })() : view.kind === "threshold" ? (() => {
      const rule = paioThresholds(config).find(r => normalizePaioKey(r.concept) === normalizePaioKey(view.name)) || view.rule;
      const matches = thresholdUsage(index, rule, config);
      return <><p className="paio-usage-muted">{view.points} pontos · mínimo de {rule.minimum} cartas · {matches.length} decks atingem o requisito.</p>{status || <DeckRows matches={matches} showCount onSelect={match => setStack(prev => [...prev, { kind: "tagDeck", name: match.deck.displayName, match, rule }])} />}</>;
    })() : <><p className="paio-usage-muted">{view.rule.concept} · {view.match.count} cartas da tag · mínimo de {view.rule.minimum}</p><button className="paio-usage-open-deck" type="button" onClick={() => onOpenDeck(view.match.deck)}>Abrir perfil do deck <ChevronRight size={18}/></button><div className="paio-usage-grid">{view.match.cards.map(name => <Art key={name} name={name} visual={art(name)} isGameChanger={gameChangers.has(normalizePaioName(name))} onClick={() => openCard(name)} />)}</div></>}
    <p className="paio-usage-footnote">Considera decklists em texto e comandantes cadastrados; decks excluídos e sideboards não entram na busca. Decks inativos são identificados na lista. Listas externas não importadas podem estar incompletas.</p>
  </Layer>)}</>, document.body);
}
