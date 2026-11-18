// 공용 화면 부품: 패널, 버튼(손가락으로 누르기 쉬운 크기), 글꼴
import Phaser from 'phaser';

export const FONT = "'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif";
export const SERIF = "'Noto Serif KR', 'AppleMyungjo', 'Batang', serif";

export const COLORS = {
  panel: 0x15171c,
  panelAlpha: 0.92,
  border: 0xc9b98f, // 테두리 문양은 나중에 새로 만들 예정 → 지금은 단순 사각 테두리
  text: '#f2ede0',
  dim: '#a39d8c',
  accent: '#e8c76a',
  hover: 0x2c3140,
};

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 24, color = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, ...extra });
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha: number = COLORS.panelAlpha) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, COLORS.border, 0.9);
  g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  return g;
}

export interface Button extends Phaser.GameObjects.Container {
  setLabel(s: string): void;
  setEnabled(on: boolean): void;
}

/** 누르면 onClick. 아래쪽 장면으로 터치가 새지 않게 막는다 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  size = 24,
): Button {
  const c = scene.add.container(x, y) as Button;
  const bg = scene.add.graphics();
  const draw = (hover: boolean, enabled: boolean) => {
    bg.clear();
    bg.fillStyle(hover ? COLORS.hover : COLORS.panel, enabled ? 0.95 : 0.6);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(2, COLORS.border, enabled ? 0.9 : 0.4);
    bg.strokeRect(1, 1, w - 2, h - 2);
  };
  let enabled = true;
  draw(false, true);
  const t = text(scene, w / 2, h / 2, label, size).setOrigin(0.5);
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => draw(true, enabled));
  zone.on('pointerout', () => draw(false, enabled));
  zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
  });
  zone.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (enabled) onClick();
  });
  c.add([bg, t, zone]);
  c.setLabel = (s: string) => void t.setText(s);
  c.setEnabled = (on: boolean) => {
    enabled = on;
    t.setColor(on ? COLORS.text : COLORS.dim);
    draw(false, on);
  };
  c.setSize(w, h);
  return c;
}

/** 화면 전체를 덮어 아래 장면으로 터치가 가지 않게 하는 막 */
export function blocker(scene: Phaser.Scene, w: number, h: number, onTap?: () => void) {
  const z = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
  z.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev.stopPropagation());
  z.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    onTap?.();
  });
  return z;
}
