import Phaser from 'phaser';
import { preloadPortraits, registerPortraitFrames } from '../core/portraits';
import { buildSprites, preloadSprites } from '../core/sprites';
import { buildTiles } from '../core/tiles';
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
    buildTiles(this);
    this.scene.start('Title');
  }
}
