// 필드 조작 화면: 가상 방향 패드(왼쪽 아래), 조사 버튼(오른쪽 아래), 메뉴 버튼(오른쪽 위)
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { FIELD } from '../config/field';
import type { Dir } from '../core/state';
import { settings } from '../core/settings';
import { button, COLORS, text } from '../ui/widgets';

const W = DISPLAY.width;
const H = DISPLAY.height;

export class HudScene extends Phaser.Scene {
  /** 방향 패드로 누르고 있는 방향 */
  dir: Dir | null = null;
  private padLayer!: Phaser.GameObjects.Container;
  private actionBtn!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private padPointer: number | null = null;

  constructor() {
    super('Hud');
  }

  create(): void {
    const s = FIELD.dpadSize;
    const cx = 30 + s / 2;
    const cy = H - 30 - s / 2;
    this.padLayer = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28);
    g.fillCircle(cx, cy, s / 2);
    g.lineStyle(2, 0xffffff, 0.35);
    g.strokeCircle(cx, cy, s / 2);
    const arrows: [string, number, number][] = [
      ['▲', 0, -1],
      ['▼', 0, 1],
      ['◀', -1, 0],
      ['▶', 1, 0],
    ];
    const labels = arrows.map(([a, dx, dy]) => text(this, cx + dx * s * 0.32, cy + dy * s * 0.32, a, 26, '#ffffff').setOrigin(0.5).setAlpha(0.7));
    const zone = this.add.zone(cx, cy, s + 20, s + 20).setInteractive();
    const update = (p: Phaser.Input.Pointer) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (Math.hypot(dx, dy) < 12) {
        this.dir = null;
        return;
      }
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.padPointer = p.id;
      update(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.padPointer && p.isDown) update(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.padPointer) {
        this.padPointer = null;
        this.dir = null;
      }
    });
    zone.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev.stopPropagation());
    this.padLayer.add([g, ...labels, zone]);

    // 조사 버튼
    const a = FIELD.actionButtonSize;
    this.actionBtn = this.add.container(W - 30 - a, H - 40 - a);
    const ag = this.add.graphics();
    ag.fillStyle(0x000000, 0.35);
    ag.fillCircle(a / 2, a / 2, a / 2);
    ag.lineStyle(3, COLORS.border, 0.8);
    ag.strokeCircle(a / 2, a / 2, a / 2);
    const at = text(this, a / 2, a / 2, '조사', 24).setOrigin(0.5);
    const az = this.add.zone(a / 2, a / 2, a + 16, a + 16).setInteractive();
    az.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.events.emit('action');
    });
    az.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev.stopPropagation());
    this.actionBtn.add([ag, at, az]);

    // 메뉴 버튼 (상시)
    this.add.existing(button(this, W - 130, 14, 116, 56, '≡ 메뉴', () => this.events.emit('menu'), 22));

    this.toast = text(this, W / 2, 40, '', 24, COLORS.text, { backgroundColor: '#000000aa', padding: { x: 16, y: 8 } })
      .setOrigin(0.5)
      .setAlpha(0);

    this.applySettings();
  }

  applySettings(): void {
    this.padLayer.setVisible(settings.dpad);
    this.actionBtn.setVisible(settings.dpad);
    if (!settings.dpad) this.dir = null;
  }

  /** 필드 조작을 잠시 숨김 (컷신 중) */
  setControlsVisible(on: boolean): void {
    this.padLayer.setVisible(on && settings.dpad);
    this.actionBtn.setVisible(on && settings.dpad);
  }

  /** 화면 위에 잠깐 뜨는 알림 (맵 이름, 저장됨 등) */
  showToast(s: string, ms = 1600): void {
    this.toast.setText(s);
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: ms, duration: 400 });
  }
}
