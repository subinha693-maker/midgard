// 필드 조작 화면: 조이스틱(왼쪽 아래), 조사·달리기 버튼(오른쪽 아래), 메뉴 버튼(오른쪽 위), 제한 시간 표시
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { FIELD } from '../config/field';
import { game, type Dir } from '../core/state';
import { settings } from '../core/settings';
import { button, COLORS, text } from '../ui/widgets';

const W = DISPLAY.width;
const H = DISPLAY.height;

type EvData = Phaser.Types.Input.EventData;

export class HudScene extends Phaser.Scene {
  /** 조이스틱으로 기울인 방향 */
  dir: Dir | null = null;
  /** 달리기 버튼을 누르고 있는지 */
  running = false;
  private padLayer!: Phaser.GameObjects.Container;
  private actionBtn!: Phaser.GameObjects.Container;
  private runBtn!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private padPointer: number | null = null;
  private runPointer: number | null = null;
  private controlsOn = true;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.makeJoystick();
    this.makeButtons();
    this.add.existing(button(this, W - 130, 14, 116, 56, '≡ 메뉴', () => this.events.emit('menu'), 22));
    this.toast = text(this, W / 2, 40, '', 24, COLORS.text, { backgroundColor: '#000000aa', padding: { x: 16, y: 8 } })
      .setOrigin(0.5)
      .setAlpha(0);
    this.timerText = text(this, W / 2, 96, '', 30, '#ffe08a', { backgroundColor: '#000000aa', padding: { x: 14, y: 6 } })
      .setOrigin(0.5)
      .setVisible(false);
    this.applySettings();
  }

  /** 조이스틱: 원을 누른 채 끌면 손잡이가 따라가고, 기울인 방향으로 걷는다 */
  private makeJoystick(): void {
    const R = FIELD.joystickRadius;
    const cx = 36 + R;
    const cy = H - 36 - R;
    this.padLayer = this.add.container(0, 0);
    const base = this.add.graphics();
    base.fillStyle(0x000000, 0.28);
    base.fillCircle(cx, cy, R);
    base.lineStyle(3, 0xffffff, 0.35);
    base.strokeCircle(cx, cy, R);
    // 네 방향 눈금
    base.fillStyle(0xffffff, 0.35);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) base.fillCircle(cx + dx * (R - 14), cy + dy * (R - 14), 4);
    const knob = this.add.graphics();
    const drawKnob = (active: boolean) => {
      knob.clear();
      knob.fillStyle(0xffffff, active ? 0.55 : 0.35);
      knob.fillCircle(0, 0, R * 0.42);
      knob.lineStyle(3, COLORS.border, active ? 0.9 : 0.5);
      knob.strokeCircle(0, 0, R * 0.42);
    };
    drawKnob(false);
    knob.setPosition(cx, cy);
    // 손가락이 조금 밖으로 나가도 잡히게 넓은 영역
    const zone = this.add.zone(cx, cy, R * 2 + 70, R * 2 + 70).setInteractive();
    const update = (p: Phaser.Input.Pointer) => {
      let dx = p.x - cx;
      let dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.setPosition(cx + dx, cy + dy);
      if (d < FIELD.joystickDeadZone) {
        this.dir = null;
        return;
      }
      // 대각선 근처에서는 직전 방향을 유지해 흔들리지 않게
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const horiz = this.dir === 'left' || this.dir === 'right';
      const bias = 1.25;
      const useX = horiz ? ax * bias > ay : ax > ay * bias;
      this.dir = useX ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    };
    const release = () => {
      this.padPointer = null;
      this.dir = null;
      knob.setPosition(cx, cy);
      drawKnob(false);
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: EvData) => {
      ev.stopPropagation();
      this.padPointer = p.id;
      drawKnob(true);
      update(p);
    });
    // 조이스틱 위에서 손을 떼도 멈추게 (이 이벤트는 아래로 전달되지 않으므로 여기서 직접 처리)
    zone.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: EvData) => {
      ev.stopPropagation();
      if (p.id === this.padPointer) release();
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.padPointer && p.isDown) update(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.padPointer) release();
      if (p.id === this.runPointer) {
        this.runPointer = null;
        this.running = false;
      }
    });
    this.input.on('gameout', release);
    this.padLayer.add([base, knob, zone]);
  }

  private roundButton(x: number, y: number, size: number, label: string): { c: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone } {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.lineStyle(3, COLORS.border, 0.8);
    g.strokeCircle(size / 2, size / 2, size / 2);
    const t = text(this, size / 2, size / 2, label, size > 80 ? 24 : 20).setOrigin(0.5);
    const zone = this.add.zone(size / 2, size / 2, size + 16, size + 16).setInteractive();
    zone.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: EvData) => ev.stopPropagation());
    c.add([g, t, zone]);
    return { c, zone };
  }

  private makeButtons(): void {
    const a = FIELD.actionButtonSize;
    const act = this.roundButton(W - 30 - a, H - 40 - a, a, '조사');
    act.zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: EvData) => {
      ev.stopPropagation();
      this.events.emit('action');
    });
    this.actionBtn = act.c;
    const r = 76;
    const run = this.roundButton(W - 30 - a - r + 6, H - 40 - a - r - 4, r, '달리기');
    run.zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: EvData) => {
      ev.stopPropagation();
      this.runPointer = p.id;
      this.running = true;
    });
    run.zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.runPointer) {
        this.runPointer = null;
        this.running = false;
      }
    });
    this.runBtn = run.c;
  }

  update(): void {
    // 달리기 버튼은 M05 추격 튜토리얼에서 열린다
    this.runBtn.setVisible(this.controlsOn && settings.dpad && !!game.state.flags['달리기_해금']);
  }

  applySettings(): void {
    this.padLayer.setVisible(this.controlsOn && settings.dpad);
    this.actionBtn.setVisible(this.controlsOn && settings.dpad);
    if (!settings.dpad) this.dir = null;
  }

  /** 필드 조작을 잠시 숨김 (컷신 중) */
  setControlsVisible(on: boolean): void {
    this.controlsOn = on;
    if (!on) {
      this.dir = null;
      this.running = false;
    }
    this.applySettings();
  }

  /** 화면 위에 잠깐 뜨는 알림 (맵 이름, 저장됨 등) */
  showToast(s: string, ms = 1600): void {
    this.toast.setText(s);
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: ms, duration: 400 });
  }

  /** 제한 시간 표시 (null 이면 숨김) */
  setTimer(sec: number | null): void {
    if (sec === null) this.timerText.setVisible(false);
    else this.timerText.setText(`남은 시간 ${Math.ceil(sec)}초`).setVisible(true);
  }
}
