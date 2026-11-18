// 화면 전체 연출 층: 페이드(암전), 일러스트 CG 표시
// 순서: 필드 < HUD < 이 층 < 대사창 < 편지 < 메뉴
import Phaser from 'phaser';
import illustrationData from '../../data/illustrations.json';
import { DISPLAY } from '../config/display';
import { assetUrl } from '../core/assets';
import { devWarn } from '../core/debug';

const W = DISPLAY.width;
const H = DISPLAY.height;
const ILL = (illustrationData as unknown as { illustrations: Record<string, { file: string; fit: 'contain' | 'cover' }> }).illustrations;

export function preloadIllustrations(scene: Phaser.Scene): void {
  for (const [k, v] of Object.entries(ILL)) {
    const url = assetUrl(v.file);
    if (url) scene.load.image('cg:' + k, url);
    else devWarn('일러스트 파일 없음:', v.file);
  }
}

export class CGScene extends Phaser.Scene {
  private shade!: Phaser.GameObjects.Rectangle;
  private cgBack!: Phaser.GameObjects.Rectangle;
  private cg!: Phaser.GameObjects.Image;

  constructor() {
    super('CG');
  }

  create(): void {
    this.cgBack = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0);
    this.cg = this.add.image(W / 2, H / 2, '__DEFAULT').setAlpha(0);
    this.shade = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0);
  }

  /** 페이드: out = 화면을 덮음, in = 걷어냄 */
  fade(dir: 'in' | 'out', seconds = 0.5, color = 0x000000): Promise<void> {
    this.shade.setFillStyle(color);
    if (seconds <= 0) {
      this.shade.setAlpha(dir === 'out' ? 1 : 0);
      return Promise.resolve();
    }
    return new Promise((res) =>
      this.tweens.add({ targets: this.shade, alpha: dir === 'out' ? 1 : 0, duration: seconds * 1000, onComplete: () => res() }),
    );
  }

  get isBlack(): boolean {
    return this.shade.alpha > 0.99;
  }

  showCG(key: string, seconds = 0.6): Promise<void> {
    const t = 'cg:' + key;
    if (!this.textures.exists(t)) {
      devWarn('일러스트 키 없음:', key);
      return Promise.resolve();
    }
    this.cg.setTexture(t);
    const fit = ILL[key]?.fit ?? 'contain';
    const sx = W / this.cg.width;
    const sy = H / this.cg.height;
    this.cg.setScale(fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy));
    return new Promise((res) =>
      this.tweens.add({ targets: [this.cg, this.cgBack], alpha: 1, duration: seconds * 1000, onComplete: () => res() }),
    );
  }

  hideCG(seconds = 0.6): Promise<void> {
    return new Promise((res) =>
      this.tweens.add({ targets: [this.cg, this.cgBack], alpha: 0, duration: seconds * 1000, onComplete: () => res() }),
    );
  }
}
