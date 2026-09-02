// Respostas fictícias: nenhuma requisição à API real ou alteração na planilha.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findCardOnScryfall, findCardPrintings } from '../src/editorScryfall.ts';

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

const oracle = '12345678-1234-1234-1234-123456789012';
const printing = (id, extra = {}) => ({ id, name: 'Meren of Clan Nel Toth', oracle_id: oracle,
  image_uris: { large: `https://cards.scryfall.io/large/${id}.jpg`, normal: `https://cards.scryfall.io/normal/${id}.jpg` },
  scryfall_uri: `https://scryfall.com/card/c15/${id}`, set: 'c15', set_name: 'Commander 2015',
  collector_number: '49', lang: 'en', artist: 'Artista de teste', ...extra });

test('galeria resolve o nome e busca edições da mesma carta por oracleid, sem limitar variantes', async () => {
  const requests = [];
  const fetchCard = async url => {
    requests.push(new URL(url));
    return respond(requests.length === 1 ? printing('original') : { data: [printing('original'), printing('borderless')] })();
  };
  const page = await findCardPrintings('Meren', null, fetchCard);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get('q'), `oracleid:${oracle}`);
  assert.equal(requests[1].searchParams.get('unique'), 'prints');
  assert.equal(requests[1].searchParams.get('order'), 'released');
  assert.equal(page.cardName, 'Meren of Clan Nel Toth');
  assert.equal(page.printings.length, 2);
  assert.equal(page.printings[1].imageUrl, 'https://cards.scryfall.io/large/borderless.jpg');
  assert.equal(page.printings[1].scryfallUrl, 'https://scryfall.com/card/c15/borderless');
  assert.equal(page.printings[1].setName, 'Commander 2015');
  assert.equal(page.printings[1].artist, 'Artista de teste');
  assert.equal(page.nextPage, null);
});

test('edição dupla face usa frente; entradas sem imagem são omitidas', async () => {
  const page = await findCardPrintings('Frente // Verso', 'https://api.scryfall.com/cards/search?page=2', respond({ data: [
    printing('dupla', { image_uris: undefined, card_faces: [{ image_uris: { normal: 'https://example.com/frente.jpg' } },
      { image_uris: { large: 'https://example.com/verso.jpg' } }] }),
    printing('sem-imagem', { image_uris: undefined }),
  ] }));
  assert.equal(page.printings.length, 1);
  assert.equal(page.printings[0].imageUrl, 'https://example.com/frente.jpg');
});

test('paginação carrega somente a página solicitada; não resolve o nome novamente', async () => {
  const nextPage = 'https://api.scryfall.com/cards/search?q=oracleid%3Ateste&page=2';
  let count = 0;
  const fetchCard = async url => {
    count++;
    assert.equal(String(url), nextPage);
    return respond({ data: [printing('pagina2')], has_more: true, next_page: nextPage.replace('page=2', 'page=3') })();
  };
  const page = await findCardPrintings('Meren', nextPage, fetchCard);
  assert.equal(count, 1);
  assert.equal(page.printings[0].id, 'pagina2');
  assert.match(page.nextPage, /page=3$/);
});

test('nome exato sem oracleid é escapado, sem injetar filtros ou parâmetros', async () => {
  const name = 'A "Carta" & Outra';
  await findCardPrintings(name, null, async url => {
    const parsed = new URL(url);
    if (parsed.pathname === '/cards/named') return respond({ name })();
    assert.equal(parsed.searchParams.get('q'), '!"A \\"Carta\\" & Outra"');
    assert.equal(parsed.searchParams.size, 4);
    return respond({ data: [] })();
  });
});

test('buscas repetidas e simultâneas reaproveitam dados públicos e não multiplicam chamadas', async () => {
  let count = 0;
  const fetchCard = async url => {
    count++;
    return respond(new URL(url).pathname === '/cards/named' ? printing('card') : { data: [printing('card')] })();
  };
  const [first, second] = await Promise.all([findCardPrintings('Meren', null, fetchCard), findCardPrintings('Meren', null, fetchCard)]);
  await findCardPrintings('Meren', null, fetchCard);
  await findCardOnScryfall('Meren', fetchCard);
  assert.equal(count, 2);
  assert.deepEqual(first, second);
});

test('erro temporário não entra no cache e permite nova tentativa', async () => {
  let count = 0;
  const fetchCard = async () => {
    count++;
    return respond(count === 1 ? { details: 'Indisponível' } : { data: [printing('ok')] }, count === 1 ? 503 : 200)();
  };
  const url = 'https://api.scryfall.com/cards/search?page=2';
  await assert.rejects(findCardPrintings('Meren', url, fetchCard), /Indisponível/);
  assert.equal((await findCardPrintings('Meren', url, fetchCard)).printings.length, 1);
});

test('limite do Scryfall e resposta malformada apresentam erros claros', async () => {
  const url = 'https://api.scryfall.com/cards/search?page=2';
  await assert.rejects(findCardPrintings('Meren', url, respond({}, 429)), /muitas consultas/);
  await assert.rejects(findCardPrintings('Meren', url, respond({ data: {} })), /ler as edições/);
});

test('paginação não aceita domínio externo, protocolo inseguro ou outro endpoint', async () => {
  for (const url of ['https://example.com/cards/search', 'http://api.scryfall.com/cards/search', 'https://api.scryfall.com/other']) {
    await assert.rejects(findCardPrintings('Meren', url, () => { assert.fail('Não deveria consultar'); }), /página de edições inválida/);
  }
});
