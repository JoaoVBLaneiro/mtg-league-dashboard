import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Layers, Save } from 'lucide-react';
import './manualAchievementDeckLinks.css';

const URL = 'https://api.corneliomove.com.br/mtg-api/api/achievements/manual/deck-links';
const LABELS: Record<string, string> = {
  full_drip: 'Drip Completo',
  worth_more_than_cardboard: 'Vale Mais que Papelão',
  beginner_precon: 'Iniciante',
};

type Deck = {
  id: number;
  name: string;
  legacyName: string;
  commander: string;
  imageUrl: string;
  inactive: boolean;
};
type LinkedResponse = { ok: boolean; error?: string; decks: Deck[]; links: Record<string, number[]> };
type AchievementStatus = { id: string; name: string; unlocked: boolean };

async function getLinks(playerId: string, signal?: AbortSignal): Promise<LinkedResponse> {
  const response = await fetch(`${URL}?player=${encodeURIComponent(playerId)}`, { signal, cache: 'no-store' });
  const result = await response.json() as LinkedResponse;
  if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível carregar os decks associados.');
  return result;
}

export function ManualAchievementDeckEditor({ playerId, achievements }: {
  playerId: string;
  achievements: AchievementStatus[];
}) {
  const [data, setData] = useState<LinkedResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const available = useMemo(() => achievements.filter(a => LABELS[a.id] && a.unlocked), [achievements]);

  useEffect(() => {
    const controller = new AbortController();
    setData(null); setDraft({}); setNotice(''); setError('');
    if (!playerId || !available.length) return () => controller.abort();
    void getLinks(playerId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setData(result);
      setDraft(result.links);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao consultar associações.'); });
    return () => controller.abort();
  }, [playerId, available.map(a => a.id).join('|')]);

  function toggle(id: string, deckId: number) {
    setDraft(old => {
      const selected = old[id] || [];
      return { ...old, [id]: selected.includes(deckId)
        ? selected.filter(value => value !== deckId)
        : [...selected, deckId] };
    });
    setNotice(''); setError('');
  }

  async function save(id: string) {
    if (!data) return;
    setSaving(id); setError(''); setNotice('');
    try {
      const deckIds = draft[id] || [];
      const response = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: playerId, achievementId: id, deckIds }),
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'Falha ao salvar associação.');
      setData(current => current ? { ...current, links: { ...current.links, [id]: [...deckIds] } } : current);
      setNotice(`${LABELS[id]}: ${deckIds.length} deck(s) associado(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally { setSaving(null); }
  }

  return <section className="pina-manual-deck-links">
    <div className="pina-manual-deck-links-heading">
      <Layers size={21} aria-hidden="true" />
      <div><h3>Decks das conquistas</h3><p>Associe manualmente seus decks às conquistas já desbloqueadas. Isso não altera a pontuação.</p></div>
    </div>
    {!available.length && <p>Desbloqueie Drip Completo, Vale Mais que Papelão ou Iniciante para associar decks.</p>}
    {available.length > 0 && !data && !error && <p>Carregando seus decks...</p>}
    {error && <p className="pina-manual-deck-error" role="alert">{error}</p>}
    {notice && <p className="pina-manual-deck-success" role="status">{notice}</p>}
    {data && available.map(achievement => {
      const selected = draft[achievement.id] || [];
      const saved = data.links[achievement.id] || [];
      const changed = selected.length !== saved.length || selected.some(id => !saved.includes(id));
      return <details className="pina-manual-deck-entry" key={achievement.id}>
        <summary><ChevronDown size={17} /><strong>{achievement.name || LABELS[achievement.id]}</strong><span>{selected.length} deck(s) selecionado(s)</span></summary>
        <div className="pina-manual-deck-grid">
          {data.decks.map(deck => <label className={`pina-manual-deck-choice${selected.includes(deck.id) ? ' chosen' : ''}`} key={deck.id}>
            <input type="checkbox" checked={selected.includes(deck.id)} onChange={() => toggle(achievement.id, deck.id)} />
            {deck.imageUrl ? <img src={deck.imageUrl} alt="" loading="lazy" /> : <span className="pina-manual-deck-placeholder"><Layers size={22} /></span>}
            <span><strong>{deck.name}</strong><small>{deck.commander}{deck.inactive ? ' · Inativo' : ''}</small></span>
            {selected.includes(deck.id) && <Check size={18} />}
          </label>)}
        </div>
        <button className="pina-manual-deck-save" type="button" disabled={!changed || saving !== null} onClick={() => void save(achievement.id)}>
          <Save size={16} /> {saving === achievement.id ? 'Salvando...' : 'Salvar decks associados'}
        </button>
      </details>;
    })}
  </section>;
}

export function ManualAchievementDeckEvidence({ playerId, achievementId, onDeckClick }: {
  playerId: string;
  achievementId: string;
  onDeckClick: (deckName: string) => void;
}) {
  const [data, setData] = useState<LinkedResponse | null>(null);
  useEffect(() => {
    if (!playerId || !LABELS[achievementId]) return;
    const controller = new AbortController();
    void getLinks(playerId, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(() => {});
    return () => controller.abort();
  }, [playerId, achievementId]);
  if (!LABELS[achievementId] || !data) return null;
  const ids = new Set(data.links[achievementId] || []);
  const decks = data.decks.filter(deck => ids.has(deck.id));
  if (!decks.length) return null;
  return <section className="achievement-details-evidence pina-manual-linked-evidence">
    <div className="achievement-details-evidence-header"><strong>Decks associados</strong><span>Escolhidos manualmente pelo jogador · {decks.length} deck(s)</span></div>
    <div className="pina-manual-linked-grid">
      {decks.map(deck => <button type="button" className="pina-manual-linked-card" onClick={() => onDeckClick(deck.legacyName)} key={deck.id}>
        {deck.imageUrl ? <img src={deck.imageUrl} alt="" loading="lazy" /> : <span className="pina-manual-deck-placeholder"><Layers size={24} /></span>}
        <span><strong>{deck.name}</strong><small>{deck.commander || 'Ver perfil do deck'}{deck.inactive ? ' · Inativo' : ''}</small></span>
      </button>)}
    </div>
  </section>;
}
