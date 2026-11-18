import { describe, it, expect } from 'vitest';
import { BattleCore, hospitalFee, type Unit } from '../src/systems/battle/core';
import { BATTLE } from '../src/config/battle';

const unit = (id: string, side: 'ally' | 'enemy', agi: number, extra: Partial<Unit> = {}): Unit => ({
  id, name: id, side, hp: 30, maxHp: 30, sp: 10, maxSp: 10, str: 5, agi, def: 0, attack: 0,
  buff: { str: 0, agi: 0 }, guard: false, nextRollBonus: 0, ...extra,
});

/** 고정 순서로 값을 내는 가짜 랜덤 */
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('민첩 판정', () => {
  it('민첩 차이가 20 이상이면 낮은 쪽은 페널티 없이는 절대 행동하지 못함', () => {
    // 랜덤을 극단으로: 낮은 쪽 최대(0.999), 높은 쪽 최소(0)
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 30)], seq(0.999, 0));
    for (let i = 0; i < 200; i++) {
      const r = b.roll();
      expect(r.winner).toBe('적');
      // 페널티 없이 비교하려고 연속 행동 기록을 지움
      b.lastActor = null;
      b.streak = 0;
    }
  });

  it('무작위로 굴려도 차이 20 이상이면 낮은 쪽이 못 이김', () => {
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 30)]);
    for (let i = 0; i < 2000; i++) {
      expect(b.roll().winner).toBe('적');
    }
  });

  it('연속 행동 페널티가 -5씩 쌓였다가 다른 캐릭터가 행동하면 초기화', () => {
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 10)], () => 0);
    const me = b.get('나');
    expect(b.rollFor(me)).toBe(10);
    b.endAction('나');
    expect(b.rollFor(me)).toBe(10 - BATTLE.consecutivePenalty);
    b.endAction('나');
    expect(b.rollFor(me)).toBe(10 - 2 * BATTLE.consecutivePenalty);
    b.endAction('적'); // 다른 캐릭터가 행동
    expect(b.rollFor(me)).toBe(10);
    expect(b.rollFor(b.get('적'))).toBe(10 - BATTLE.consecutivePenalty);
  });

  it('페널티가 쌓이면 민첩이 높은 쪽도 차례를 넘긴다', () => {
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 18)], () => 0);
    expect(b.roll().winner).toBe('적');
    b.endAction('적');
    expect(b.roll().winner).toBe('적'); // 18-5=13 > 10
    b.endAction('적');
    expect(b.roll().winner).toBe('나'); // 18-10=8 < 10
  });

  it('방어: 피해 감소 + 다음 판정 +5 (한 번만)', () => {
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 10, { str: 10 })], () => 0);
    b.defend('나');
    expect(b.rollFor(b.get('나'))).toBe(10 + BATTLE.defendBonus);
    const full = 10 * BATTLE.damageStrMul;
    expect(b.attack('적', '나')).toBe(Math.floor(full * BATTLE.defendDamageRate));
    b.roll(); // 보너스 소모
    expect(b.rollFor(b.get('나'))).toBe(10);
  });

  it('동점이면 아군 우선', () => {
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 10)], () => 0.5);
    expect(b.roll().winner).toBe('나');
  });

  it('같은 편끼리 동점이면 재판정', () => {
    const b = new BattleCore([unit('적1', 'enemy', 10), unit('적2', 'enemy', 10), unit('나', 'ally', 0)], seq(0.5, 0.5, 0, 0.5, 0.2));
    const r = b.roll();
    expect(r.rerolls).toBeGreaterThan(0);
    expect(['적1', '적2']).toContain(r.winner);
  });

  it('선제 보너스는 첫 판정에만', () => {
    const b = new BattleCore([unit('나', 'ally', 10), unit('적', 'enemy', 15)], () => 0);
    b.firstStrike('ally');
    expect(b.roll().winner).toBe('나'); // 10+10 > 15
    b.lastActor = null;
    b.streak = 0;
    expect(b.roll().winner).toBe('적');
  });

  it('도망은 양쪽 최고 판정값 비교', () => {
    const b = new BattleCore([unit('나', 'ally', 40), unit('적', 'enemy', 10)]);
    expect(b.escape().ok).toBe(true);
  });

  it('치료비: 소지금의 10%, 최소 100연', () => {
    expect(hospitalFee(5000)).toBe(500);
    expect(hospitalFee(500)).toBe(100);
    expect(hospitalFee(40)).toBe(40);
  });
});
