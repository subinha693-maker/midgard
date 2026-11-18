// 민첩 판정 전투 — 화면과 분리된 순수 로직 [확정 개념 / 수치는 src/config/battle.ts]
//
// 행동 순서를 미리 정하지 않고 행동 한 칸마다 판정한다.
//  1. 살아 있는 모든 아군·적이 판정값 = 민첩 + 랜덤(0~19) 을 굴리고, 가장 높은 하나가 행동한다.
//  2. 같은 캐릭터가 연속 행동할수록 다음 판정 -5 누적. 다른 캐릭터가 행동하면 초기화.
//  3. 방어: 피해 감소 + 다음 판정 +5.
//  4. 동점: 아군 우선. 같은 편끼리 동점이면 그들끼리 재판정.
//  5. 도망: 아군 최고 판정값 vs 적 최고 판정값.
import { BATTLE } from '../../config/battle';

export type Side = 'ally' | 'enemy';

export interface Unit {
  id: string;
  name: string;
  side: Side;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  str: number;
  agi: number;
  def: number;
  attack: number; // 무기 공격력
  buff: { str: number; agi: number }; // 캡슐 등 일시 버프 (전투 끝나면 사라짐)
  guard: boolean; // 방어 중 (자기 다음 행동까지)
  nextRollBonus: number; // 다음 판정 1회 보너스 (방어 +5, 선제 +10)
}

export type Rng = () => number; // 0 이상 1 미만

export const alive = (u: Unit) => u.hp > 0;
export const panic = (u: Unit) => u.side === 'ally' && u.sp <= 0;

export interface RollResult {
  rolls: Record<string, number>; // 유닛별 최종 판정값 (재판정 포함 마지막 값)
  winner: string;
  rerolls: number;
}

export class BattleCore {
  lastActor: string | null = null;
  streak = 0; // lastActor 의 연속 행동 수
  turn = 0;

  constructor(public units: Unit[], private rng: Rng = Math.random) {}

  get allies() {
    return this.units.filter((u) => u.side === 'ally');
  }
  get enemies() {
    return this.units.filter((u) => u.side === 'enemy');
  }
  get(id: string): Unit {
    return this.units.find((u) => u.id === id)!;
  }

  /** 선제 보너스: 필드에서 등 뒤로 접촉 (이번엔 인자로만 받음) */
  firstStrike(side: Side | null): void {
    if (!side) return;
    for (const u of this.units) if (u.side === side) u.nextRollBonus += BATTLE.firstStrikeBonus;
  }

  randRoll(): number {
    return Math.floor(this.rng() * BATTLE.rollRange);
  }

  /** 페널티·보너스를 반영한 판정값 */
  rollFor(u: Unit): number {
    let v = u.agi + u.buff.agi + this.randRoll() + u.nextRollBonus;
    if (u.id === this.lastActor) v -= this.streak * BATTLE.consecutivePenalty;
    if (panic(u)) v -= BATTLE.panicRollPenalty;
    return v;
  }

  /** 다음 행동자 정하기 */
  roll(): RollResult {
    const live = this.units.filter(alive);
    const rolls: Record<string, number> = {};
    for (const u of live) rolls[u.id] = this.rollFor(u);
    // 보너스는 한 번 쓰면 사라짐
    for (const u of live) u.nextRollBonus = 0;

    let tied = this.topOf(live, rolls);
    let rerolls = 0;
    // 동점: 아군 우선
    if (tied.length > 1 && tied.some((u) => u.side === 'ally')) tied = tied.filter((u) => u.side === 'ally');
    // 같은 편끼리 동점 → 그들끼리 재판정
    while (tied.length > 1 && rerolls < BATTLE.maxRerolls) {
      rerolls++;
      for (const u of tied) rolls[u.id] = this.rollFor(u);
      tied = this.topOf(tied, rolls);
    }
    return { rolls, winner: tied[0].id, rerolls };
  }

  private topOf(list: Unit[], rolls: Record<string, number>): Unit[] {
    const best = Math.max(...list.map((u) => rolls[u.id]));
    return list.filter((u) => rolls[u.id] === best);
  }

  /** 행동이 끝났을 때: 연속 행동 기록, 방어 해제 */
  endAction(actorId: string): void {
    if (this.lastActor === actorId) this.streak++;
    else {
      this.lastActor = actorId;
      this.streak = 1;
    }
    this.turn++;
  }

  /** 행동 시작: 자기 방어 자세는 풀린다 */
  beginAction(actorId: string): void {
    this.get(actorId).guard = false;
  }

  /** 공격. 피해량(0 = 빗나감)을 돌려준다 */
  attack(attackerId: string, targetId: string): number {
    const a = this.get(attackerId);
    const t = this.get(targetId);
    if (panic(a) && this.rng() < BATTLE.panicMissChance) return 0;
    let dmg = (a.str + a.buff.str) * BATTLE.damageStrMul + a.attack - t.def + Math.floor(this.rng() * (BATTLE.damageRandom + 1));
    dmg = Math.max(1, dmg);
    if (t.guard) dmg = Math.max(1, Math.floor(dmg * BATTLE.defendDamageRate));
    t.hp = Math.max(0, t.hp - dmg);
    return dmg;
  }

  defend(id: string): void {
    const u = this.get(id);
    u.guard = true;
    u.nextRollBonus += BATTLE.defendBonus;
  }

  /** 도망: 아군 최고 판정값 ≥ 적 최고 판정값이면 성공 */
  escape(): { ok: boolean; ally: number; enemy: number } {
    const best = (list: Unit[]) => Math.max(...list.filter(alive).map((u) => u.agi + u.buff.agi + this.randRoll()));
    const ally = best(this.allies);
    const enemy = best(this.enemies);
    return { ok: ally >= enemy, ally, enemy };
  }

  outcome(): 'win' | 'lose' | null {
    if (!this.enemies.some(alive)) return 'win';
    if (!this.allies.some(alive)) return 'lose';
    return null;
  }

  /** 적 AI: 살아 있는 아군 중 무작위 하나를 공격 */
  enemyTarget(): string {
    const list = this.allies.filter(alive);
    return list[Math.floor(this.rng() * list.length)].id;
  }
}

/** 치료비: 소지금의 10%, 최소 100연 (가진 돈보다 많이 가져가지는 않음) [제안] */
export function hospitalFee(money: number): number {
  return Math.min(money, Math.max(BATTLE.hospitalFeeMin, Math.floor(money * BATTLE.hospitalFeeRate)));
}
