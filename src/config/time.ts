// [제안] 시간대 화면 색조 — 실내 맵(indoor: true)에는 적용하지 않는다
import type { Period } from '../core/state';

export const TIME_TINT: Record<Period, { color: number; alpha: number }> = {
  아침: { color: 0xfff1d6, alpha: 0.18 },
  낮: { color: 0xffffff, alpha: 0 },
  저녁: { color: 0xff9a5c, alpha: 0.32 },
  밤: { color: 0x3a4f8f, alpha: 0.55 }, // 어둡고 푸르게
};
