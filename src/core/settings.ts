// 플레이어 설정 (기기에 저장, 세이브와 별개)
import { FIELD } from '../config/field';
import { SAVE } from '../config/save';

export interface Settings {
  dpad: boolean;
  menuSave: boolean; // 메뉴에서 저장 허용 (기획상 집·공중전화에서만 [제안] → 개발 편의상 기본 허용)
  textSpeed: number; // 배율
}

const KEY = 'midgard.settings';
const defaults: Settings = { dpad: FIELD.dpad, menuSave: SAVE.allowMenuSave, textSpeed: 1 };

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 저장 불가 환경이면 무시 */
  }
}
