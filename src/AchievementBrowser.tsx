import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Check, Copy, LockKeyhole, Users, X } from 'lucide-react';
import { ACHIEVEMENT_TIERS, TIER_LABELS, achievementHolders, filterManualAchievements, manualAchievementView,
  type AchievementDirectory, type ManualAchievementView } from './achievementDirectory';
import './achievementBrowser.css';

export function AchievementDialog({ label, children, onClose, wide = false }: {
  label: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className={`achievement-native-dialog${wide ? ' achievement-native-dialog-wide' : ''}`}
    aria-label={label}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    {children}
  </dialog>;
}

export function AchievementHolders({ directory, achievementId }: { directory?: AchievementDirectory; achievementId: string }) {
  const holders = achievementHolders(directory, achievementId);
  return <details className="achievement-holders" key={achievementId}>
    <summary><Users size={17} aria-hidden="true" /> Ver jogadores que possuem {directory ? `(${holders.length})` : ''}</summary>
    {!directory ? <p>Esta consulta precisa do Apps Script atualizado e de um novo cache do dashboard.</p> : <>
      <p>Desbloqueada em qualquer raridade. Liga inteira, sem filtro de período.</p>
      {holders.length ? <ul>{holders.map(({ player, achievement }) => <li key={player.id}>
        {player.photoUrl ? <img src={player.photoUrl} alt="" loading="lazy" /> : <Users size={26} aria-hidden="true" />}
        <span><strong>{player.displayName || player.id}</strong>{player.displayName !== player.id ? <small>{player.id}</small> : null}</span>
        {player.keyruneClass ? <i className={player.keyruneClass} aria-hidden="true" /> : null}
        <span className={`achievement-tier-chip achievement-tier-${achievement.tier}`}>{TIER_LABELS[achievement.tier]}</span>
      </li>)}</ul> : <p>Nenhum jogador possui esta conquista no momento.</p>}
    </>}
  </details>;
}

function CopyAchievementId({ id }: { id: string }) {
  const [message, setMessage] = useState('');
  return <div className="manual-achievement-id"><code>{id}</code><button type="button" title="Copiar ID interno"
    aria-label={`Copiar ID ${id}`} onClick={async () => {
      try { await navigator.clipboard.writeText(id); setMessage('ID copiado'); }
      catch { setMessage('Selecione o ID ao lado e copie manualmente.'); }
    }}><Copy size={15} aria-hidden="true" /></button><small role="status">{message}</small></div>;
}

export function ManualAchievementCatalog({ directory, initialPlayerId = '', onClose, onAchievementClick }: {
  directory?: AchievementDirectory; initialPlayerId?: string; onClose: () => void;
  onAchievementClick: (achievement: ManualAchievementView) => void;
}) {
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'owned' | 'missing'>('all');
  const headingId = useId();
  const player = directory?.players.find(item => item.id === playerId);
  const catalog = directory?.manualCatalog || [];
  const visible = filterManualAchievements(catalog, query, player ? status : 'all', player);
  const ownedCount = catalog.filter(item => manualAchievementView(item, player).unlocked).length;
  return <AchievementDialog label="Catálogo de conquistas manuais" onClose={onClose} wide>
    <section className="manual-achievement-catalog" aria-labelledby={headingId}>
      <button type="button" className="achievement-browser-close" onClick={onClose} aria-label="Fechar catálogo"><X size={22} /></button>
      <h2 id={headingId}><BookOpen size={25} aria-hidden="true" /> Conquistas manuais</h2>
      <p>Condições e IDs para consulta. As concessões continuam sendo registradas pela administração na aba <code>CONQUISTAS_MANUAIS</code>.</p>
      {!directory ? <p role="status">Publique o Apps Script atualizado e execute updateDashboardCache para carregar o catálogo completo.</p> : <>
        <div className="manual-achievement-controls">
          <label>Jogador<select value={playerId} onChange={event => { setPlayerId(event.target.value); setStatus('all'); }}>
            <option value="">Escolha para comparar</option>
            {directory.players.map(item => <option key={item.id} value={item.id}>{item.displayName}{item.displayName !== item.id ? ` (${item.id})` : ''}</option>)}
          </select></label>
          <label>Buscar<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, condição ou ID interno" /></label>
          <label>Exibir<select value={player ? status : 'all'} disabled={!player}
            onChange={event => setStatus(event.target.value as typeof status)}>
            <option value="all">Todas</option><option value="owned">Desbloqueadas</option><option value="missing">Pendentes</option>
          </select></label>
        </div>
        <p role="status">{visible.length} de {catalog.length} conquistas{player ? ` · ${player.displayName}: ${ownedCount} desbloqueadas` : ' · selecione um jogador para ver seu progresso'}</p>
        <div className="manual-achievement-grid">{visible.map(template => {
          const item = manualAchievementView(template, player);
          return <article className={`manual-achievement-card${player && item.unlocked ? ' is-owned' : ''}`} key={template.id}>
            <h3>{template.name}</h3>
            {player ? <span className="manual-achievement-status">{item.unlocked ? <Check size={16} /> : <LockKeyhole size={16} />}
              {item.unlocked ? `Desbloqueada · ${TIER_LABELS[item.tier]}` : 'Pendente'} · {item.value} registro(s)</span> : null}
            <p>{template.description}</p>
            <div className="manual-achievement-thresholds" aria-label="Requisitos por raridade">
              {ACHIEVEMENT_TIERS.filter(tier => Number(template.thresholds[tier]) > 0).map(tier =>
                <span className={`achievement-tier-chip achievement-tier-${tier}`} key={tier}>{TIER_LABELS[tier]}: {template.thresholds[tier]}</span>)}
            </div>
            <CopyAchievementId id={template.id} />
            <button className="achievement-browser-button" type="button" onClick={() => onAchievementClick(item)}>Ver detalhes e jogadores</button>
          </article>;
        })}</div>
        {!visible.length ? <p>Nenhuma conquista corresponde aos filtros.</p> : null}
      </>}
    </section>
  </AchievementDialog>;
}
