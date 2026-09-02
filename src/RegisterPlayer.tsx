import { useRef, useState } from 'react';
import { CheckCircle2, Copy, LoaderCircle, UserPlus } from 'lucide-react';
import { getNewDeckNameError, normalizeDeckName } from './editorDecks';
import KeyrunePicker from './KeyrunePicker';
import { type KeyruneUsage } from './keyruneSymbols';

export type PlayerRegistrationInput = {
  requestId: string; playerName: string; displayName: string; initialPin: string; keyruneClass: string;
};
export type PlayerRegistrationResult = { playerId: string; warnings?: string[] };

export default function RegisterPlayer({ enabled, usage, onRegister }: {
  enabled: boolean; usage: KeyruneUsage[];
  onRegister: (input: PlayerRegistrationInput) => Promise<PlayerRegistrationResult>;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [icon, setIcon] = useState('ss ss-cmd ss-mythic ss-grad');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<(PlayerRegistrationResult & { pin: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const request = useRef<{ id: string; pin: string } | null>(null);
  const inFlight = useRef(false);

  async function submit() {
    if (!enabled || inFlight.current || created) return;
    const validation = getNewDeckNameError(name, []).replace(/deck/g, 'jogador');
    if (validation) { setError(validation); return; }
    if (!request.current) {
      const random = crypto.getRandomValues(new Uint32Array(1))[0];
      request.current = { id: crypto.randomUUID(), pin: String(random % 1000000).padStart(6, '0') };
    }
    const current = request.current;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await onRegister({ requestId: current.id, playerName: normalizeDeckName(name),
        displayName: displayName.trim(), initialPin: current.pin, keyruneClass: icon });
      setCreated({ ...result, pin: current.pin });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <div>
    <div className="editor-page-heading"><div><span>Novos participantes</span><h1>Cadastrar jogador</h1>
      <p>Somente jogadores já registrados podem cadastrar novos participantes.</p></div></div>
    {!enabled ? <p className="editor-notice editor-notice-info">Publique o Apps Script atualizado e entre novamente para habilitar o cadastro.</p> : null}
    {created ? <div className="editor-form-section">
      <h2><CheckCircle2 size={24} /> {created.playerId} cadastrado!</h2>
      <p>Compartilhe este PIN somente com o novo jogador. Ele poderá alterá-lo em Acesso.</p>
      <div className="editor-registration-pin"><span>PIN inicial</span><strong>{created.pin}</strong>
        <button type="button" className="editor-secondary-button" onClick={async () => {
          try { await navigator.clipboard.writeText(created.pin); setCopied(true); }
          catch { setError('Não foi possível copiar. Selecione e copie o PIN manualmente.'); }
        }}><Copy size={16} /> {copied ? 'Copiado' : 'Copiar PIN'}</button></div>
      <p className="editor-field-hint">Anote antes de sair ou recarregar esta página. A administração também encontra o PIN na planilha.</p>
      {created.warnings?.map(warning => <p className="editor-notice editor-notice-info" key={warning}>{warning}</p>)}
      <button type="button" className="editor-primary-button" onClick={() => {
        setCreated(null); setName(''); setDisplayName(''); setIcon('ss ss-cmd ss-mythic ss-grad');
        setCopied(false); setError(''); request.current = null;
      }}>Cadastrar outro jogador</button>
    </div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset className="editor-deck-editor" disabled={!enabled || busy}>
        <div className="editor-form-section"><div className="editor-form-grid">
          <label className="editor-field"><span>Nome do jogador *</span><input value={name} required minLength={2} maxLength={80}
            onChange={event => setName(event.target.value)} placeholder="Nome único usado no histórico" /></label>
          <label className="editor-field"><span>Nome de exibição</span><input value={displayName} maxLength={100}
            onChange={event => setDisplayName(event.target.value)} placeholder="Opcional — apelido no site" /></label>
          <KeyrunePicker label="Símbolo do novo jogador" value={icon} usage={usage} onChange={setIcon} disabled={!enabled || busy} />
        </div>
        <p className="editor-field-hint">O identificador não poderá ser renomeado aqui. Um PIN inicial de seis dígitos será gerado ao cadastrar. Não reutilize o nome de outra pessoa.</p>
        <button type="submit" className="editor-primary-button">{busy ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}
          {busy ? 'Cadastrando…' : 'Cadastrar jogador'}</button>
        </div>
      </fieldset>
    </form>}
    {error ? <p role="alert" className="editor-notice editor-notice-error">{error}</p> : null}
  </div>;
}
