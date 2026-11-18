// [제안] 저장 설정
export const SAVE = {
  slots: 3,
  // 기획상 수동 저장은 집·공중전화에서만 [제안]. 개발 편의를 위해 메뉴 저장 허용 (설정에서 끄기 가능)
  allowMenuSave: true,
  autosaveOnMapChange: true,
  storagePrefix: 'midgard.save.',
} as const;
