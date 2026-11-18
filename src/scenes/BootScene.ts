import Phaser from 'phaser';
import { preloadPortraits, registerPortraitFrames } from '../core/portraits';
import { buildSprites, preloadSprites } from '../core/sprites';
import { buildTiles } from '../core/tiles';
import { preloadSheets, SHEETS } from '../core/sheets';
import { sheetTileRefs } from '../scenario/content';
import { PROPS } from '../field/mapdata';
import { preloadIllustrations } from './CGScene';
import { ENEMIES } from '../core/db';
import { assetUrl } from '../core/assets';
import { devWarn } from '../core/debug';

// 시작 시 공용 에셋 적재·가공
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    const t = this.add.text(20, 20, '불러오는 중…', { color: '#888', fontSize: '20px' });
    this.load.on('progress', (v: number) => t.setText(`불러오는 중… ${Math.round(v * 100)}%`));
    preloadPortraits(this);
    preloadSprites(this);
    preloadIllustrations(this);
    preloadSheets(this);
    // 적 그림 (enemies.json 의 image)
    for (const [k, e] of Object.entries(ENEMIES)) {
      if (!e.image) continue;
      const url = assetUrl(e.image);
      if (url) this.load.image('enemyimg:' + k, url);
      else devWarn('적 그림 파일 없음:', e.image);
    }
  }

  create(): void {
    registerPortraitFrames(this);
    buildSprites(this);
    buildTiles(this, sheetTileRefs());
    // 소품 프레임 등록
    for (const [name, d] of Object.entries(PROPS)) {
      const key = 'sheet:' + d.src;
      if (!this.textures.exists(key) || !SHEETS[d.src]) continue;
      this.textures.get(key).add('prop:' + name, 0, ...d.rect);
    }
    this.scene.start('Title');
  }
}
