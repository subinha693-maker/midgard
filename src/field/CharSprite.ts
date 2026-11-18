// 필드 위 캐릭터 (플레이어·NPC): 격자 좌표, 방향, 한 칸 이동 애니메이션
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { FIELD } from '../config/field';
import type { Dir } from '../core/state';
import { frameName, sheetInfo, type SheetInfo } from '../core/sprites';

const T = DISPLAY.tile;
export const DIR_VEC: Record<Dir, [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };

export class CharSprite {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  dir: Dir;
  moving = false;
  visible = true;
  private sheet: SheetInfo | null = null;
  private isTile = false;
  private animT = 0;
  private animI = 0;

  constructor(private scene: Phaser.Scene, sheetKey: string | undefined, gx: number, gy: number, dir: Dir = 'down') {
    this.gx = gx;
    this.gy = gy;
    this.dir = dir;
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    this.setSheet(sheetKey);
    this.place();
  }

  setSheet(key: string | undefined): void {
    // "tile:이름" → 사람 대신 타일 한 장 (쌓인 신문, 접시 등 조사 대상)
    if (key?.startsWith('tile:')) {
      this.sheet = null;
      this.isTile = true;
      this.sprite.setTexture('tiles', key.slice(5)).setScale(1).setVisible(this.visible);
      return;
    }
    this.isTile = false;
    this.sheet = key ? sheetInfo(key) : null;
    if (this.sheet) {
      this.sprite.setTexture(this.sheet.texture);
      this.sprite.setScale(this.sheet.scale);
      this.sprite.setVisible(this.visible);
    } else this.sprite.setVisible(false);
    this.setFrame(false);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.sprite.setVisible(on && (!!this.sheet || this.isTile));
  }

  face(d: Dir): void {
    this.dir = d;
    this.setFrame(false);
  }

  /** 픽셀 위치를 격자에 맞춤 */
  place(): void {
    this.sprite.setPosition(this.gx * T + T / 2, (this.gy + 1) * T - (this.isTile ? 0 : FIELD.spriteFootOffset));
    this.sprite.setDepth(this.gy * 10 + 5);
  }

  /** 한 칸 이동 (통행 검사는 호출하는 쪽에서) */
  step(d: Dir, speedMul = 1): Promise<void> {
    this.dir = d;
    const [dx, dy] = DIR_VEC[d];
    this.gx += dx;
    this.gy += dy;
    this.moving = true;
    const dur = 1000 / (FIELD.moveSpeed * speedMul);
    return new Promise((res) => {
      this.sprite.setDepth(Math.max(this.gy, this.gy - dy) * 10 + 5);
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.gx * T + T / 2,
        y: (this.gy + 1) * T - FIELD.spriteFootOffset,
        duration: dur,
        onComplete: () => {
          this.moving = false;
          this.place();
          res();
        },
      });
    });
  }

  /** 매 프레임: 걷는 중이면 걷기 프레임을 돌림 */
  update(dt: number, walking: boolean): void {
    if (!this.sheet) return;
    if (walking) {
      this.animT += dt;
      const per = 1000 / FIELD.walkFps;
      if (this.animT >= per) {
        this.animT -= per;
        this.animI = (this.animI + 1) % this.sheet.walk.length;
      }
      this.sprite.setFrame(frameName(this.dir, this.sheet.walk[this.animI]));
    } else {
      this.animT = 0;
      this.setFrame(false);
    }
  }

  private setFrame(walking: boolean): void {
    if (!this.sheet) return;
    const col = walking ? this.sheet.walk[this.animI] : this.sheet.stand;
    this.sprite.setFrame(frameName(this.dir, col));
  }

  front(): [number, number] {
    const [dx, dy] = DIR_VEC[this.dir];
    return [this.gx + dx, this.gy + dy];
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
