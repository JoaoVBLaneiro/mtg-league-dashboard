import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementHolders, manualAchievementView, filterManualAchievements } from '../src/achievementDirectory.ts';

const catalog = [
  { id: 'counterspell_your_counterspell', name: 'Permissão Negada', description: 'Countere uma contramágica.', icon: 'shield', thresholds: { common: 3, uncommon: 5, rare: 12, mythic: 30 } },
  { id: 'beginner_precon', name: 'Iniciante', description: 'Tenha um Precon.', icon: 'book', thresholds: { common: 1 } },
  { id: 'rare_only', name: 'Rara', description: 'Condição rara.', icon: 'star', thresholds: { rare: 2, mythic: 4 } },
];
const summary = (id, value, unlocked, tier = 'common') => ({ id, value, unlocked, tier, target: 3, progress: 33, manual: true });
const alice = { id: 'Alice', displayName: 'Alícia', achievements: [summary(catalog[0].id, 1, false), summary(catalog[1].id, 1, true)] };
const bob = { id: 'Bob', displayName: 'Alícia', achievements: [summary(catalog[0].id, 12, true, 'rare')] };
const directory = { version: 1, manualCatalog: catalog, players: [alice, bob,
  { id: 'Carol', displayName: 'Carol', achievements: [summary(catalog[0].id, 5, true, 'uncommon')] }] };

test('possuidores usam ID exato e unlocked, não progresso parcial nem nome da conquista', () => {
  assert.deepEqual(achievementHolders(directory, catalog[0].id).map(item => item.player.id), ['Bob', 'Carol']);
  assert.deepEqual(achievementHolders(directory, 'Permissão Negada'), []);
  assert.deepEqual(achievementHolders(undefined, catalog[0].id), []);
});
test('jogadores com nomes de exibição iguais continuam distintos e IDs repetidos não duplicam', () => {
  const data = { ...directory, players: [...directory.players, { ...alice, achievements: [summary(catalog[0].id, 3, true)] }, bob] };
  const holders = achievementHolders(data, catalog[0].id);
  assert.equal(holders.length, 3);
  assert.ok(holders.some(item => item.player.id === 'Alice'));
  assert.ok(holders.some(item => item.player.id === 'Bob'));
});
test('catálogo distingue progresso parcial de desbloqueio e usa o próximo requisito', () => {
  const pending = manualAchievementView(catalog[0], alice);
  assert.equal(pending.unlocked, false); assert.equal(pending.value, 1); assert.equal(pending.target, 3);
  const owned = manualAchievementView(catalog[0], bob);
  assert.equal(owned.unlocked, true); assert.equal(owned.tier, 'rare'); assert.equal(owned.target, 30);
  assert.equal(owned.comparisonPlayer, 'Alícia');
});
test('manuais sem concessões e com primeira raridade Rara ficam visíveis e pendentes', () => {
  const view = manualAchievementView(catalog[2], alice);
  assert.equal(view.value, 0); assert.equal(view.unlocked, false); assert.equal(view.target, 2);
  const preview = manualAchievementView(catalog[0]);
  assert.equal(preview.catalogPreview, true); assert.equal(preview.comparisonPlayer, '');
});
test('progresso acima do máximo é limitado a 100% e mantém todos os registros', () => {
  const player = { ...bob, achievements: [summary(catalog[0].id, 50, true, 'mythic')] };
  const view = manualAchievementView(catalog[0], player);
  assert.equal(view.target, 30); assert.equal(view.value, 50); assert.equal(view.progress, 100);
});
test('busca manual aceita nome sem acentos, condição ou ID interno', () => {
  for (const query of ['permissao', 'contramagica', 'counterspell_your_counterspell']) {
    assert.deepEqual(filterManualAchievements(catalog, query, 'all').map(item => item.id), [catalog[0].id]);
  }
  assert.deepEqual(filterManualAchievements(catalog, 'nao existe', 'all'), []);
});
test('filtros por jogador mostram apenas desbloqueadas ou pendentes, incluindo manuais nunca concedidas', () => {
  assert.deepEqual(filterManualAchievements(catalog, '', 'owned', alice).map(item => item.id), ['beginner_precon']);
  assert.equal(filterManualAchievements(catalog, '', 'missing', alice).length, 2);
  assert.equal(filterManualAchievements(catalog, '', 'all', alice).length, catalog.length);
});
