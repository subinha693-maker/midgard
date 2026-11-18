// 조건식 평가 — 원고의 @if 와 맵 이벤트 페이지 조건에서 같이 쓴다.
//
//   이름             플래그가 참
//   !이름            플래그가 거짓
//   이름 >= 3        변수 비교 (== != > < >= <=)
//   소지금 >= 100    특수 값: 소지금, 일차, 농도(클로토)
//   아이템:생일 케이크  소지품을 1개 이상 가짐
//   퀘스트:M01        퀘스트가 진행 중이거나 완료
//   완료:M01          퀘스트 완료
//   시간:밤           현재 시간대
//   A && B, A || B   (&& 가 || 보다 먼저 묶임)
import type { GameState } from '../core/state';

const OPS = ['>=', '<=', '==', '!=', '>', '<'] as const;

export class CondError extends Error {}

export function evaluate(expr: string, s: GameState): boolean {
  const e = expr.trim();
  if (!e) return true;
  if (e.includes('||')) return e.split('||').some((p) => evaluate(p, s));
  if (e.includes('&&')) return e.split('&&').every((p) => evaluate(p, s));
  return atom(e, s);
}

function valueOf(name: string, s: GameState): number {
  switch (name) {
    case '소지금':
      return s.money;
    case '일차':
      return s.time.day;
    case '농도':
      return s.concentration['클로토'] ?? 0;
    default:
      return s.vars[name] ?? 0;
  }
}

function atom(e: string, s: GameState): boolean {
  if (e.startsWith('!')) return !atom(e.slice(1).trim(), s);
  for (const op of OPS) {
    const i = e.indexOf(op);
    if (i > 0) {
      const left = valueOf(e.slice(0, i).trim(), s);
      const rightRaw = e.slice(i + op.length).trim();
      const right = Number(rightRaw);
      if (Number.isNaN(right)) throw new CondError(`비교 값이 숫자가 아님: "${e}"`);
      switch (op) {
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==': return left === right;
        case '!=': return left !== right;
        case '>': return left > right;
        case '<': return left < right;
      }
    }
  }
  const colon = e.indexOf(':');
  if (colon > 0) {
    const kind = e.slice(0, colon).trim();
    const arg = e.slice(colon + 1).trim();
    switch (kind) {
      case '아이템': return (s.items[arg] ?? 0) > 0;
      case '퀘스트': return !!s.quests[arg];
      case '완료': return s.quests[arg]?.status === 'done';
      case '시간': return s.time.period === arg;
      default: throw new CondError(`알 수 없는 조건 종류: "${kind}"`);
    }
  }
  return s.flags[e] === true;
}
