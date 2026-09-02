// Fixture isolada do build. APIs simuladas; somente CSS/fontes Keyrune são externos.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PlayerEditorApp from '../src/PlayerEditor';
import '../src/index.css';

const session = {
  deckManagementVersion: 2,
  playerManagementVersion: 1,
  keyruneUsage: [{ playerId: 'Jogador Teste', displayName: 'Jogador Teste', keyruneClass: 'ss ss-stx ss-mythic ss-grad' },
    { playerId: 'Outro jogador', displayName: 'Outro jogador', keyruneClass: 'ss ss-lrw ss-mythic ss-grad' }],
  player: { id: 'Jogador Teste', fields: { 'Nome de Exibição': 'Jogador Teste', 'Ícone Keyrune': 'ss ss-stx ss-mythic ss-grad' } },
  decks: [],
  cloudinary: { cloudName: '', uploadPreset: '' },
  sessionSeconds: 21600,
};
const requests = new Map();
let count = 0;
localStorage.setItem('mtg-player-editor-session', 'fixture-local-sem-credenciais');
const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

window.fetch = async (input, init = {}) => {
  const url = new URL(String(input), location.href);
  if (url.hostname === 'cdn.jsdelivr.net') return new Response('.ss-stx:before {content:"x"} .ss-lrw:before {content:"y"}');
  if (url.hostname === 'api.scryfall.com') {
    const name = url.searchParams.get('fuzzy') || '';
    if (name.toLowerCase() === 'erro de busca') {
      return new Response(JSON.stringify({ details: 'Carta não encontrada (teste local).' }), { status: 404 });
    }
    const makeCard = (number) => {
      const color = ['#285c46', '#67437d', '#af6546', '#274777', '#576133'][number % 5];
      const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="335"><rect width="240" height="335" rx="14" fill="#141722"/><rect x="10" y="10" width="220" height="215" rx="8" fill="${color}"/><circle cx="120" cy="112" r="62" fill="#ffffff18"/><path d="M45 184 L102 70 L130 118 L160 83 L199 184 Z" fill="#ffffff40"/><text x="120" y="256" text-anchor="middle" fill="white" font-family="sans-serif" font-size="17">Edição ${number + 1}</text><text x="120" y="282" text-anchor="middle" fill="#aaaaaa" font-family="sans-serif" font-size="12">PRÉVIA FICTÍCIA</text></svg>`;
      return { id: `fixture-print-${number}`, oracle_id: '12345678-1234-1234-1234-123456789012', name: name || 'Carta de teste',
        image_uris: { large: `data:image/svg+xml,${encodeURIComponent(placeholder)}` },
        set: `t${number}`, set_name: ['Commander', 'Edição sem borda', 'Arte alternativa', 'Retro frame'][number % 4],
        collector_number: String(number + 1), lang: 'en', artist: 'Artista de teste', scryfall_uri: `https://scryfall.com/card/test/${number}` };
    };
    if (url.pathname === '/cards/search') {
      const next = url.searchParams.get('page') === '2';
      return reply({ data: Array.from({ length: next ? 4 : 8 }, (_, index) => makeCard(index + (next ? 8 : 0))),
        has_more: !next, next_page: next ? null : 'https://api.scryfall.com/cards/search?q=test&page=2' });
    }
    return reply(makeCard(0));
  }
  if (url.hostname !== 'script.google.com') throw new Error('Teste local: rede externa desativada.');
  if (init.method === 'POST') {
    const payload = JSON.parse(init.body);
    if (payload.action === 'editorUpdateProfile') {
      session.player.fields = { ...session.player.fields, ...payload.fields };
      session.keyruneUsage[0].keyruneClass = payload.fields['Ícone Keyrune'] || '';
      return reply({ ok: true });
    }
    if (payload.action === 'editorCreatePlayer') {
      if (!requests.has(payload.requestId)) {
        if (session.keyruneUsage.some(player => player.playerId === payload.playerName)) {
          requests.set(payload.requestId, { ok: false, status: 'error', error: 'Nome já cadastrado (teste local).' });
        } else {
          session.keyruneUsage.push({ playerId: payload.playerName, displayName: payload.displayName || payload.playerName, keyruneClass: payload.keyruneClass });
          requests.set(payload.requestId, { ok: true, status: 'complete', playerId: payload.playerName, warnings: [] });
        }
      }
      return reply({});
    }
    if (['editorUpdateDeck', 'editorDeleteDeck'].includes(payload.action)) {
      const deck = session.decks.find(deck => deck.id === payload.deckId);
      if (!deck || (payload.action === 'editorDeleteDeck' && payload.confirmDeckName !== deck.id)) {
        requests.set(payload.requestId, { ok: false, status: 'error', error: 'Deck/confirmacão inválido (teste local).' });
      } else {
        if (payload.action === 'editorDeleteDeck') session.decks = session.decks.filter(deck => deck.id !== payload.deckId);
        else deck.fields = { ...deck.fields, ...payload.fields };
        requests.set(payload.requestId, { ok: true, status: 'complete', deckId: payload.deckId, warnings: [] });
      }
      await new Promise(resolve => setTimeout(resolve, 350));
      return reply({});
    }
    if (payload.action !== 'editorCreateDeck') throw new Error('Teste local: ação não simulada.');
    if (payload.deckName === 'Erro de teste') {
      requests.set(payload.requestId, { ok: false, status: 'error', error: 'Erro fictício: escolha outro nome.' });
    } else if (!requests.get(payload.requestId)?.deckId) {
      session.decks.push({ id: payload.deckName, fields: payload.fields });
      requests.set(payload.requestId, {
        ok: true, status: 'complete', deckId: payload.deckName,
        warnings: payload.deckName === 'Aviso de teste' ? ['Aviso fictício: cache pendente.'] : [],
      });
      count++;
      document.getElementById('qa-status').textContent = `Cadastros: ${count}`;
    }
    await new Promise(resolve => setTimeout(resolve, 350));
    return reply({});
  }
  if (url.searchParams.get('action') === 'editorSession') return reply({ ok: true, data: session });
  if (['editorCreateDeckStatus', 'editorDeckMutationStatus', 'editorCreatePlayerStatus'].includes(url.searchParams.get('action'))) {
    return reply(requests.get(url.searchParams.get('requestId')) || { ok: true, status: 'pending' });
  }
  return reply({ catalog: {
    players: session.keyruneUsage.map(player => ({ jogador: player.playerId })),
    decks: [{ deck: 'Dragões - Outro jogador' }, ...session.decks.map(deck => ({ deck: deck.id }))],
  } });
};

createRoot(document.getElementById('root')).render(<PlayerEditorApp />);
