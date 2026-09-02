// Respostas fictícias: nenhuma requisição à API real ou alteração na planilha.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findCardOnScryfall } from '../src/editorScryfall.ts';

const respond = (card, status = 200) => async () => new Response(JSON.stringify(card), { status });

test('nome e imagem oficiais usam a mesma busca fuzzy existente', async () => {
  let requested;
  const card = await findCardOnScryfall('  Meren  ', async url => {
    requested = new URL(url);
    return respond({ name: 'Meren of Clan Nel Toth', image_uris: { large: 'https://example.com/meren.jpg' },
      scryfall_uri: 'https://example.com/card/meren' })();
  });
  assert.equal(requested.origin, 'https://api.scryfall.com');
  assert.equal(requested.pathname, '/cards/named');
  assert.equal(requested.searchParams.get('fuzzy'), 'Meren');
  assert.deepEqual(card, { name: 'Meren of Clan Nel Toth', imageUrl: 'https://example.com/meren.jpg',
    scryfallUrl: 'https://example.com/card/meren' });
});

test('codifica nomes com pontuação sem alterar parâmetros da consulta', async () => {
  await findCardOnScryfall('Nome & Parte // Outra?', async url => {
    const parameters = new URL(url).searchParams;
    assert.equal(parameters.size, 1);
    assert.equal(parameters.get('fuzzy'), 'Nome & Parte // Outra?');
    return respond({ name: 'Nome completo' })();
  });
});

test('cartas dupla face usam a imagem da primeira face', async () => {
  const card = await findCardOnScryfall('Comandante dupla face', respond({ name: 'Frente // Verso',
    card_faces: [{ image_uris: { large: 'https://example.com/front.jpg' } },
      { image_uris: { large: 'https://example.com/back.jpg' } }] }));
  assert.equal(card.imageUrl, 'https://example.com/front.jpg');
});

test('imagem normal serve de alternativa à imagem grande', async () => {
  const card = await findCardOnScryfall('Comandante', respond({ image_uris: { normal: 'https://example.com/normal.jpg' } }));
  assert.equal(card.imageUrl, 'https://example.com/normal.jpg');
  const face = await findCardOnScryfall('Dupla face', respond({ card_faces: [{ image_uris: { normal: 'https://example.com/face.jpg' } }] }));
  assert.equal(face.imageUrl, 'https://example.com/face.jpg');
});

test('entrada vazia não faz requisição', async () => {
  let count = 0;
  await assert.rejects(findCardOnScryfall('   ', async () => { count++; }), /nome da carta/);
  assert.equal(count, 0);
});

test('carta não encontrada ou nome ambíguo retorna erro sem dados para aplicar', async () => {
  await assert.rejects(findCardOnScryfall('Nome', respond({ details: 'Nome ambíguo.' }, 404)), /Nome ambíguo/);
  await assert.rejects(findCardOnScryfall('Nome', respond({}, 404)), /não encontrada/);
});

test('falha de rede é propagada para o aviso do campo', async () => {
  await assert.rejects(findCardOnScryfall('Nome', async () => { throw new Error('Sem conexão'); }), /Sem conexão/);
});

test('resposta sem foto ou link não inventa URLs', async () => {
  const card = await findCardOnScryfall(' Comandante ', respond({}));
  assert.deepEqual(card, { name: 'Comandante', imageUrl: '', scryfallUrl: '' });
});
