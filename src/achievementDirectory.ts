export type AchievementTier = "common" | "uncommon" | "rare" | "mythic" | "legendary";
export const ACHIEVEMENT_TIERS: AchievementTier[] = ["common", "uncommon", "rare", "mythic", "legendary"];
export const TIER_LABELS: Record<AchievementTier, string> = {
  common: "Comum", uncommon: "Incomum", rare: "Rara", mythic: "Mítica", legendary: "Lendária",
};
export type AchievementSummary = {
  id: string; value: number; target: number; progress: number;
  tier: AchievementTier; unlocked: boolean; manual: boolean;
};
export type AchievementDirectoryPlayer = {
  id: string; displayName: string; photoUrl?: string; keyruneClass?: string;
  achievements: AchievementSummary[];
};
export type ManualAchievementDefinition = {
  id: string; name: string; description: string; icon: string; scryfallUrl?: string;
  thresholds: Partial<Record<AchievementTier, number>>;
};
export type AchievementDirectory = {
  version: number; players: AchievementDirectoryPlayer[]; manualCatalog: ManualAchievementDefinition[];
};
export type ManualAchievementView = AchievementSummary & {
  name: string; description: string; icon: string; scryfallUrl?: string;
  catalogPreview: boolean; comparisonPlayer: string;
};

export function achievementHolders(directory: AchievementDirectory | undefined, id: string) {
  const unique = new Map<string, { player: AchievementDirectoryPlayer; achievement: AchievementSummary }>();
  for (const player of directory?.players || []) {
    const achievement = player.achievements.find(item => item.id === id && item.unlocked === true);
    if (achievement) unique.set(player.id, { player, achievement });
  }
  return [...unique.values()].sort((a, b) =>
    ACHIEVEMENT_TIERS.indexOf(b.achievement.tier) - ACHIEVEMENT_TIERS.indexOf(a.achievement.tier)
    || a.player.displayName.localeCompare(b.player.displayName, 'pt-BR') || a.player.id.localeCompare(b.player.id));
}

export function manualAchievementView(template: ManualAchievementDefinition, player?: AchievementDirectoryPlayer): ManualAchievementView {
  const saved = player?.achievements.find(item => item.id === template.id && item.manual === true);
  const value = Math.max(0, Number(saved?.value) || 0);
  const thresholds = ACHIEVEMENT_TIERS.filter(tier => Number(template.thresholds[tier]) > 0);
  const next = thresholds.find(tier => value < Number(template.thresholds[tier])) || thresholds.at(-1);
  const target = next ? Number(template.thresholds[next]) : 1;
  return {
    id: template.id, name: template.name, description: template.description, icon: template.icon,
    scryfallUrl: template.scryfallUrl, manual: true, value, target,
    catalogPreview: true, comparisonPlayer: player?.displayName || '',
    tier: saved?.tier || 'common', unlocked: saved?.unlocked === true,
    progress: target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0,
  };
}

export function filterManualAchievements(catalog: ManualAchievementDefinition[], query: string,
  status: 'all' | 'owned' | 'missing', player?: AchievementDirectoryPlayer) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return catalog.filter(item => {
    const text = normalize(`${item.name} ${item.id} ${item.description}`);
    const unlocked = manualAchievementView(item, player).unlocked;
    return words.every(word => text.includes(word)) && (status === 'all' || (status === 'owned' ? unlocked : !unlocked));
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
