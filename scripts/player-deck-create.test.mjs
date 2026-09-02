// Testes locais: nenhuma chamada ao Google, Cloudinary ou à planilha real.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { getNewDeckNameError } from '../src/editorDecks.ts';
import { DECK_CATEGORIES, isAvailableDeck, readDeckCategories, toggleDeckCategory } from '../src/deckMetadata.ts';

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

test('primeiro deck: cria linha completa, dono canônico, origem Fora e catálogo sem partidas', () => {
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
  assert.equal(row.Origem, 'Fora');
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
  assert.equal(catalog[0].origem.tipo, 'Fora');
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
  assert.equal(row.Origem, 'Fora');
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
