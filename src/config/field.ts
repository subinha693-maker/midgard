// [제안] 필드 이동 설정
export const FIELD = {
  moveSpeed: 4.5, // 초당 이동 칸 수
  walkFps: 8, // 걷기 애니메이션 초당 프레임
  spriteHeight: 64, // 걸음 도트의 화면 높이(px). 타일 48px보다 크게 그려 머리가 윗칸에 걸침
  spriteFootOffset: 4, // 발 위치를 타일 아래에서 몇 px 위로 올릴지
  dpad: true, // 조이스틱·버튼 표시 기본값 (설정에서 끄기 가능)
  joystickRadius: 78, // 조이스틱 반지름
  joystickDeadZone: 16, // 가운데에서 이만큼은 반응하지 않음
  runMultiplier: 1.8, // 달리기 속도 배율
  actionButtonSize: 92,
  tapMove: true, // 화면 탭 → 길찾기 이동
  pathMaxNodes: 4000,
} as const;
