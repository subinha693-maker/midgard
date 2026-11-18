import { describe, it, expect, beforeEach } from 'vitest';
import { addConcentration, decayConcentration, isAnomalized, stageOf } from '../src/systems/concentration';
import { useItem } from '../src/systems/inventory';
import { newState, type GameState } from '../src/core/state';

let s: GameState;
beforeEach(() => {
  s = newState();
  s.concentration['한스'] = 30; // 다른 인물 (감소 없음)
});

describe('발현 농도', () => {
  it('클로토는 0.0 에서 시작', () => {
    expect(s.concentration['클로토']).toBe(0);
  });

  it('캡슐을 쓰면 오른다', () => {
    s.items['일반 캡슐'] = 1;
    const r = useItem(s, '일반 캡슐', '클로토', null);
    expect(r.ok).toBe(true);
    expect(s.concentration['클로토']).toBe(10);
    expect(s.items['일반 캡슐']).toBeUndefined();
  });

  it('시간대를 넘기면 클로토만 가라앉고, 다른 인물은 그대로', () => {
    addConcentration(s, '클로토', 15);
    decayConcentration(s, 1);
    expect(s.concentration['클로토']).toBe(13);
    expect(s.concentration['한스']).toBe(30);
    decayConcentration(s, 4); // 하루 -8
    expect(s.concentration['클로토']).toBe(5);
    decayConcentration(s, 10);
    expect(s.concentration['클로토']).toBe(0);
  });

  it('가라앉기 전에 한 번에 100 에 닿으면 이상체화 (게임 오버)', () => {
    expect(addConcentration(s, '클로토', 60)).toBe(false);
    expect(addConcentration(s, '클로토', 40)).toBe(true);
    expect(isAnomalized(s)).toBe(true);
    expect(s.concentration['클로토']).toBe(100);
  });

  it('구간 이름', () => {
    expect(stageOf(0)).toBe('정상');
    expect(stageOf(25)).toBe('이상구 스킬 강화');
    expect(stageOf(40)).toBe('법적 발현자');
    expect(stageOf(75)).toBe('중증');
    expect(stageOf(100)).toBe('이상체화');
  });

  it('소수점 1자리', () => {
    addConcentration(s, '클로토', 0.15);
    expect(s.concentration['클로토']).toBe(0.2);
  });
});
