// 발현 농도 (mg/dL) — 순수 로직
//  - 모든 인물이 0.0~100.0 (소수점 1자리) 값을 가진다.
//  - 캡슐 사용, 이상구 스킬 사용 시 올라간다.
//  - 클로토만(정확히는 actors.json 의 concentrationDecay > 0 인 인물만) 시간대가 바뀔 때 가라앉는다. [확정]
//  - 100 에 닿으면 이상체화 → 게임 오버(배드엔딩). [확정]
import { CONCENTRATION } from '../../config/concentration';
import { ACTORS } from '../../core/db';
import type { GameState } from '../../core/state';

const round1 = (v: number) => Math.round(v * 10) / 10;

export function getConcentration(s: GameState, who: string): number {
  return s.concentration[who] ?? 0;
}

/** 올리거나 내린다. 100 에 닿으면 true 를 돌려준다 */
export function addConcentration(s: GameState, who: string, amount: number): boolean {
  const v = round1(Math.min(CONCENTRATION.max, Math.max(0, getConcentration(s, who) + amount)));
  s.concentration[who] = v;
  return v >= CONCENTRATION.max;
}

export function setConcentration(s: GameState, who: string, value: number): boolean {
  s.concentration[who] = round1(Math.min(CONCENTRATION.max, Math.max(0, value)));
  return s.concentration[who] >= CONCENTRATION.max;
}

/** 시간대가 steps 번 바뀌었을 때 */
export function decayConcentration(s: GameState, steps: number): void {
  for (const who of Object.keys(s.concentration)) {
    const rate = ACTORS[who]?.concentrationDecay ?? 0;
    if (rate > 0) s.concentration[who] = round1(Math.max(0, s.concentration[who] - rate * steps));
  }
}

export function stageOf(value: number): string {
  let label = CONCENTRATION.stages[0].label;
  for (const st of CONCENTRATION.stages) if (value >= st.min) label = st.label;
  return label;
}

export function isAnomalized(s: GameState, who = '클로토'): boolean {
  return getConcentration(s, who) >= CONCENTRATION.max;
}
