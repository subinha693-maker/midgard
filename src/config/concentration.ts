// [제안] 발현 농도 (mg/dL)
export const CONCENTRATION = {
  max: 100,
  stages: [
    { min: 0, label: '정상' },
    { min: 20, label: '이상구 스킬 강화' },
    { min: 40, label: '법적 발현자' },
    { min: 70, label: '중증' },
    { min: 100, label: '이상체화' },
  ],
  skillUse: 1, // 이상구 스킬 사용 시 +1
  // 클로토 전용 감소 [확정 개념 / 수치 제안]: 시간대가 바뀔 때마다 -2 (하루 -8). actors.json 의 concentrationDecay 로 일반화
};
