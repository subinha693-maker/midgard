// 외부 타일 시트 등록 — 맵의 "rb:1,13" 같은 타일 지정과 data/props.json 소품이 여기 키를 쓴다
import Phaser from 'phaser';
import { assetUrl } from './assets';
import { devWarn } from './debug';

export const SHEETS: Record<string, { file: string; tile: number }> = {
  mi: { file: 'assets/thirdparty/modern_interiors_free/Interiors_free_48x48.png', tile: 48 }, // 가구
  rb: { file: 'assets/thirdparty/modern_interiors_free/Room_Builder_free_48x48.png', tile: 48 }, // 실내 벽·바닥
};

export function preloadSheets(scene: Phaser.Scene): void {
  for (const [k, s] of Object.entries(SHEETS)) {
    const url = assetUrl(s.file);
    if (url) scene.load.image('sheet:' + k, url);
    else devWarn('타일 시트 없음:', s.file);
  }
}
