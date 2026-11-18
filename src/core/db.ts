// 게임 DB (data/db/*.json) 읽기
import actorsJson from '../../data/db/actors.json';
import itemsJson from '../../data/db/items.json';
import enemiesJson from '../../data/db/enemies.json';
import questsJson from '../../data/db/quests.json';

export type StatKey = 'hp' | 'sp' | '근력' | '민첩' | '감각' | '화술' | '의지';
export interface ActorDef {
  name: string;
  face?: string;
  level: number;
  stats: Record<StatKey, number>;
  growth: Record<StatKey, number>;
  expToNext: number[];
  skills: string[];
  concentrationDecay: number;
}
export interface ItemDef {
  type: 'key' | 'consumable' | 'capsule' | 'weapon';
  desc: string;
  price?: number;
  attack?: number;
  concentration?: number;
  buff?: Partial<Record<'근력' | '민첩', number>>;
  sideEffectChance?: number;
}
export interface EnemyDef {
  name: string;
  shape: 'cat' | 'dog' | 'blob';
  color: string;
  hp: number;
  근력: number;
  민첩: number;
  방어: number;
  money: number;
  exp: number;
}
export interface GroupDef {
  enemies: string[];
  retry?: boolean; // 프롤로그 시험: 지면 재시험
  scriptedLoss?: string; // 못 이기는 전투: 지면 이 라벨로
}

const strip = <T,>(o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_'))) as Record<string, T>;

export const ACTORS = strip<ActorDef>(actorsJson as Record<string, unknown>);
export const ITEMS = strip<ItemDef>(itemsJson as Record<string, unknown>);
export const ENEMIES = (enemiesJson as unknown as { enemies: Record<string, EnemyDef> }).enemies;
export const GROUPS = (enemiesJson as unknown as { groups: Record<string, GroupDef> }).groups;
export const QUESTS = strip<{ title: string; desc: string }>(questsJson as Record<string, unknown>);

/** 레벨에 따른 능력치 */
export function statsAt(def: ActorDef, level: number): Record<StatKey, number> {
  const out = { ...def.stats };
  for (const k of Object.keys(out) as StatKey[]) out[k] += (def.growth[k] ?? 0) * (level - def.level);
  return out;
}
