// 편지 창 — 종이 질감 배경, 손글씨 느낌의 넓은 줄 간격. 긴 글은 위아래로 밀어 읽는다.
// 생일 메모(M01 끝, M02 다시 읽기)에서 같은 화면을 쓴다. 강조할 줄을 주면 그 줄만 밝게 표시.
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { blocker, clearObjects, SERIF, text } from '../ui/widgets';

const W = DISPLAY.width;
const H = DISPLAY.height;

export class LetterScene extends Phaser.Scene {
  constructor() {
    super('Letter');
  }

  /** 편지를 보여 주고, 탭하면 닫힌다 */
  open(body: string, highlight?: string): Promise<void> {
    clearObjects([...this.children.list]);
    const pw = Math.min(860, W - 80);
    const ph = H - 70;
    const px = (W - pw) / 2;
    const py = 22;

    this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0);
    // 종이: 미색 바탕 + 얼룩 + 가로줄
    const g = this.add.graphics();
    g.fillStyle(0xeee3c8, 1);
    g.fillRect(px, py, pw, ph);
    const rnd = new Phaser.Math.RandomDataGenerator(['letter']);
    for (let i = 0; i < 90; i++) {
      g.fillStyle(0xd9cba8, rnd.realInRange(0.15, 0.4));
      g.fillCircle(px + rnd.between(0, pw), py + rnd.between(0, ph), rnd.between(2, 14));
    }
    g.lineStyle(1, 0xb9a988, 0.5);
    const lineH = 44;
    for (let y = py + 60; y < py + ph - 20; y += lineH) g.lineBetween(px + 30, y, px + pw - 30, y);
    g.lineStyle(2, 0xa8956c, 0.8);
    g.strokeRect(px + 2, py + 2, pw - 4, ph - 4);

    const content = this.add.container(0, 0);
    const lines = body.split('\n');
    const style = { fontFamily: SERIF, fontSize: '25px', color: '#2c241a', wordWrap: { width: pw - 90, useAdvancedWrap: true }, lineSpacing: lineH - 30 };
    let y = py + 26;
    for (const ln of lines) {
      const isHi = highlight !== undefined && ln.includes(highlight);
      const t = this.add.text(px + 45, y, ln, { ...style, color: highlight !== undefined && !isHi ? '#8d826c' : '#2c241a' });
      if (isHi) {
        const hb = this.add.rectangle(px + 36, y - 4, pw - 72, t.height + 8, 0xfff2a8, 0.75).setOrigin(0);
        content.add(hb);
      }
      content.add(t);
      y += Math.ceil(t.height / lineH) * lineH;
    }
    const contentH = y - py;
    const maskG = this.make.graphics({}, false).fillRect(px, py + 6, pw, ph - 12);
    content.setMask(maskG.createGeometryMask());

    const hint = text(this, W / 2, H - 22, '눌러서 닫기 · 위아래로 밀어 읽기', 18, '#d8ccb0').setOrigin(0.5);
    hint.setAlpha(0.8);

    return new Promise((res) => {
      let startY = 0;
      let startC = 0;
      let moved = false;
      const minC = Math.min(0, ph - 40 - contentH);
      const z = blocker(this, W, H);
      z.on('pointerdown', (p: Phaser.Input.Pointer) => {
        startY = p.y;
        startC = content.y;
        moved = false;
      });
      z.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        const d = p.y - startY;
        if (Math.abs(d) > 8) moved = true;
        content.y = Phaser.Math.Clamp(startC + d, minC, 0);
      });
      z.on('pointerup', () => {
        if (!moved) finish();
      });
      const kb = this.input.keyboard!;
      const finish = () => {
        kb.off('keydown-Z', finish);
        kb.off('keydown-ENTER', finish);
        kb.off('keydown-X', finish);
        clearObjects([...this.children.list]);
        res();
      };
      this.time.delayedCall(250, () => {
        kb.on('keydown-Z', finish);
        kb.on('keydown-ENTER', finish);
        kb.on('keydown-X', finish);
      });
    });
  }
}
