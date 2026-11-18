// [제안] 대사창 설정
export const DIALOGUE = {
  charsPerSecond: 40, // 글자 출력 속도
  fastForwardHoldMs: 450, // 이만큼 길게 누르면 빨리 넘기기
  fastForwardDelayMs: 90, // 빨리 넘기기 중 한 대사 표시 시간
  boxHeight: 168,
  boxMargin: 16,
  fontSize: 26,
  nameFontSize: 22,
  portraitHeight: 330, // 대사창 왼쪽에 세우는 표정 CG 높이 (아래는 화면 아래 여백에 맞춤)
  choiceFontSize: 26,
  choiceMinHeight: 64, // 손가락으로 누르기 쉬운 최소 높이
  subtitleSeconds: 2.5,
} as const;
