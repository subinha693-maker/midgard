// 소지품 사용 — 순수 로직. 결과 메시지와 효과를 돌려주고, 화면 쪽에서 보여 준다.
import { ITEMS } from '../../core/db';
import { addItem, type GameState } from '../../core/state';
import { addConcentration } from '../concentration';
import type { Rng, Unit } from '../battle/core';

export interface UseResult {
  ok: boolean;
  messages: string[];
  anomalized: boolean; // 농도 100 도달
}

export function canUse(name: string): boolean {
  const t = ITEMS[name]?.type;
  return t === 'capsule' || t === 'consumable';
}

/**
 * 아이템 사용. 전투 중이면 unit 에 버프를 건다(캡슐 버프는 전투 중에만 효과 [제안]).
 */
export function useItem(s: GameState, name: string, who: string, unit: Unit | null, rng: Rng = Math.random): UseResult {
  const def = ITEMS[name];
  if (!def || !canUse(name) || (s.items[name] ?? 0) <= 0) return { ok: false, messages: ['쓸 수 없다.'], anomalized: false };
  addItem(s, name, -1);
  const msgs = [`${who}은(는) ${name}을(를) 삼켰다.`];
  let anomalized = false;
  if (def.type === 'capsule') {
    anomalized = addConcentration(s, who, def.concentration ?? 0);
    msgs.push(`혈중 발현 농도 +${def.concentration} → ${s.concentration[who].toFixed(1)}`);
    if (unit && def.buff) {
      unit.buff.str += def.buff['근력'] ?? 0;
      unit.buff.agi += def.buff['민첩'] ?? 0;
      msgs.push(`몸이 가벼워진다. (근력 +${def.buff['근력'] ?? 0}, 민첩 +${def.buff['민첩'] ?? 0})`);
    } else if (!unit) msgs.push('(힘이 솟는 느낌은 전투 중에만 쓸모가 있다.)');
    if (def.sideEffectChance && rng() < def.sideEffectChance) {
      // TODO(미정): 싸구려 캡슐 부작용 내용 → 임시로 SP -10
      const a = s.actors[who];
      if (a) a.sp = Math.max(0, a.sp - 10);
      if (unit) unit.sp = Math.max(0, unit.sp - 10);
      msgs.push('속이 뒤집힌다… (부작용: SP -10)');
    }
  }
  return { ok: true, messages: msgs, anomalized };
}
