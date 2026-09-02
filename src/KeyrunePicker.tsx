import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { KEYRUNE_SYMBOLS, keyruneCode, loadKeyruneSymbols, mythicKeyrune, symbolUsers, type KeyruneSymbol, type KeyruneUsage } from './keyruneSymbols';
import './cardArtPicker.css';
import './keyrunePicker.css';

function KeyruneGallery({ value, usage, playerId, onSelect, onClose }: {
  value: string; usage: KeyruneUsage[]; playerId: string;
  onSelect: (value: string, symbol?: KeyruneSymbol) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState<KeyruneSymbol[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    let active = true;
    loadKeyruneSymbols().then(symbols => { if (active) setExtra(symbols); })
      .catch(() => { if (active) setNotice('Exibindo o catálogo incluído no site. Não foi possível carregar os símbolos adicionais.'); });
    return () => { active = false; };
  }, []);
  const symbols = useMemo(() => {
    const codes = [keyruneCode(value), ...usage.map(item => keyruneCode(item.keyruneClass))].filter(Boolean);
    const list = new Map([...codes.map(code => ({ code, name: `Set ${code.toUpperCase()}` })), ...KEYRUNE_SYMBOLS, ...extra].map(item => [item.code, item]));
    const search = query.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return [...list.values()].filter(item => `${item.name} ${item.code}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [extra, query, usage, value]);
  return <dialog ref={dialog} className="editor-art-dialog keyrune-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <header className="editor-art-heading"><div><span>KEYRUNE · MÍTICO</span><h2 id={titleId}>Escolha seu símbolo</h2></div>
      <button className="editor-art-close" type="button" onClick={onClose} aria-label="Fechar símbolos"><X size={22} /></button></header>
    <p className="editor-art-description">Todos usam o acabamento Mítico. Símbolos em uso são sinalizados, mas podem ser compartilhados.</p>
    <label className="keyrune-search"><Search size={18} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome ou código do set" aria-label="Buscar símbolo" /></label>
    {notice ? <p className="editor-art-description" role="status">{notice}</p> : null}
    <div className="keyrune-grid">
      {symbols.map(symbol => {
        const users = symbolUsers(symbol.code, usage);
        const selected = keyruneCode(value) === symbol.code;
        const owners = users.map(user => user.playerId === playerId ? 'Você' : user.displayName || user.playerId).join(', ');
        return <button type="button" key={symbol.code} className={`keyrune-option${selected ? ' selected' : ''}`} aria-pressed={selected}
          aria-label={`${symbol.name} (${symbol.code.toUpperCase()})${owners ? ` — em uso por ${owners}` : ''}`}
          onClick={() => { onSelect(mythicKeyrune(`ss-${symbol.code}`), symbol); onClose(); }}>
          <i className={mythicKeyrune(`ss-${symbol.code}`)} aria-hidden="true" />
          <strong>{symbol.name}</strong><small>{symbol.code.toUpperCase()}</small>
          {selected ? <span className="keyrune-selected"><Check size={13} /> Selecionado</span> : null}
          {owners ? <span className="keyrune-used">Em uso: {owners}</span> : null}
        </button>;
      })}
      {!symbols.length ? <p>Nenhum símbolo encontrado.</p> : null}
    </div>
  </dialog>;
}

export default function KeyrunePicker({ label, value, usage = [], playerId = '', disabled = false, onChange }: {
  label: string; value: string; usage?: KeyruneUsage[]; playerId?: string; disabled?: boolean;
  onChange: (value: string, symbol?: KeyruneSymbol) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = KEYRUNE_SYMBOLS.find(item => item.code === keyruneCode(value));
  return <div className="editor-field keyrune-field"><span>{label}</span>
    <div className="keyrune-field-controls">
      {value ? <i className={mythicKeyrune(value)} aria-hidden="true" /> : <span className="keyrune-empty">—</span>}
      <div><strong>{current?.name || keyruneCode(value).toUpperCase() || 'Nenhum símbolo'}</strong>
        <small>Acabamento Mítico</small></div>
      <button type="button" className="editor-secondary-button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>Escolher símbolo</button>
      {value ? <button type="button" className="keyrune-clear" disabled={disabled} onClick={() => onChange('')} aria-label={`Remover ${label}`}>×</button> : null}
    </div>
    {open ? <KeyruneGallery value={value} usage={usage} playerId={playerId} onSelect={onChange} onClose={() => setOpen(false)} /> : null}
  </div>;
}
