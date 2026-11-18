// 대사창 · 선택지 · 자막
//  - 글자 하나씩 출력, 탭하면 한 번에 출력, 길게 누르면 빨리 넘기기
//  - 화자가 바뀌면 표정 CG 교체, 좌우 배치 지원 (data/portraits.json)
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { DIALOGUE } from '../config/dialogue';
import { portraitSets, resolvePortrait } from '../core/portraits';
import { blocker, button, COLORS, panel, text, type Button } from '../ui/widgets';

const W = DISPLAY.width;
const H = DISPLAY.height;

export class DialogueScene extends Phaser.Scene {
  private box!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private portraitFrame!: Phaser.GameObjects.Graphics;
  private input0!: Phaser.GameObjects.Zone;
  private choiceLayer!: Phaser.GameObjects.Container;
  private subtitleText!: Phaser.GameObjects.Text;

  private full = '';
  private shown = 0;
  private typing = false;
  private resolveSay: (() => void) | null = null;
  private pressAt = 0;
  private holding = false;
  private fast = false;
  private fastTimer = 0;

  constructor() {
    super('Dialogue');
  }

  create(): void {
    const bh = DIALOGUE.boxHeight;
    const m = DIALOGUE.boxMargin;
    const by = H - bh - m;

    // 표정 CG (대사창 뒤)
    this.portraitFrame = this.add.graphics().setVisible(false);
    this.portrait = this.add.image(0, 0, '__DEFAULT').setVisible(false).setOrigin(0.5, 1);

    this.box = this.add.container(0, 0).setVisible(false);
    this.box.add(panel(this, m, by, W - m * 2, bh));
    this.nameText = text(this, m + 28, by + 14, '', DIALOGUE.nameFontSize, COLORS.accent);
    this.bodyText = text(this, m + 28, by + 50, '', DIALOGUE.fontSize, COLORS.text, {
      wordWrap: { width: W - m * 2 - 70, useAdvancedWrap: true },
      lineSpacing: 8,
    });
    this.arrow = text(this, W - m - 36, by + bh - 40, '▼', 20, COLORS.accent).setVisible(false);
    this.box.add([this.nameText, this.bodyText, this.arrow]);
    this.tweens.add({ targets: this.arrow, y: '+=6', duration: 450, yoyo: true, repeat: -1 });

    // 대사 중 화면 어디를 눌러도 넘어가게 (아래 장면으로 터치가 가지 않음)
    this.input0 = blocker(this, W, H).setVisible(false);
    this.input0.disableInteractive();
    this.input0.on('pointerdown', () => {
      this.pressAt = this.time.now;
      this.holding = true;
    });
    this.input0.on('pointerup', () => {
      const long = this.fast;
      this.holding = false;
      this.fast = false;
      if (!long) this.advance();
    });

    this.choiceLayer = this.add.container(0, 0);
    this.subtitleText = text(this, W / 2, H * 0.42, '', 30, COLORS.text, { align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setShadow(2, 2, '#000', 4, false, true);

    const kb = this.input.keyboard!;
    kb.on('keydown-Z', () => this.advance());
    kb.on('keydown-ENTER', () => this.advance());
    kb.on('keydown-SPACE', () => this.advance());
  }

  update(_t: number, dt: number): void {
    // 길게 누르면 빨리 넘기기
    const shift = this.input.keyboard?.checkDown(this.input.keyboard.addKey('SHIFT'), 0) ?? false;
    if (this.holding && !this.fast && this.time.now - this.pressAt > DIALOGUE.fastForwardHoldMs) this.fast = true;
    const fast = this.fast || shift;
    if (this.typing) {
      this.shown = fast ? this.full.length : Math.min(this.full.length, this.shown + (DIALOGUE.charsPerSecond * dt) / 1000);
      this.bodyText.setText(this.full.slice(0, Math.floor(this.shown)));
      if (this.shown >= this.full.length) this.finishTyping();
    } else if (fast && this.resolveSay) {
      this.fastTimer += dt;
      if (this.fastTimer > DIALOGUE.fastForwardDelayMs) this.advance();
    }
  }

  get busy(): boolean {
    return !!this.resolveSay;
  }

  /** 대사 한 줄. speaker 가 없으면 서술(이름 없음) */
  say(speaker: string | undefined, expr: string | undefined, side: 'left' | 'right' | undefined, body: string): Promise<void> {
    this.showPortrait(speaker, expr, side);
    this.nameText.setText(speaker ?? '');
    this.bodyText.setY(this.nameText.y + (speaker ? 36 : 10));
    this.full = body;
    this.shown = 0;
    this.typing = true;
    this.fastTimer = 0;
    this.arrow.setVisible(false);
    this.box.setVisible(true);
    this.input0.setVisible(true).setInteractive();
    return new Promise((res) => (this.resolveSay = res));
  }

  /** 대사창 닫기 (원고 실행이 끝났을 때) */
  close(): void {
    this.box.setVisible(false);
    this.portrait.setVisible(false);
    this.portraitFrame.setVisible(false);
    this.input0.disableInteractive().setVisible(false);
  }

  private finishTyping(): void {
    this.typing = false;
    this.bodyText.setText(this.full);
    this.arrow.setVisible(true);
  }

  private advance(): void {
    if (!this.resolveSay) return;
    if (this.typing) {
      this.finishTyping();
      return;
    }
    const r = this.resolveSay;
    this.resolveSay = null;
    this.fastTimer = 0;
    this.input0.disableInteractive();
    r();
  }

  private showPortrait(speaker?: string, expr?: string, side?: 'left' | 'right'): void {
    const p = speaker && portraitSets[speaker] ? resolvePortrait(speaker, expr) : null;
    if (!p) {
      this.portrait.setVisible(false);
      this.portraitFrame.setVisible(false);
      return;
    }
    const set = portraitSets[speaker!];
    const s = side ?? set.side;
    this.portrait.setTexture(p.texture, p.frame);
    const h = DIALOGUE.portraitHeight * (set.scale ?? 1);
    this.portrait.setScale(h / this.portrait.height);
    const w = this.portrait.displayWidth;
    const by = H - DIALOGUE.boxHeight - DIALOGUE.boxMargin;
    const x = s === 'left' ? 40 + w / 2 : W - 40 - w / 2;
    this.portrait.setPosition(x, by + 4).setVisible(true);
    // 원본 CG에 배경이 있어 액자처럼 테두리를 두른다
    this.portraitFrame.clear();
    this.portraitFrame.lineStyle(3, COLORS.border, 0.9);
    this.portraitFrame.strokeRect(x - w / 2 - 2, by + 4 - h - 2, w + 4, h + 4);
    this.portraitFrame.setVisible(true);
  }

  /** 선택지 2~4개. 고른 번호를 돌려준다 */
  choose(options: string[]): Promise<number> {
    this.choiceLayer.removeAll(true);
    const bw = 560;
    const bh = DIALOGUE.choiceMinHeight;
    const gap = 12;
    const total = options.length * bh + (options.length - 1) * gap;
    const top = H - DIALOGUE.boxHeight - DIALOGUE.boxMargin - 24 - total;
    let sel = 0;
    return new Promise((res) => {
      const buttons: Button[] = [];
      const done = (i: number) => {
        kb.off('keydown-UP', up);
        kb.off('keydown-DOWN', down);
        kb.off('keydown-Z', ok);
        kb.off('keydown-ENTER', ok);
        this.choiceLayer.removeAll(true);
        res(i);
      };
      // 표정 CG와 겹치지 않게 반대쪽으로 비켜 놓는다
      let cx = W / 2;
      if (this.portrait.visible) {
        const pw = this.portrait.displayWidth + 60;
        cx = this.portrait.x > W / 2 ? (W - pw) / 2 : pw + (W - pw) / 2;
      }
      options.forEach((o, i) => {
        const b = button(this, cx - bw / 2, top + i * (bh + gap), bw, bh, o, () => done(i), DIALOGUE.choiceFontSize);
        buttons.push(b);
        this.choiceLayer.add(b);
      });
      const mark = () => buttons.forEach((b, i) => b.setAlpha(i === sel ? 1 : 0.8));
      const kb = this.input.keyboard!;
      const up = () => ((sel = (sel + options.length - 1) % options.length), mark());
      const down = () => ((sel = (sel + 1) % options.length), mark());
      const ok = () => done(sel);
      // 대사창의 Z 처리와 겹치지 않게 다음 프레임부터 받음
      this.time.delayedCall(50, () => {
        kb.on('keydown-UP', up);
        kb.on('keydown-DOWN', down);
        kb.on('keydown-Z', ok);
        kb.on('keydown-ENTER', ok);
      });
      mark();
    });
  }

  /** 화면 가운데 자막 (예: "건년 666년, 노그리아 에리시아") */
  subtitle(s: string, seconds: number = DIALOGUE.subtitleSeconds): Promise<void> {
    this.subtitleText.setText(s).setAlpha(0);
    return new Promise((res) => {
      this.tweens.chain({
        targets: this.subtitleText,
        tweens: [
          { alpha: 1, duration: 500 },
          { alpha: 1, duration: Math.max(0, seconds * 1000 - 1000) },
          { alpha: 0, duration: 500 },
        ],
        onComplete: () => res(),
      });
    });
  }
}
