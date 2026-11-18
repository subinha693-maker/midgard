import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { DEBUG } from '../core/debug';
import { portraitSets, resolvePortrait } from '../core/portraits';

// 타이틀 화면 (P0: 빈 화면 + 버튼 자리)
export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    const { width: W, height: H } = DISPLAY;
    this.add.text(W / 2, H * 0.36, '미드가르드', {
      fontFamily: 'serif', fontSize: '64px', color: '#e8e2d0',
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.36 + 56, '챕터 1 · 프롤로그', {
      fontFamily: 'serif', fontSize: '22px', color: '#8f8a7c',
    }).setOrigin(0.5);

    const btn = this.add.text(W / 2, H * 0.7, '새 게임', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#ffffff',
      backgroundColor: '#2a2a2a', padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      // TODO(P2): 콜드 오픈 시작
      btn.setText('준비 중 (P2 이후)');
    });

    // 개발 모드: 초상화 연결표가 제대로 잘리는지 확인용 줄
    if (DEBUG) this.showPortraitCheck();
  }

  private showPortraitCheck(): void {
    let x = 8;
    for (const [actor, set] of Object.entries(portraitSets)) {
      for (const expr of Object.keys(set.expressions)) {
        const p = resolvePortrait(actor, expr);
        if (!p) continue;
        const img = this.add.image(x, DISPLAY.height - 4, p.texture, p.frame).setOrigin(0, 1);
        img.setScale(96 / img.height);
        x += img.displayWidth + 2;
      }
      x += 10;
    }
  }
}
