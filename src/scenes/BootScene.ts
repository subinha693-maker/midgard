import Phaser from 'phaser';
import { preloadPortraits, registerPortraitFrames } from '../core/portraits';

// 시작 시 공용 에셋 적재
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    preloadPortraits(this);
  }

  create(): void {
    registerPortraitFrames(this);
    this.scene.start('Title');
  }
}
