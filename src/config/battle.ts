// [제안] 전투 수치 — 모두 여기서 바꾼다
export const BATTLE = {
  // 판정값 = 민첩 + 랜덤. "랜덤(0~20)"을 0 이상 20 미만 정수(0~19)로 해석한다.
  // → 민첩 차이가 20 이상이면 낮은 쪽은 페널티·보너스 없이는 절대 이기지 못한다.
  rollRange: 20,
  consecutivePenalty: 5, // 같은 캐릭터가 연속 행동할 때마다 다음 판정 -5 누적
  defendBonus: 5, // 방어 → 다음 판정 +5
  defendDamageRate: 0.5, // 방어 중 받는 피해 배율
  firstStrikeBonus: 10, // 등 뒤 접촉 선제 보너스 (첫 판정)
  // 피해 = 근력×2 + 무기 공격력 - 방어 + 랜덤(0~3), 최소 1
  damageStrMul: 2,
  damageRandom: 3,
  panicRollPenalty: 10, // SP 0 → 패닉: 판정 -10, 공격 50% 빗나감
  panicMissChance: 0.5,
  maxRerolls: 20, // 같은 편끼리 동점 재판정 한도
  rollShowMs: 450, // 판정 연출 시간 (0.5초 이하, 탭하면 건너뜀)
  hospitalFeeRate: 0.1, // 쓰러지면 치료비 = 소지금의 10%
  hospitalFeeMin: 100, // 최소 100연
};
