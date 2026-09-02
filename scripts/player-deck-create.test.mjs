// Testes locais: nenhuma chamada ao Google, Cloudinary ou à planilha real.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { getNewDeckNameError } from '../src/editorDecks.ts';
import { DECK_CATEGORIES, decksInCategory, getDeckBackgroundImage, getDeckDisplayImage, isAvailableDeck, readDeckCategories, toggleDeckCategory } from '../src/deckMetadata.ts';
import { keyruneCode, mythicKeyrune, parseKeyruneCss, symbolUsers, KEYRUNE_SYMBOLS } from '../src/keyruneSymbols.ts';

const backend = readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8');

class Sheet {
  constructor(rows = []) {
    this.rows = rows.map(row => [...row]);
    this.maxColumns = Math.max(1, ...rows.map(row => row.length));
    this.appended = [];
  }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  getMaxColumns() { return this.maxColumns; }
  insertColumnsAfter(after, count) {
    assert.equal(after, this.maxColumns);
    this.maxColumns += count;
  }
  getRange(row, col, height = 1, width = 1) {
    assert.ok(col + width - 1 <= this.maxColumns, 'Coluna deve existir antes da escrita');
    const range = {
      getValues: () => Array.from({ length: height }, (_, r) =>
        Array.from({ length: width }, (_, c) => this.rows[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: value => {
        while (this.rows.length < row) this.rows.push([]);
        this.rows[row - 1][col - 1] = value;
        return range;
      },
      setNumberFormat: () => range,
    };
    range.getDisplayValues = () => range.getValues().map(values => values.map(String));
    return range;
  }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(row) {
    this.appended.push([...row]);
    // Sheets remove o apóstrofo de escape e guarda o restante como texto literal.
    this.rows.push(row.map(value => typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value));
  }
  records() {
    return this.rows.slice(1).map(row => Object.fromEntries(this.rows[0].map((header, i) => [header, row[i] ?? ''])));
  }
}

function harness(options = {}) {
  const sheets = new Map([
    ['JOGADORES', new Sheet([
      ['Jogador', 'Nome de Exibição', 'PIN de Edição'],
      ['Alice', 'Alice Teste', '123456'], ['Bob', 'Bob Teste', '654321'],
    ])],
    ['DECKS_INFO', new Sheet([
      ['Deck', 'Autor', 'Origem', 'Comandante'],
      ...(options.decks || []),
    ])],
  ]);
  const values = new Map();
  const calls = { form: 0, cache: 0 };
  const lock = {
    held: false,
    tryLock() {
      if (options.lockUnavailable || this.held) return false;
      this.held = true;
      return true;
    },
    releaseLock() { assert.ok(this.held); this.held = false; },
  };
  const cache = {
    get: key => values.get(key) ?? null,
    put(key, value) { assert.ok(key.length <= 250); values.set(key, value); },
    remove: key => values.delete(key),
  };
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets.get(name) }), flush() {} },
    CacheService: { getScriptCache: () => cache },
    Utilities: { getUuid: randomUUID },
    LockService: { getScriptLock: () => lock },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Logger: { log() {} },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; },
    },
  });
  vm.runInContext(backend, ctx);
  ctx.syncDeckFeedbackForm = () => {
    assert.equal(lock.held, false, 'Sincronização ocorre fora do lock de criação');
    calls.form++;
    if (options.formError) throw new Error('Falha fictícia no Forms');
  };
  ctx.updateDashboardCache = () => {
    assert.equal(lock.held, false, 'Atualização do cache pode obter seu próprio lock');
    calls.cache++;
    if (options.cacheError) throw new Error('Falha fictícia no cache');
  };
  const aliceToken = ctx.createPlayerEditorSession('Alice');
  const bobToken = ctx.createPlayerEditorSession('Bob');
  const create = (overrides = {}) => {
    const payload = {
      action: 'editorCreateDeck', token: aliceToken, requestId: randomUUID(),
      deckName: 'Meren - Alice', fields: { Comandante: 'Meren of Clan Nel Toth' }, ...overrides,
    };
    return { payload, result: JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text) };
  };
  const status = (payload, token = payload.token) => JSON.parse(ctx.doGet({ parameter: {
    action: 'editorCreateDeckStatus', token, requestId: payload.requestId,
  } }).text);
  const mutate = (overrides = {}) => {
    const payload = { action: 'editorUpdateDeck', requestId: randomUUID(), token: aliceToken,
      deckId: 'Meren - Alice', fields: {}, ...overrides };
    return { payload, result: JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text) };
  };
  const mutationStatus = (payload, token = payload.token) => JSON.parse(ctx.doGet({ parameter: {
    action: 'editorDeckMutationStatus', token, requestId: payload.requestId,
  } }).text);
  return { ctx, sheets, values, calls, aliceToken, bobToken, create, status, mutate, mutationStatus, lock,
    decks: sheets.get('DECKS_INFO') };
}

function registerPlayer(h, overrides = {}) {
  const payload = { action: 'editorCreatePlayer', token: h.aliceToken, requestId: randomUUID(),
    playerName: 'Carla', displayName: 'Carlinha', initialPin: '001234', keyruneClass: 'ss ss-lrw ss-rare', ...overrides };
  return { payload, result: JSON.parse(h.ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text) };
}
function playerRegistrationStatus(h, payload, token = payload.token) {
  return JSON.parse(h.ctx.doGet({ parameter: { action: 'editorCreatePlayerStatus', token, requestId: payload.requestId } }).text);
}

test('primeiro deck: cria linha completa, dono canônico, origem escolhida e catálogo sem partidas', () => {
  const h = harness();
  const { payload, result } = h.create({ deckName: '  Meren   - Alice  ', fields: {
    Comandante: 'Meren of Clan Nel Toth', Cores: 'BG', Bio: 'Meu deck',
    'Decklist URL': 'https://example.com/deck', 'Foto URL': 'https://example.com/photo.webp',
    'Comandante Secundário': 'Comandante de teste', 'Foto Comandante Secundário': 'https://example.com/secondary.webp',
    'Facilidade de Uso': '3', Autor: 'Bob', Origem: 'Fixo', Deck: 'Outro nome',
    Vitorias: 999, 'ID de Cadastro': 'forjado',
  } });
  assert.equal(result.ok, true);
  assert.equal(result.deckId, 'Meren - Alice');
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.warnings, []);
  const row = h.decks.records()[0];
  assert.equal(row.Autor, 'Alice');
  assert.equal(row.Origem, 'Fixo');
  assert.equal(row.Deck, 'Meren - Alice');
  assert.equal(row['ID de Cadastro'], payload.requestId);
  assert.equal(row['Facilidade de Uso'], 3);
  assert.equal(row['Comandante'], 'Meren of Clan Nel Toth');
  assert.equal(row['Foto URL'], 'https://example.com/photo.webp');
  assert.equal(row['Comandante Secundário'], 'Comandante de teste');
  assert.equal(row['Foto Comandante Secundário'], 'https://example.com/secondary.webp');
  assert.equal(row.Vitorias, undefined);
  assert.deepEqual(h.calls, { form: 1, cache: 1 });
  assert.equal(h.status(payload).status, 'complete');
  const session = h.ctx.buildPlayerEditorSessionData('Alice');
  assert.equal(session.decks[0].id, row.Deck);
  assert.equal(session.player.fields['PIN de Edição'], undefined);
  assert.equal(session.decks[0].fields['ID de Cadastro'], undefined);
  assert.equal(h.ctx.buildPlayerEditorSessionData('Bob').decks.length, 0);
  const catalog = h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {});
  assert.equal(catalog[0].deck, row.Deck);
  assert.equal(catalog[0].aparicoes, 0);
  assert.equal(catalog[0].origem.tipo, 'Fixo');
});

test('cadastro e consulta exigem sessão válida', () => {
  const h = harness();
  for (const token of ['', 'token-invalido']) {
    const { payload, result } = h.create({ token });
    assert.equal(result.ok, false);
    assert.match(result.error, /Sessão inválida/);
    assert.equal(h.status(payload).ok, false);
  }
  assert.equal(h.decks.records().length, 0);
});

test('somente o dono consegue editar o deck criado; não pode mudar nome ou proprietário', () => {
  const h = harness();
  const { result } = h.create();
  assert.throws(() => h.ctx.handlePlayerEditorDeckUpdate({
    token: h.bobToken, deckId: result.deckId, fields: { Bio: 'Invadido' },
  }), /permissão/);
  h.ctx.handlePlayerEditorDeckUpdate({ token: h.aliceToken, deckId: result.deckId,
    fields: { Bio: 'Bio nova', Deck: 'Renomeado', Autor: 'Bob', Origem: 'Fixo' } });
  const row = h.decks.records()[0];
  assert.equal(row.Bio, 'Bio nova');
  assert.equal(row.Autor, 'Alice');
  assert.equal(row.Deck, result.deckId);
  assert.equal(row.Origem, 'Fixo');
});

test('duplicatas ignoram caixa, acentos e espaços, inclusive decks de outros donos', () => {
  const h = harness({ decks: [['Dragões - Bob', 'Bob', 'Fora', 'Miirym']] });
  const { result } = h.create({ deckName: ' DRAGOES   - bob ' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Já existe/);
  assert.equal(h.decks.records().length, 1);
  assert.equal(h.create({ deckName: 'Dragões - Alice', fields: { Comandante: 'Miirym' } }).result.ok, true);
});

for (const [name, fields, message] of [
  ['', { Comandante: 'Meren' }, /2 e 80/],
  ['X', { Comandante: 'Meren' }, /2 e 80/],
  ['x'.repeat(81), { Comandante: 'Meren' }, /2 e 80/],
  ['Meren, Alice', { Comandante: 'Meren' }, /vírgulas/],
  ['Meren\nAlice', { Comandante: 'Meren' }, /quebras/],
  ['=SUM(1)', { Comandante: 'Meren' }, /prefixos/],
  ['__proto__', { Comandante: 'Meren' }, /prefixos/],
  ['constructor', { Comandante: 'Meren' }, /prefixos/],
  ['Meren', {}, /comandante/],
  ['Meren', { Comandante: '  ' }, /comandante/],
  ['Meren', { Comandante: 'Meren', 'Foto URL': 'javascript:alert(1)' }, /http ou https/],
  ['Meren', { Comandante: 'Meren', 'Facilidade de Uso': 10 }, /1 e 5/],
  ['Meren', { Comandante: 'Meren', Bio: 'x'.repeat(5001) }, /limite/],
]) {
  test(`validação atômica sem linha parcial: ${JSON.stringify(name).slice(0, 50)} / ${message}`, () => {
    const h = harness();
    const { result, payload } = h.create({ deckName: name, fields });
    assert.equal(result.ok, false);
    assert.match(result.error, message);
    assert.equal(h.status(payload).status, 'error');
    assert.equal(h.decks.records().length, 0);
    assert.equal(h.decks.getLastColumn(), 4);
    assert.equal(h.lock.held, false);
    assert.deepEqual(h.calls, { form: 0, cache: 0 });
  });
}

for (const [name, rows] of [
  ['PARTICIPACOES_DECKS', [['Deck'], ['Deck antigo']]],
  ['PARTICIPACOES_JOGADORES_DECKS_MANUAL', [['Deck'], ['Deck antigo']]],
  ['Respostas ao formulário 1', [['Quais decks jogaram?', 'Quem venceu?'], ['Outro, Deck antigo', 'Outro']]],
  ['Respostas ao formulário 1', [['Quais decks jogaram?', 'Quem venceu?'], ['Outro', 'Deck antigo']]],
]) {
  test(`não apropria nome histórico: ${name} / ${rows[1].join(' | ')}`, () => {
    const h = harness();
    h.sheets.set(name, new Sheet(rows));
    const { result } = h.create({ deckName: 'DECK ANTIGO' });
    assert.equal(result.ok, false);
    assert.match(result.error, /histórico/);
    assert.equal(h.decks.records().length, 0);
  });
}

test('reenvio idempotente, inclusive após remoção do cache de resultado', () => {
  const h = harness();
  const first = h.create();
  const second = h.create({ ...first.payload, deckName: 'Nome alterado no reenvio' });
  assert.deepEqual(second.result, first.result);
  assert.equal(h.decks.records().length, 1);
  assert.deepEqual(h.calls, { form: 1, cache: 1 });
  for (const key of h.values.keys()) if (key.startsWith('mtg-editor-create-deck:')) h.values.delete(key);
  assert.equal(h.status(first.payload).status, 'complete');
  assert.equal(h.create(first.payload).result.deckId, first.result.deckId);
  assert.equal(h.decks.records().length, 1);
});

test('outro jogador não reaproveita o ID nem acessa o resultado alheio', () => {
  const h = harness();
  const first = h.create();
  const other = h.create({ ...first.payload, token: h.bobToken });
  assert.equal(other.result.ok, false);
  assert.match(other.result.error, /outro jogador/);
  assert.equal(h.status(first.payload, h.bobToken).deckId, undefined);
  assert.equal(h.status(first.payload).status, 'complete');
  assert.equal(h.decks.records().length, 1);
});

test('lock indisponível não grava nem tenta liberar lock alheio', () => {
  const h = harness({ lockUnavailable: true });
  const { result } = h.create();
  assert.equal(result.ok, false);
  assert.match(result.error, /ocupado/);
  assert.equal(h.decks.records().length, 0);
});

test('erro no Forms/cache retorna cadastro concluído com avisos, sem apagar ou duplicar deck', () => {
  const h = harness({ formError: true, cacheError: true });
  const { result, payload } = h.create();
  assert.equal(result.ok, true);
  assert.equal(result.status, 'complete');
  assert.equal(result.warnings.length, 2);
  assert.equal(h.create(payload).result.ok, true);
  assert.equal(h.decks.records().length, 1);
});

test('campos livres são texto literal, não fórmulas de planilha', () => {
  const h = harness();
  h.create({ fields: { Comandante: 'Meren', Bio: '=SUM(1,2)', 'Decklist Texto': '+1 Sol Ring' } });
  assert.equal(h.decks.records()[0].Bio, '=SUM(1,2)');
  const bioColumn = h.decks.rows[0].indexOf('Bio');
  assert.equal(h.decks.appended[0][bioColumn], "'=SUM(1,2)");
});

test('erro corrigível permite repetir o mesmo ID sem perder o rascunho', () => {
  const h = harness();
  const first = h.create({ fields: {} });
  assert.equal(first.result.ok, false);
  const retry = h.create({ ...first.payload, fields: { Comandante: 'Meren' } });
  assert.equal(retry.result.ok, true);
  assert.equal(h.decks.records().length, 1);
});

test('status desconhecido fica pendente e IDs malformados não gravam nada', () => {
  const h = harness();
  assert.equal(h.status({ token: h.aliceToken, requestId: randomUUID() }).status, 'pending');
  assert.equal(h.create({ requestId: 'curto' }).result.ok, false);
  assert.equal(h.decks.records().length, 0);
});

test('frontend aplica as mesmas restrições de nome do backend', () => {
  for (const name of ['', 'X', 'x'.repeat(81), 'Meren, Alice', 'Meren\nAlice', '=SUM(1)', '__proto__', 'constructor']) {
    assert.notEqual(getNewDeckNameError(name, []), '', name);
  }
  assert.notEqual(getNewDeckNameError('  DRAGOES  - bob ', ['Dragões - Bob']), '');
  assert.equal(getNewDeckNameError('Dragões - Alice', ['Dragões - Bob']), '');
});

test('novo deck salva várias categorias e status sem aceitar metadados de exclusão forjados', () => {
  const h = harness();
  const { result } = h.create({ fields: { Comandante: 'Meren', Status: 'Inativo',
    Categorias: '["combo","tribal","combo"]', 'Excluído em': '2026-01-01' } });
  assert.equal(result.ok, true);
  const row = h.decks.records()[0];
  assert.equal(row.Status, 'Inativo');
  assert.deepEqual(JSON.parse(row.Categorias), ['combo', 'tribal']);
  assert.equal(row['Excluído em'], undefined);
  const catalog = h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {});
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].inativo, true);
  assert.equal(h.ctx.hasDeckCategory(row.Deck, 'combo'), true);
});

test('categorias antigas são herdadas; seleção vazia explícita substitui a lista antiga', () => {
  const h = harness({ decks: [['Giada', 'Alice', 'Fora', 'Giada']] });
  let session = h.ctx.buildPlayerEditorSessionData('Alice');
  assert.deepEqual(JSON.parse(session.decks[0].fields.Categorias), ['aggro', 'tribal']);
  assert.equal(h.ctx.isAggroDeck('Giada'), true);
  assert.equal(h.ctx.isTribalDeck('Giada'), true);
  const changed = h.mutate({ deckId: 'Giada', fields: { Categorias: '[]' } });
  assert.equal(changed.result.ok, true);
  assert.equal(h.ctx.isAggroDeck('Giada'), false);
  assert.equal(h.ctx.isTribalDeck('Giada'), false);
  session = h.ctx.buildPlayerEditorSessionData('Alice');
  assert.equal(session.decks[0].fields.Categorias, '[]');
});

test('símbolos Keyrune usam sets definidos sem mudar os IDs das categorias', () => {
  assert.deepEqual(DECK_CATEGORIES.map(({ id, keyrune }) => [id, keyrune]), [
    ['aggro', 'frf'], ['combo', 'usg'], ['tribal', 'lrw'], ['universes-beyond', 'ltr'], ['marvel', 'spm'],
  ]);
});

test('filtro de categoria inclui inativos e decks sem partidas, mas não excluídos', () => {
  const decks = [{ name: 'Novo', categories: ['tribal'] }, { name: 'Inativo', categories: ['combo', 'tribal'], inactive: true },
    { name: 'Excluído', categories: ['tribal'], deleted: true }, { name: 'Outro', categories: ['aggro'] }];
  assert.deepEqual(decksInCategory(decks, 'tribal').map(deck => deck.name), ['Novo', 'Inativo']);
  assert.deepEqual(decksInCategory(decks, 'marvel'), []);
});

test('foto do deck acompanha o comandante e nunca é substituída por Arte URL', () => {
  assert.equal(getDeckDisplayImage({ arteUrl: 'https://exemplo/custom.jpg', fotoUrl: 'https://exemplo/edicao.jpg' }), 'https://exemplo/edicao.jpg');
  assert.equal(getDeckDisplayImage({ arteUrl: '  ', fotoUrl: 'https://exemplo/edicao.jpg' }), 'https://exemplo/edicao.jpg');
  assert.equal(getDeckDisplayImage({ artUrl: 'https://exemplo/legacy.jpg', imageUrl: 'https://exemplo/default.jpg' }), 'https://exemplo/default.jpg');
  assert.equal(getDeckDisplayImage({ fotoUrl: ' ', imageUrl: '', photoUrl: ' https://exemplo/foto.jpg ' }), 'https://exemplo/foto.jpg');
  assert.equal(getDeckDisplayImage({ arteUrl: 'https://exemplo/banner.jpg' }), '');
  assert.equal(getDeckDisplayImage({}), '');
});

test('marcador de vida preserva Arte URL e só usa foto do comandante se não houver fundo', () => {
  assert.equal(getDeckBackgroundImage({ arteUrl: ' https://exemplo/fundo.jpg ', fotoUrl: 'https://exemplo/carta.jpg' }), 'https://exemplo/fundo.jpg');
  assert.equal(getDeckBackgroundImage({ arteUrl: '', artUrl: 'https://exemplo/antigo.jpg', fotoUrl: 'https://exemplo/carta.jpg' }), 'https://exemplo/antigo.jpg');
  assert.equal(getDeckBackgroundImage({ arteUrl: ' ', fotoUrl: 'https://exemplo/edicao.jpg' }), 'https://exemplo/edicao.jpg');
  assert.equal(getDeckBackgroundImage({ imageUrl: 'https://exemplo/foto.jpg' }), 'https://exemplo/foto.jpg');
  assert.equal(getDeckBackgroundImage({}), '');
});

test('origem padrão é Fora; dono pode alternar; origem inválida não altera nada', () => {
  const h = harness(); h.create();
  assert.equal(h.decks.records()[0].Origem, 'Fora');
  for (const origin of ['Fixo', 'Fora']) {
    assert.equal(h.mutate({ fields: { Origem: origin } }).result.ok, true);
    assert.equal(h.ctx.buildPlayerEditorSessionData('Alice').decks[0].fields.Origem, origin);
    assert.equal(h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {})[0].origem.tipo, origin);
  }
  const before = JSON.stringify(h.decks.rows);
  assert.equal(h.mutate({ fields: { Origem: 'Invalido', Bio: 'Não salvar' } }).result.ok, false);
  assert.equal(h.mutate({ token: h.bobToken, fields: { Origem: 'Fixo' } }).result.ok, false);
  assert.equal(JSON.stringify(h.decks.rows), before);
});

test('Keyrune ignora raridade antiga, mantém símbolo e sinaliza todos os usuários', () => {
  assert.equal(mythicKeyrune('ss ss-stx ss-rare ss-grad'), 'ss ss-stx ss-mythic ss-grad');
  assert.equal(keyruneCode('ss ss-mythic ss-2x ss-frf'), 'frf');
  assert.equal(mythicKeyrune(''), '');
  const usage = [{ playerId: 'Alice', displayName: 'Alice', keyruneClass: 'ss ss-stx ss-common' },
    { playerId: 'Bob', displayName: 'Bob', keyruneClass: 'ss ss-stx ss-mythic ss-grad' }];
  assert.equal(symbolUsers('stx', usage).length, 2);
  assert.equal(symbolUsers('frf', usage).length, 0);
  assert.equal(new Set(KEYRUNE_SYMBOLS.map(symbol => symbol.code)).size, KEYRUNE_SYMBOLS.length);
  assert.deepEqual(parseKeyruneCss('.ss-stx:before {content:"x"} .ss-frf::before {content:"y"} .ss-mythic:before {color:red}').map(item => item.code), ['stx', 'frf']);
});

test('cadastro de jogador exige sessão existente, gera linha sem permissões externas e preserva zeros do PIN', () => {
  const h = harness();
  const { payload, result } = registerPlayer(h, { createdBy: 'Bob', 'Cadastrado por': 'Bob', fields: { 'PIN de Edição': 'FORJADO' } });
  assert.equal(result.ok, true);
  assert.equal(result.playerId, 'Carla');
  const row = h.sheets.get('JOGADORES').records().find(row => row.Jogador === 'Carla');
  assert.equal(row['PIN de Edição'], '001234');
  assert.equal(row['Ícone Keyrune'], 'ss ss-lrw ss-mythic ss-grad');
  assert.equal(row['Cadastrado por'], 'Alice');
  assert.ok(row['Cadastrado em']);
  assert.equal(row['ID de Cadastro'], payload.requestId);
  assert.equal(h.calls.cache, 1);
  assert.equal(h.calls.form, 0);
  assert.equal(playerRegistrationStatus(h, payload).playerId, 'Carla');
  const login = JSON.parse(h.ctx.doGet({ parameter: { action: 'editorLogin', player: 'Carla', pin: '001234' } }).text);
  assert.equal(login.ok, true);
  assert.equal(login.data.player.id, 'Carla');
  assert.deepEqual(login.data.decks, []);
});

test('cadastro não devolve PIN ou autoria no status, sessão, catálogo, mini perfil ou ranking público', () => {
  const h = harness(); const { payload, result } = registerPlayer(h);
  const rows = h.ctx.sheetToObjects(h.sheets.get('JOGADORES'));
  const info = h.ctx.buildInfoMap(rows, 'Jogador');
  const period = { filter: () => true };
  const outputs = [result, playerRegistrationStatus(h, payload), h.ctx.buildPlayerEditorSessionData('Alice'),
    h.ctx.buildPlayerEditorSessionData('Carla'), h.ctx.buildLifeTrackerPlayersCatalog(rows), h.ctx.buildPlayerMiniInfo('Carla', info),
    h.ctx.buildLeaderboardForPeriod([{ Jogador: 'Carla', 'Venceu?': 'Sim', 'Partida ID': '1' }], [], info, {}, period, null, {})];
  for (const value of outputs) {
    const json = JSON.stringify(value);
    assert.doesNotMatch(json, /Cadastrado por|Cadastrado em|ID de Cadastro|PIN de Edição|001234|"actor"|"createdBy"/);
  }
});

test('sem login, sessão expirada ou titular ausente não há novos jogadores', () => {
  const h = harness(); const before = JSON.stringify(h.sheets.get('JOGADORES').rows);
  for (const token of ['', 'invalid', h.ctx.createPlayerEditorSession('Fantasma')]) {
    const { result, payload } = registerPlayer(h, { token });
    assert.equal(result.ok, false);
    assert.equal(playerRegistrationStatus(h, payload).ok, false);
  }
  assert.equal(JSON.stringify(h.sheets.get('JOGADORES').rows), before);
});

test('cadastro repetido não duplica nem troca nome, PIN ou autoria, mesmo depois de perder o cache', () => {
  const h = harness(); const { payload } = registerPlayer(h);
  assert.equal(registerPlayer(h, { ...payload, playerName: 'Outra pessoa', initialPin: '999999' }).result.playerId, 'Carla');
  h.values.delete('mtg-editor-player:' + payload.requestId);
  assert.equal(playerRegistrationStatus(h, payload).playerId, 'Carla');
  assert.equal(registerPlayer(h, { ...payload, playerName: 'Outra pessoa', initialPin: '999999' }).result.playerId, 'Carla');
  const records = h.sheets.get('JOGADORES').records();
  assert.equal(records.length, 3);
  assert.equal(records[2]['PIN de Edição'], '001234');
  assert.equal(records[2]['Cadastrado por'], 'Alice');
});

test('outro jogador não consulta, reutiliza nem envenena recibo de cadastro alheio', () => {
  const h = harness(); const { payload } = registerPlayer(h);
  for (const removeCache of [false, true]) {
    if (removeCache) h.values.delete('mtg-editor-player:' + payload.requestId);
    assert.equal(playerRegistrationStatus(h, payload, h.bobToken).ok, false);
    assert.equal(registerPlayer(h, { ...payload, token: h.bobToken }).result.ok, false);
    assert.equal(playerRegistrationStatus(h, payload).playerId, 'Carla');
  }
  assert.equal(h.sheets.get('JOGADORES').records().length, 3);
});

test('nomes duplicados, históricos e malformados são rejeitados antes de gravar o jogador', () => {
  const h = harness();
  h.sheets.set('PARTICIPACOES_JOGADORES', new Sheet([['Jogador'], ['Antigo']]));
  for (const playerName of [' Alice ', 'BOB', 'Antigo', '__proto__', '=1+1', 'A,B', 'C\nD', 'X', 'x'.repeat(81)]) {
    assert.equal(registerPlayer(h, { playerName }).result.ok, false, playerName);
  }
  assert.equal(registerPlayer(h, { initialPin: 'abc' }).result.ok, false);
  assert.equal(registerPlayer(h, { keyruneClass: '<script>' }).result.ok, false);
  assert.equal(h.sheets.get('JOGADORES').records().length, 2);
});

test('nome de exibição literal, erro corrigível e símbolos compartilhados são aceitos', () => {
  const h = harness(); const requestId = randomUUID();
  assert.equal(registerPlayer(h, { requestId, playerName: '' }).result.ok, false);
  assert.equal(registerPlayer(h, { requestId, displayName: '=2+2' }).result.ok, true);
  assert.equal(registerPlayer(h, { playerName: 'Davi' }).result.ok, true);
  assert.equal(h.sheets.get('JOGADORES').records()[2]['Nome de Exibição'], '=2+2');
  const session = h.ctx.buildPlayerEditorSessionData('Alice');
  assert.equal(session.keyruneUsage.filter(item => item.keyruneClass.includes('ss-lrw')).length, 2);
});

test('cache público com falha preserva jogador criado; lock ocupado não grava', () => {
  const h = harness({ cacheError: true });
  const { result, payload } = registerPlayer(h);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.equal(playerRegistrationStatus(h, payload).status, 'complete');
  const blocked = harness({ lockUnavailable: true });
  assert.equal(registerPlayer(blocked).result.ok, false);
  assert.equal(blocked.sheets.get('JOGADORES').records().length, 2);
});

test('atualizar o próprio símbolo força Mítico e não altera PIN, identificador ou auditoria', () => {
  const h = harness(); registerPlayer(h);
  const token = h.ctx.createPlayerEditorSession('Carla');
  h.ctx.handlePlayerEditorProfileUpdate({ token, fields: { 'Ícone Keyrune': 'ss ss-frf ss-common',
    'Ícone Set Favorito': 'ss ss-stx ss-rare', 'Cadastrado por': 'Bob', 'PIN de Edição': '999999', Jogador: 'Outro' } });
  const row = h.sheets.get('JOGADORES').records()[2];
  assert.equal(row['Ícone Keyrune'], 'ss ss-frf ss-mythic ss-grad');
  assert.equal(row['Ícone Set Favorito'], 'ss ss-stx ss-mythic ss-grad');
  assert.equal(row.Jogador, 'Carla');
  assert.equal(row['Cadastrado por'], 'Alice');
  assert.equal(row['PIN de Edição'], '001234');
});

test('trocar edição atualiza foto pública sem sobrescrever Arte URL, Header URL ou cartas-chave', () => {
  const h = harness();
  const fields = { Comandante: 'Meren', 'Foto URL': 'https://cards.scryfall.io/large/versao1.jpg',
    'Arte URL': 'https://exemplo/fundo.jpg', 'Header URL': 'https://exemplo/capa.jpg',
    'Comandante Secundário': 'Parceiro', 'Foto Comandante Secundário': 'https://cards.scryfall.io/large/secundario.jpg',
    'Carta Chave 1': 'Sol Ring', 'Arte Carta Chave 1': 'https://cards.scryfall.io/large/solring.jpg',
    'Scryfall Carta Chave 1': 'https://scryfall.com/card/cmm/396/sol-ring' };
  assert.equal(h.create({ fields }).result.ok, true);
  const savedFields = h.ctx.buildPlayerEditorSessionData('Alice').decks[0].fields;
  for (const [key, value] of Object.entries(fields)) assert.equal(savedFields[key], value);
  assert.equal(h.mutate({ fields: { 'Foto URL': 'https://cards.scryfall.io/large/versao2.jpg' } }).result.ok, true);
  const catalog = h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {});
  assert.equal(catalog[0].fotoUrl, 'https://cards.scryfall.io/large/versao2.jpg');
  assert.equal(catalog[0].arteUrl, fields['Arte URL']);
  assert.equal(catalog[0].headerUrl, fields['Header URL']);
  assert.equal(getDeckDisplayImage(catalog[0]), 'https://cards.scryfall.io/large/versao2.jpg');
  assert.equal(getDeckBackgroundImage(catalog[0]), fields['Arte URL']);
  const mini = h.ctx.buildDeckMiniInfo('Meren - Alice', { 'Meren - Alice': h.decks.records()[0] });
  assert.equal(getDeckDisplayImage(mini), 'https://cards.scryfall.io/large/versao2.jpg');
  assert.equal(h.decks.records()[0]['Header URL'], fields['Header URL']);
  assert.equal(catalog[0].fotoComandanteSecundario, fields['Foto Comandante Secundário']);
  assert.equal(catalog[0].cartasChave[0].imagemUrl, fields['Arte Carta Chave 1']);
  assert.equal(catalog[0].cartasChave[0].scryfallUrl, fields['Scryfall Carta Chave 1']);
});

test('cinco categorias são integradas às funções existentes de conquistas', () => {
  const h = harness();
  h.create({ fields: { Comandante: 'Meren', Categorias: JSON.stringify(DECK_CATEGORIES.map(category => category.id)) } });
  for (const check of ['isAggroDeck', 'isComboDeck', 'isTribalDeck', 'isUniversesBeyondDeck', 'isMarvelDeck']) {
    assert.equal(h.ctx[check]('Meren - Alice'), true, check);
  }
  assert.ok(h.ctx.getConfiguredComboDeckNames().includes('Meren - Alice'));
});

test('marca e desmarca Inativo sem remover catálogo, edição ou histórico', () => {
  const h = harness();
  h.create();
  h.sheets.set('PARTICIPACOES_DECKS', new Sheet([['Deck', 'Venceu?'], ['Meren - Alice', 'Sim']]));
  const history = JSON.stringify(h.sheets.get('PARTICIPACOES_DECKS').rows);
  for (const status of ['Inativo', 'Ativo']) {
    const { result, payload } = h.mutate({ fields: { Status: status } });
    assert.equal(result.status, 'complete');
    assert.equal(h.mutationStatus(payload).status, 'complete');
    assert.equal(h.ctx.buildPlayerEditorSessionData('Alice').decks[0].fields.Status, status);
    const catalog = h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {});
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].inativo, status === 'Inativo');
    assert.equal(JSON.stringify(h.sheets.get('PARTICIPACOES_DECKS').rows), history);
  }
});

function slayerFixture() {
  const { ctx } = harness();
  const decks = {
    Dragao: { Deck: 'Dragao', Autor: 'Bob', Status: 'Ativo', Categorias: '["combo"]' },
    Elfos: { Deck: 'Elfos', Autor: 'Bob', Status: 'Ativo', Categorias: '["combo"]' },
    Novo: { Deck: 'Novo', Autor: 'Bob', Status: 'Ativo' },
    Meren: { Deck: 'Meren', Autor: 'Alice', Status: 'Ativo' },
  };
  const history = [
    { 'Partida ID': '1', Jogador: 'Alice', Deck: 'Meren', 'Venceu?': 'Sim' },
    { 'Partida ID': '1', Jogador: 'Bob', Deck: 'Dragao', 'Venceu?': 'Não' },
    { 'Partida ID': '2', Jogador: 'Alice', Deck: 'Meren', 'Venceu?': 'Não' },
    { 'Partida ID': '2', Jogador: 'Bob', Deck: 'Elfos', 'Venceu?': 'Sim' },
  ];
  const achievement = () => ctx.buildAuthorSlayerAchievementsMap(history, decks).Alice?.find(item => item.id === 'author_slayer_bob');
  return { ctx, decks, history, achievement };
}

test('Slayer continua exigindo apenas os decks do autor que já participaram de partidas', () => {
  const { achievement } = slayerFixture();
  const item = achievement();
  assert.equal(item.target, 2);
  assert.equal(item.value, 1);
  assert.equal(item.unlocked, false);
  assert.deepEqual(Array.from(item.details.decks, deck => deck.nome), ['Dragao', 'Elfos']);
});

test('inativar deck não derrotado retira o requisito e libera Slayer dos ativos já derrotados', () => {
  const { decks, achievement } = slayerFixture();
  decks.Elfos.Status = 'Inativo';
  const item = achievement();
  assert.equal(item.target, 1);
  assert.equal(item.value, 1);
  assert.equal(item.progress, 100);
  assert.equal(item.unlocked, true);
  assert.deepEqual(Array.from(item.details.decks, deck => deck.nome), ['Dragao']);
  assert.equal(item.details.decks[0].locked, false);
  assert.match(item.description, /deck ativo/);
});

test('inativar deck já derrotado remove tanto o progresso quanto o requisito, sem falsa conclusão', () => {
  const { decks, achievement } = slayerFixture();
  decks.Dragao.Status = 'Inativo';
  const item = achievement();
  assert.equal(item.target, 1);
  assert.equal(item.value, 0);
  assert.equal(item.progress, 0);
  assert.equal(item.unlocked, false);
  assert.equal(item.details.decks[0].nome, 'Elfos');
  assert.equal(item.details.decks[0].locked, true);
});

test('autor sem decks ativos mantém apenas histórico conquistado e não desbloqueia 0/0', () => {
  const { decks, achievement } = slayerFixture();
  decks.Dragao.Status = 'Inativo';
  decks.Elfos.Status = 'Inativo';
  // Novo continua ativo, mas sem partidas: a regra histórica não é alterada.
  assert.equal(achievement().target, 0);
  assert.equal(achievement().value, 0);
  assert.equal(achievement().unlocked, false);
  assert.equal(achievement().details.decks.length, 1);
  assert.equal(achievement().details.decks[0].nome, 'Dragao');
  assert.equal(achievement().details.decks[0].required, false);
});

test('reativar deck volta a exigir a vitória pendente e aproveita derrotas antigas', () => {
  const { decks, history, achievement } = slayerFixture();
  const original = JSON.stringify(history);
  decks.Elfos.Status = 'Inativo';
  assert.equal(achievement().unlocked, true);
  decks.Elfos.Status = 'Ativo';
  assert.equal(achievement().unlocked, false);
  assert.equal(achievement().target, 2);
  decks.Dragao.Status = 'Inativo';
  assert.equal(achievement().value, 0);
  decks.Dragao.Status = 'Ativo';
  assert.equal(achievement().value, 1);
  assert.equal(JSON.stringify(history), original);
});

test('Slayer interpreta Status Inativo da planilha sem depender de caixa ou espaços', () => {
  const { decks, achievement } = slayerFixture();
  decks.Elfos.Status = '  INATIVO  ';
  decks.Dragao.Status = '';
  assert.equal(achievement().target, 1);
  assert.equal(achievement().unlocked, true);
});

test('inatividade não altera mapas de vitórias nem apaga evidências brutas compartilhadas', () => {
  const { ctx, decks, history, achievement } = slayerFixture();
  const originalWins = JSON.stringify(ctx.buildPlayerDefeatedDecksMap(history));
  decks.Elfos.Status = 'Inativo';
  decks.Dragao.Status = 'Inativo';
  assert.equal(achievement().target, 0);
  assert.equal(JSON.stringify(ctx.buildPlayerDefeatedDecksMap(history)), originalWins);
  ctx.primeDeckCategoryInfo(Object.values(decks));
  const required = ctx.getRegisteredConfiguredComboDeckNames(history);
  assert.deepEqual(Array.from(required).sort(), ['Dragao', 'Elfos']);
  const details = ctx.buildAuthorSlayerDeckDetails(required, ctx.buildPlayerDefeatedDecksMap(history).Alice, decks);
  assert.equal(details.length, 2);
});

test('inativo derrotado aparece no Slayer sem contar no progresso e inativo não derrotado é omitido', () => {
  const { decks, achievement } = slayerFixture();
  decks.Dragao.Status = 'Inativo';
  let item = achievement();
  assert.equal(item.value, 0);
  assert.equal(item.target, 1);
  assert.deepEqual(Array.from(item.details.decks, deck => [deck.nome, deck.required, deck.inactive, deck.locked]),
    [['Elfos', true, false, true], ['Dragao', false, true, false]]);
  assert.match(item.details.decks[1].contextLabel, /histórica.*não obrigatório/);
  decks.Dragao.Status = 'Ativo'; decks.Elfos.Status = 'Inativo';
  item = achievement();
  assert.equal(item.unlocked, true);
  assert.deepEqual(Array.from(item.details.decks, deck => deck.nome), ['Dragao']);
});

test('Combobreaker usa a regra dos ativos sem permitir que históricos substituam requisitos', () => {
  const { ctx, decks, history } = slayerFixture();
  ctx.primeDeckCategoryInfo(Object.values(decks));
  const names = ctx.getRegisteredConfiguredComboDeckNames(history);
  const wins = ctx.buildPlayerDefeatedDecksMap(history).Alice;
  const build = () => ctx.buildDeckCollectionAchievement({ id: 'combobreaker', name: 'Combobreaker', completedTier: 'mythic' }, names, wins, decks);
  assert.equal(build().target, 2);
  decks.Elfos.Status = 'Inativo';
  assert.equal(build().target, 1);
  assert.equal(build().unlocked, true);
  assert.equal(build().tier, 'mythic');
  decks.Elfos.Status = 'Ativo'; decks.Dragao.Status = 'Inativo';
  assert.equal(build().target, 1);
  assert.equal(build().value, 0);
  assert.equal(build().unlocked, false);
  assert.equal(build().details.decks[1].required, false);
  decks.Dragao.Status = 'Ativo';
  assert.equal(build().value, 1);
  assert.equal(build().target, 2);
});

test('coleção sem ativos ou vazia não gera desbloqueio automático nem progresso inválido', () => {
  const { ctx, decks } = slayerFixture();
  decks.Dragao.Status = 'Inativo';
  for (const names of [[], ['Dragao'], ['Dragao', 'Dragao']]) {
    const item = ctx.buildDeckCollectionAchievement({ id: 'x' }, names, { Dragao: 8 }, decks);
    assert.equal(item.value, 0); assert.equal(item.target, 0);
    assert.equal(item.progress, 0); assert.equal(item.unlocked, false);
    assert.equal(item.details.decks.length, names.length ? 1 : 0);
  }
});

test('catálogo global inclui todas as manuais, progresso parcial e jogadores sem partidas; sem dados privados', () => {
  const h = harness();
  const manual = h.ctx.mergeManualAchievementCatalogWithUnlocked('Alice', {
    counterspell_your_counterspell: { value: 1, notes: ['segredo-nota'], dates: [] },
    beginner_precon: { value: 1, notes: [], dates: [] },
  });
  const directory = h.ctx.buildAchievementDirectory({ Alice: manual, Historico: [{ id: 'combobreaker', unlocked: true, value: 1, target: 1, progress: 100, tier: 'mythic' }] }, {
    Alice: { 'Nome de Exibição': 'Alícia', 'PIN de Edição': 'pin-secreto', 'Cadastrado por': 'criador-secreto', 'Ícone Keyrune': 'ss ss-ice ss-rare' },
    SemPartidas: { 'Nome de Exibição': 'Novato' },
  });
  assert.equal(directory.players.length, 3);
  assert.equal(directory.players.find(player => player.id === 'SemPartidas').achievements.length, 0);
  const alice = directory.players.find(player => player.id === 'Alice');
  assert.equal(alice.displayName, 'Alícia');
  assert.equal(alice.achievements.find(item => item.id === 'counterspell_your_counterspell').unlocked, false);
  assert.equal(alice.achievements.find(item => item.id === 'beginner_precon').unlocked, true);
  assert.match(alice.keyruneClass, /ss-mythic/);
  const catalog = h.ctx.buildManualAchievementCatalog();
  assert.equal(directory.manualCatalog.length, catalog.length);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  for (const item of directory.manualCatalog) {
    assert.ok(item.id && item.name && item.description);
    assert.ok(Object.values(item.thresholds).every(value => value > 0));
  }
  assert.doesNotMatch(JSON.stringify(directory), /pin-secreto|criador-secreto|segredo-nota|PIN de Edição|Cadastrado por/);
});

test('cálculo completo publica Combobreaker por ativos e mantém o catálogo manual sem partidas', () => {
  const h = harness();
  const ss = { getSheetByName: name => h.sheets.get(name) || null };
  const map = h.ctx.buildPlayerAchievementsMap(ss, [], [], [], { Alice: { Jogador: 'Alice' } }, {});
  const item = map.Alice.find(achievement => achievement.id === 'combobreaker');
  assert.equal(item.deckCollection, true);
  assert.equal(item.target, 0);
  assert.equal(item.unlocked, false);
  assert.equal(map.Alice.filter(achievement => achievement.manual).length, h.ctx.buildManualAchievementCatalog().length);
});

test('Combobreaker recalculado no fluxo completo inclui histórico opcional e conserva as demais estatísticas', () => {
  const h = harness();
  h.ctx.Utilities.formatDate = () => '01/09/2026';
  const { decks, history } = slayerFixture();
  const rows = history.map(row => ({ ...row, 'Data/Hora': new Date('2026-09-01T12:00:00Z') }));
  const ss = { getSheetByName: name => h.sheets.get(name) || null };
  const build = () => h.ctx.buildPlayerAchievementsMap(ss, rows, rows, rows,
    { Alice: { Jogador: 'Alice' }, Bob: { Jogador: 'Bob' } }, decks).Alice;
  const before = build();
  decks.Dragao.Status = 'Inativo';
  const after = build();
  const combo = after.find(item => item.id === 'combobreaker');
  assert.equal(combo.target, 1); assert.equal(combo.value, 0);
  assert.equal(combo.details.decks[1].nome, 'Dragao');
  assert.equal(combo.details.decks[1].required, false);
  assert.equal(after.find(item => item.id === 'total_wins').value, before.find(item => item.id === 'total_wins').value);
  decks.Dragao.Status = 'Ativo'; decks.Elfos.Status = 'Inativo';
  assert.equal(build().find(item => item.id === 'combobreaker').unlocked, true);
});

test('salvar Status no editor muda os requisitos Slayer e agenda a atualização do cache', () => {
  const h = harness();
  h.create();
  h.create({ deckName: 'Elfos - Alice', fields: { Comandante: 'Lathril' } });
  const history = [
    { 'Partida ID': '1', Jogador: 'Bob', Deck: 'Dragao', 'Venceu?': 'Sim' },
    { 'Partida ID': '1', Jogador: 'Alice', Deck: 'Meren - Alice', 'Venceu?': 'Não' },
    { 'Partida ID': '2', Jogador: 'Bob', Deck: 'Dragao', 'Venceu?': 'Não' },
    { 'Partida ID': '2', Jogador: 'Alice', Deck: 'Elfos - Alice', 'Venceu?': 'Sim' },
  ];
  const achievement = () => h.ctx.buildAuthorSlayerAchievementsMap(history,
    Object.fromEntries(h.decks.records().map(row => [row.Deck, row]))).Bob[0];
  assert.equal(achievement().target, 2);
  const cacheBefore = h.calls.cache;
  assert.equal(h.mutate({ deckId: 'Elfos - Alice', fields: { Status: 'Inativo' } }).result.ok, true);
  assert.equal(h.calls.cache, cacheBefore + 1);
  assert.equal(achievement().target, 1);
  assert.equal(achievement().unlocked, true);
  assert.equal(h.mutate({ deckId: 'Elfos - Alice', fields: { Status: 'Ativo' } }).result.ok, true);
  assert.equal(achievement().target, 2);
  assert.equal(achievement().unlocked, false);
});

for (const fields of [{ Categorias: '["inexistente"]' }, { Categorias: '{}' }, { Categorias: 'inválido' }, { Status: 'Excluído' }]) {
  test(`metadados inválidos rejeitados antes de modificar qualquer campo: ${JSON.stringify(fields)}`, () => {
    const h = harness(); h.create();
    const before = JSON.stringify(h.decks.rows);
    const { result } = h.mutate({ fields: { Bio: 'Não pode ser salvo', ...fields } });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(h.decks.rows), before);
  });
}

test('exclusão exige dono e confirmação exata; sessões inválidas não alteram dados', () => {
  const h = harness(); h.create();
  const before = JSON.stringify(h.decks.rows);
  for (const overrides of [{ token: '' }, { token: h.bobToken }, { confirmDeckName: 'Nome diferente' }]) {
    const { result } = h.mutate({ action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice', ...overrides });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(h.decks.rows), before);
  }
  assert.equal(h.mutate({ token: h.bobToken, fields: { Status: 'Inativo', Categorias: '[]' } }).result.ok, false);
  assert.equal(JSON.stringify(h.decks.rows), before);
});

test('exclusão recuperável preserva linha, partidas e categorias; remove somente cadastro disponível', () => {
  const h = harness();
  h.create({ fields: { Comandante: 'Meren', Categorias: '["combo"]' } });
  h.sheets.set('Respostas ao formulário 1', new Sheet([['Quais decks jogaram?'], ['Meren - Alice']]));
  const history = JSON.stringify(h.sheets.get('Respostas ao formulário 1').rows);
  const { result, payload } = h.mutate({ action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice' });
  assert.equal(result.ok, true);
  assert.equal(h.decks.records().length, 1);
  const row = h.decks.records()[0];
  assert.ok(row['Excluído em']);
  assert.equal(row['Excluído por'], 'Alice');
  assert.equal(row.Comandante, 'Meren');
  assert.equal(h.ctx.isComboDeck(row.Deck), true);
  assert.equal(h.ctx.buildPlayerEditorSessionData('Alice').decks.length, 0);
  assert.equal(h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {}).length, 0);
  const leaderboard = h.ctx.buildLeaderboardForPeriod([], [
    { 'Partida ID': '1', Deck: row.Deck, 'Venceu?': 'Sim' },
  ], {}, h.ctx.buildInfoMap(h.ctx.sheetToObjects(h.decks), 'Deck'), { start: null, end: null }, null, {});
  assert.equal(leaderboard.decks[0].aparicoes, 1);
  assert.equal(leaderboard.decks[0].vitorias, 1);
  assert.equal(leaderboard.decks[0].excluido, true);
  assert.deepEqual(Array.from(leaderboard.decks[0].categorias), ['combo']);
  assert.equal(JSON.stringify(h.sheets.get('Respostas ao formulário 1').rows), history);
  assert.equal(h.mutationStatus(payload).status, 'complete');
  assert.equal(h.mutationStatus(payload, h.bobToken).status, 'pending');
  assert.equal(h.mutate({ fields: { Bio: 'Ressuscitar', 'Excluído em': '' } }).result.ok, false);
  assert.equal(h.create().result.ok, false, 'Nome excluído permanece reservado para proteger histórico');
});

test('exclusão repetida é segura e consulta sobrevive à perda do cache', () => {
  const h = harness(); h.create();
  const first = h.mutate({ action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice' });
  const deletedAt = h.decks.records()[0]['Excluído em'];
  assert.equal(h.mutate(first.payload).result.status, 'complete');
  for (const key of h.values.keys()) if (key.startsWith('mtg-editor-deck-mutation:')) h.values.delete(key);
  assert.equal(h.mutationStatus(first.payload).status, 'complete');
  assert.equal(h.mutate(first.payload).result.status, 'complete');
  assert.equal(h.decks.records()[0]['Excluído em'], deletedAt);
  assert.equal(h.decks.records().length, 1);
});

test('recuperação administrativa remove só os marcadores de exclusão', () => {
  const h = harness(); h.create();
  h.mutate({ action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice' });
  for (const field of ['Excluído em', 'Excluído por']) {
    h.decks.getRange(2, h.decks.rows[0].indexOf(field) + 1).setValue('');
  }
  assert.equal(h.ctx.buildPlayerEditorSessionData('Alice').decks.length, 1);
  assert.equal(h.ctx.buildLifeTrackerDecksCatalog(h.ctx.sheetToObjects(h.decks), {}).length, 1);
});

test('cache público com falha não desfaz exclusão já confirmada', () => {
  const h = harness({ cacheError: true }); h.create();
  const { result } = h.mutate({ action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice' });
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.ok(h.decks.records()[0]['Excluído em']);
});

test('mesmo ID de operação não pode ser usado para excluir depois de salvar', () => {
  const h = harness(); h.create();
  const first = h.mutate({ fields: { Status: 'Inativo' } });
  const second = h.mutate({ ...first.payload, action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice' });
  assert.equal(second.result.ok, false);
  assert.equal(h.ctx.isDeckDeleted(h.decks.records()[0]), false);
});

test('status de mutações exige sessão e não expõe resposta de outro jogador', () => {
  const h = harness(); h.create();
  const { payload } = h.mutate({ fields: { Status: 'Inativo' } });
  assert.equal(h.mutationStatus(payload, '').ok, false);
  assert.equal(h.mutationStatus(payload, h.bobToken).status, 'pending');
  assert.equal(h.mutate({ requestId: 'curto' }).result.ok, false);
});

test('lock ocupado impede exclusão sem alterar a linha', () => {
  const h = harness(); h.create();
  const before = JSON.stringify(h.decks.rows);
  h.lock.held = true;
  const { result } = h.mutate({ action: 'editorDeleteDeck', confirmDeckName: 'Meren - Alice' });
  assert.equal(result.ok, false);
  assert.match(result.error, /ocupado/);
  assert.equal(JSON.stringify(h.decks.rows), before);
});

test('nomes de jogadores com prefixo longo não compartilham cache de mutações', () => {
  const h = harness();
  const first = 'A'.repeat(101) + 'Alice';
  const second = 'A'.repeat(101) + 'Bob';
  const requestId = randomUUID();
  h.ctx.saveDeckMutation(requestId, first, { status: 'complete', deckId: 'Privado' });
  assert.equal(h.ctx.readDeckMutation(requestId, second), null);
});

test('frontend: multisseleção, remoção da última categoria e disponibilidade independente de Inativo', () => {
  assert.deepEqual(readDeckCategories('["combo","combo","inexistente"]'), ['combo']);
  assert.equal(toggleDeckCategory('["combo"]', 'combo'), '[]');
  assert.deepEqual(JSON.parse(toggleDeckCategory('["combo"]', 'tribal')), ['combo', 'tribal']);
  const cards = [{ deck: 'Ativo' }, { deck: 'Inativo', inativo: true }, { deck: 'Excluído', excluido: true }];
  assert.deepEqual(cards.filter(isAvailableDeck).map(deck => deck.deck), ['Ativo', 'Inativo']);
  assert.equal(isAvailableDeck({ deleted: true }), false);
});
