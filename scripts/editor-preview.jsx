// Fixture isolada do build. Respostas fictícias e CSP bloqueando serviços externos.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PlayerEditorApp from '../src/PlayerEditor';
import '../src/index.css';

const session = {
  deckManagementVersion: 1,
  player: { id: 'Jogador Teste', fields: { 'Nome de Exibição': 'Jogador Teste' } },
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
  if (url.hostname === 'api.scryfall.com') {
    const name = url.searchParams.get('fuzzy') || '';
    if (name.toLowerCase() === 'erro de busca') {
      return new Response(JSON.stringify({ details: 'Carta não encontrada (teste local).' }), { status: 404 });
    }
    const placeholder = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#153b2d"/><text x="100" y="140" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20">Carta de teste</text></svg>';
    return reply({ name: `${name} (teste local)`, image_uris: { large: `data:image/svg+xml,${encodeURIComponent(placeholder)}` } });
  }
  if (url.hostname !== 'script.google.com') throw new Error('Teste local: rede externa desativada.');
  if (init.method === 'POST') {
    const payload = JSON.parse(init.body);
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
  if (['editorCreateDeckStatus', 'editorDeckMutationStatus'].includes(url.searchParams.get('action'))) {
    return reply(requests.get(url.searchParams.get('requestId')) || { ok: true, status: 'pending' });
  }
  return reply({ catalog: {
    players: [{ jogador: 'Jogador Teste' }],
    decks: [{ deck: 'Dragões - Outro jogador' }, ...session.decks.map(deck => ({ deck: deck.id }))],
  } });
};

createRoot(document.getElementById('root')).render(<PlayerEditorApp />);
