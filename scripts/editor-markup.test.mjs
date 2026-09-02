// Renderização local sem navegador, APIs ou alterações em contas reais.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let server, DeckLabels, RegisterPlayer, KeyrunePicker, dashboard, achievementBrowser;
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', plugins: [{
    name: 'expose-deck-rendering-for-local-tests',
    enforce: 'pre',
    transform(code, id) {
      // Exportações só no servidor de testes; não mudam o App nem o bundle publicado.
      if (id.endsWith('/src/App.tsx')) return `${code}\nexport { normalizeDecks, CommanderStack, createDeckFromCombo, buildFallbackDeckFromCombo, AchievementDetailsModal, PlayerAchievementsSection };`;
    },
  }] });
  ({ DeckLabels } = await server.ssrLoadModule('/src/DeckLabels.tsx'));
  ({ default: RegisterPlayer } = await server.ssrLoadModule('/src/RegisterPlayer.tsx'));
  ({ default: KeyrunePicker } = await server.ssrLoadModule('/src/KeyrunePicker.tsx'));
  dashboard = await server.ssrLoadModule('/src/App.tsx');
  achievementBrowser = await server.ssrLoadModule('/src/AchievementBrowser.tsx');
});
after(async () => { await server?.close(); });
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

test('listas e modais renderizam a edição do comandante, mesmo com Arte URL preenchida', () => {
  const [deck] = dashboard.normalizeDecks([{ deck: 'Meren', comandante: 'Meren',
    fotoUrl: 'https://exemplo/edicao-nova.jpg', arteUrl: 'https://exemplo/banner.jpg' }]);
  assert.equal(deck.imageUrl, 'https://exemplo/edicao-nova.jpg');
  assert.equal(deck.headerUrl, 'https://exemplo/banner.jpg');
  for (const variant of ['card', 'profile']) {
    const html = render(dashboard.CommanderStack, { deck, variant });
    assert.match(html, /src="https:\/\/exemplo\/edicao-nova.jpg"/);
    assert.doesNotMatch(html, /banner.jpg/);
  }
});

test('Header URL continua prioritária no banner; comandante secundário mantém foto independente', () => {
  const [deck] = dashboard.normalizeDecks([{ deck: 'Parceiros', comandante: 'Primeiro',
    fotoUrl: 'https://exemplo/principal.jpg', arteUrl: 'https://exemplo/arte.jpg', headerUrl: 'https://exemplo/header.jpg',
    comandanteSecundario: 'Segundo', fotoComandanteSecundario: 'https://exemplo/segundo.jpg' }]);
  assert.equal(deck.headerUrl, 'https://exemplo/header.jpg');
  const html = render(dashboard.CommanderStack, { deck, variant: 'profile' });
  assert.match(html, /src="https:\/\/exemplo\/principal.jpg"/);
  assert.match(html, /src="https:\/\/exemplo\/segundo.jpg"/);
  assert.doesNotMatch(html, /arte.jpg|header.jpg/);
});

test('prévias dos detalhes estatísticos também usam foto do comandante sem perder o banner', () => {
  const combo = { nome: 'Meren', deck: 'Meren', comandante: 'Meren', games: 1, wins: 1, winrate: 1,
    fotoUrl: 'https://exemplo/edicao.jpg', arteUrl: 'https://exemplo/arte.jpg' };
  for (const build of [dashboard.createDeckFromCombo, dashboard.buildFallbackDeckFromCombo]) {
    const deck = build(combo);
    assert.equal(deck.imageUrl, combo.fotoUrl);
    assert.equal(deck.headerUrl, combo.arteUrl);
  }
});

test('perfil: categorias compactas são botões com tooltip e nome acessível, sem texto no marcador', () => {
  const html = render(DeckLabels, { categories: ['combo', 'tribal'], compact: true, onCategoryClick: () => {} });
  assert.equal((html.match(/<button/g) || []).length, 2);
  assert.match(html, /data-tooltip="Combo"/);
  assert.match(html, /aria-label="Ver decks da categoria Tribal"/);
  assert.match(html, /ss-usg/);
  assert.doesNotMatch(html, /<span>Combo<\/span>|<span>Tribal<\/span>/);
});

test('editor mantém rótulos das categorias; listas recebem só os selos de status', () => {
  assert.match(render(DeckLabels, { categories: ['combo'] }), /<span>Combo<\/span>/);
  const list = render(DeckLabels, { inactive: true, compact: true });
  assert.match(list, /Inativo/);
  assert.match(list, /ss-ice/);
  assert.match(list, /<span>Inativo<\/span>/);
  assert.doesNotMatch(list, /ss-usg|mtg-deck-category-button/);
});

test('Inativo no perfil usa Ice Age ao lado das categorias, somente ícone com tooltip acessível', () => {
  const html = render(DeckLabels, { categories: ['tribal'], inactive: true, compact: true, statusIconOnly: true, onCategoryClick: () => {} });
  assert.match(html, /ss-ice/);
  assert.match(html, /ss-lrw/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-tooltip="Inativo · Ice Age"/);
  assert.match(html, /aria-label="Inativo — não é exigido em Slayer ou Combobreaker/);
  assert.doesNotMatch(html, /<span>Inativo<\/span>|<span>Tribal<\/span>|apenas um marcador/);
});

test('Ice Age some ao reativar e não substitui o aviso de deck excluído', () => {
  assert.equal(render(DeckLabels, { inactive: false }), '');
  const deleted = render(DeckLabels, { inactive: true, deleted: true });
  assert.match(deleted, /Excluído/);
  assert.doesNotMatch(deleted, /ss-ice/);
});

test('seletor pessoal usa Mítico e botão de escolha, sem exigir classe escrita', () => {
  const html = render(KeyrunePicker, { label: 'Seu símbolo', value: 'ss ss-lrw ss-rare', onChange: () => {} });
  assert.match(html, /ss-lrw ss-mythic ss-grad/);
  assert.match(html, /Escolher símbolo/);
  assert.doesNotMatch(html, /<input/);
});

test('formulário de cadastro não mostra autoria ou PIN antes da confirmação e bloqueia backend antigo', () => {
  const html = render(RegisterPlayer, { enabled: false, usage: [], onRegister: async () => ({ playerId: 'Teste' }) });
  assert.match(html, /Cadastrar jogador/);
  assert.match(html, /<fieldset[^>]*disabled/);
  assert.match(html, /Publique o Apps Script atualizado/);
  assert.doesNotMatch(html, /Cadastrado por|Cadastrado em|initialPin|editor-registration-pin/);
});

const manual = { id: 'manual_id', name: 'Manual de teste', description: 'Realize a condição de teste.', icon: 'star', thresholds: { common: 3, mythic: 10 } };
const directory = { version: 1, manualCatalog: [manual], players: [
  { id: 'Alice', displayName: 'Alícia', achievements: [{ id: 'manual_id', value: 1, target: 3, tier: 'common', progress: 33, manual: true, unlocked: false }] },
  { id: 'Bob', displayName: 'Beto', achievements: [{ id: 'manual_id', value: 3, target: 10, tier: 'common', progress: 30, manual: true, unlocked: true }] },
] };

test('consulta de possuidores fica em controle expansível e não lista quem só tem progresso parcial', () => {
  const html = render(achievementBrowser.AchievementHolders, { directory, achievementId: 'manual_id' });
  assert.match(html, /<details/); assert.match(html, /Ver jogadores que possuem/);
  assert.match(html, /Beto/); assert.doesNotMatch(html, /Alícia/);
  assert.match(html, /sem filtro de período/);
});

test('catálogo mostra condição, requisitos por raridade, ID copiável e comparação por jogador', () => {
  const html = render(achievementBrowser.ManualAchievementCatalog, { directory, initialPlayerId: 'Alice', onClose() {}, onAchievementClick() {} });
  assert.match(html, /<dialog[^>]*aria-label="Catálogo de conquistas manuais"/);
  assert.match(html, /Realize a condição de teste/);
  assert.match(html, /Comum: 3/); assert.match(html, /Mítica: 10/);
  assert.match(html, /<code>manual_id<\/code>/);
  assert.match(html, /Copiar ID manual_id/); assert.match(html, /Pendente/);
  assert.match(html, /CONQUISTAS_MANUAIS/);
  assert.doesNotMatch(html, /Conceder conquista|Salvar conquista/);
});

test('catálogo sem backend atualizado informa indisponibilidade, sem inventar definições', () => {
  const html = render(achievementBrowser.ManualAchievementCatalog, { onClose() {}, onAchievementClick() {} });
  assert.match(html, /updateDashboardCache/);
  assert.doesNotMatch(html, /manual_id/);
  const holders = render(achievementBrowser.AchievementHolders, { achievementId: 'x' });
  assert.match(holders, /Apps Script atualizado/);
  assert.doesNotMatch(holders, /Nenhum jogador possui/);
});

test('modal de conquista separa histórico opcional, inclui consulta global e usa diálogo acessível', () => {
  const achievement = { id: 'manual_id', name: 'Conquista teste', description: 'Descrição', tier: 'common', value: 0, target: 1, progress: 0, icon: 'star', unlocked: false,
    details: { decks: [{ nome: 'Ativo', required: true, locked: true }, { nome: 'Inativo ganho', required: false, inactive: true, locked: false, contextLabel: 'Inativo · vitória histórica (não obrigatório)' }] } };
  const html = render(dashboard.AchievementDetailsModal, { achievement, directory, allAchievements: [], onAchievementClick() {}, onDeckClick() {}, onPlayerClick() {}, onClose() {} });
  assert.match(html, /<dialog[^>]*aria-label="Conquista teste"/);
  assert.match(html, /Vitórias históricas — não obrigatórias/);
  assert.match(html, /Inativo ganho/); assert.match(html, /Ver jogadores que possuem/);
  assert.match(html, /Beto/); assert.doesNotMatch(html, /Alícia/);
});

test('coleção sem ativos explica o estado no modal em vez de mostrar desbloqueio 0/0', () => {
  const achievement = { id: 'x', name: 'Sem ativos', description: '', tier: 'common', value: 0, target: 0, progress: 0, icon: 'star', unlocked: false, deckCollection: true };
  const html = render(dashboard.AchievementDetailsModal, { achievement, allAchievements: [], onAchievementClick() {}, onDeckClick() {}, onPlayerClick() {}, onClose() {} });
  assert.match(html, /Sem decks ativos exigidos/); assert.doesNotMatch(html, /0\/0/);
});

test('perfil sem conquistas ainda permite abrir o catálogo manual', () => {
  const html = render(dashboard.PlayerAchievementsSection, { achievements: [], onAchievementClick() {}, onManualCatalogOpen() {} });
  assert.match(html, /Catálogo de conquistas manuais/);
});
