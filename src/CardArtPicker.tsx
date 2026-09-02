import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { findCardPrintings, type CardPrinting, type CardPrintingsPage } from "./editorScryfall";
import "./cardArtPicker.css";

export default function CardArtPicker({ cardName, currentImage, onSelect, onClose }: {
  cardName: string;
  currentImage: string;
  onSelect: (printing: CardPrinting) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const pageInFlight = useRef(false);
  const [page, setPage] = useState<CardPrintingsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    findCardPrintings(cardName).then((result) => {
      if (active) setPage(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as artes.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [cardName, retry]);

  async function loadMore() {
    if (!page?.nextPage || pageInFlight.current) return;
    pageInFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await findCardPrintings(page.cardName, page.nextPage);
      if (!mounted.current) return;
      setPage((current) => current ? {
        ...result,
        printings: [...new Map([...current.printings, ...result.printings].map((card) => [card.id, card])).values()],
      } : result);
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : "Não foi possível carregar mais artes.");
    } finally {
      pageInFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="editor-art-dialog" aria-labelledby={titleId}
      aria-describedby={`${titleId}-description`}
      onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <header className="editor-art-heading">
        <div><span>EDIÇÕES DO SCRYFALL</span><h2 id={titleId}>{page?.cardName || cardName}</h2></div>
        <button type="button" className="editor-art-close" autoFocus onClick={onClose} aria-label="Fechar escolha de arte"><X size={22} /></button>
      </header>
      <p id={`${titleId}-description`} className="editor-art-description">Clique na edição que você quer exibir. A escolha só será gravada ao salvar ou criar o deck. Cartas dupla face exibem a frente.</p>
      <div className="editor-art-results" aria-busy={loading}>
        <div className="editor-art-grid">
          {page?.printings.map((card) => {
            const selected = currentImage === card.imageUrl || currentImage === card.thumbnailUrl;
            return <button type="button" key={card.id} className={`editor-art-option${selected ? " selected" : ""}`}
              aria-pressed={selected} aria-label={`Escolher ${card.setName}, ${card.setCode.toUpperCase()} #${card.collectorNumber}, ${card.language.toUpperCase()}${card.artist ? `, arte de ${card.artist}` : ""}`}
              onClick={() => onSelect(card)}>
              <span className="editor-art-image"><img src={card.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                {selected ? <span className="editor-art-selected"><Check size={14} /> Atual</span> : null}
              </span>
              <strong>{card.setName}</strong>
              <span className="editor-art-edition">{card.setCode.toUpperCase()} · #{card.collectorNumber} · {card.language.toUpperCase()}</span>
              {card.artist ? <span className="editor-art-artist">{card.artist}</span> : null}
            </button>;
          })}
        </div>
        {!loading && page && !page.printings.length ? <p className="editor-art-message">Nenhuma imagem disponível nesta página.</p> : null}
        {loading ? <p className="editor-art-message" role="status"><LoaderCircle size={19} className="spin" /> Carregando edições…</p> : null}
        {error ? <p className="editor-art-error" role="alert">{error}</p> : null}
        {!page && error ? <button type="button" className="editor-art-more" disabled={loading} onClick={() => {
          setLoading(true); setError(""); setRetry((value) => value + 1);
        }}><RefreshCw size={16} /> Tentar novamente</button> : null}
        {page?.nextPage ? <button type="button" className="editor-art-more" disabled={loading} onClick={() => void loadMore()}>
          {loading ? "Carregando…" : error ? "Tentar carregar mais edições" : "Carregar mais edições"}
        </button> : null}
      </div>
      <footer className="editor-art-footer">Artes carregadas diretamente do Scryfall — sem upload para o servidor da liga.</footer>
    </dialog>
  );
}
