// 메뉴: 소지품 / 상태 / 수첩 / 저장 / 불러오기 / 설정
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { allSlots, readSave, writeSave, type Slot } from '../core/save';
import { saveSettings, settings } from '../core/settings';
import { game } from '../core/state';
import { blocker, button, COLORS, panel, text } from '../ui/widgets';
import type { FieldScene } from './FieldScene';
import type { HudScene } from './HudScene';

const W = DISPLAY.width;
const H = DISPLAY.height;
type Page = 'items' | 'status' | 'notebook' | 'save' | 'load' | 'settings';

export class MenuScene extends Phaser.Scene {
  private body!: Phaser.GameObjects.Container;
  private force = false;

  constructor() {
    super('Menu');
  }

  create(data: { page?: Page; force?: boolean; fromTitle?: boolean }): void {
    this.force = !!data?.force;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0);
    blocker(this, W, H);
    const fromTitle = !!data?.fromTitle;
    const lx = 24;
    const items: [string, () => void][] = fromTitle
      ? [['불러오기', () => this.show('load')]]
      : [
          ['소지품', () => this.show('items')],
          ['상태', () => this.show('status')],
          ['수첩', () => this.show('notebook')],
          ['저장', () => this.show('save')],
          ['불러오기', () => this.show('load')],
          ['설정', () => this.show('settings')],
          ['타이틀로', () => this.toTitle()],
        ];
    panel(this, lx, 20, 210, H - 40);
    items.forEach(([label, fn], i) => this.add.existing(button(this, lx + 16, 40 + i * 70, 178, 60, label, fn, 24)));
    this.add.existing(button(this, lx + 16, H - 100, 178, 60, '닫기', () => this.close(), 24));
    panel(this, 250, 20, W - 270, H - 40);
    this.body = this.add.container(0, 0);
    this.show(data?.page ?? (fromTitle ? 'load' : 'notebook'));
    this.input.keyboard!.on('keydown-X', () => this.close());
    this.input.keyboard!.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    const field = this.scene.get('Field') as FieldScene;
    this.scene.stop();
    if (field?.scene.isActive()) {
      field.menuOpen = false;
      field.events.emit('menuClosed');
    }
  }

  private toTitle(): void {
    (this.scene.get('Field') as FieldScene).toTitle();
  }

  private clear(title: string): { x: number; y: number } {
    this.body.removeAll(true);
    this.body.add(text(this, 280, 40, title, 28, COLORS.accent));
    return { x: 280, y: 96 };
  }

  private line(x: number, y: number, s: string, size = 22, color: string = COLORS.text) {
    const t = text(this, x, y, s, size, color, { wordWrap: { width: W - 330, useAdvancedWrap: true } });
    this.body.add(t);
    return t;
  }

  show(page: Page): void {
    const s = game.state;
    if (page === 'items') {
      const p = this.clear('소지품');
      const list = Object.entries(s.items);
      if (!list.length) this.line(p.x, p.y, '아무것도 없다.', 22, COLORS.dim);
      list.forEach(([n, c], i) => this.line(p.x, p.y + i * 40, `${n}  ×${c}`));
      this.line(p.x, H - 90, `소지금  ${s.money.toLocaleString()}연`, 22, COLORS.accent);
    } else if (page === 'status') {
      const p = this.clear('상태');
      const rows = [
        `${s.party.join(', ')}`,
        `소지금  ${s.money.toLocaleString()}연`,
        `${s.time.day}일차 · ${s.time.period}`,
        `혈중 발현 농도  ${(s.concentration['클로토'] ?? 0).toFixed(1)} mg/dL`,
        '(능력치·전투 정보는 P3에서 추가)',
      ];
      rows.forEach((r, i) => this.line(p.x, p.y + i * 44, r, 22, i === 4 ? COLORS.dim : COLORS.text));
    } else if (page === 'notebook') {
      const p = this.clear('클로토의 수첩 — 퀘스트');
      // 단서·인물·도감 탭은 자리만 (비활성)
      ['단서', '인물', '도감'].forEach((t, i) => this.line(W - 300 + i * 90, 46, t, 20, '#5d5a52'));
      let y = p.y;
      const active = s.questOrder.filter((id) => s.quests[id].status === 'active');
      const done = s.questOrder.filter((id) => s.quests[id].status === 'done');
      if (!active.length && !done.length) this.line(p.x, y, '아직 기록이 없다.', 22, COLORS.dim);
      for (const id of active) {
        this.line(p.x, y, `▶ ${id}`, 24, COLORS.accent);
        this.line(p.x + 30, y + 34, s.quests[id].objective || '…');
        y += 84;
      }
      if (done.length) {
        this.line(p.x, y + 8, '완료', 20, COLORS.dim);
        y += 44;
        for (const id of done) {
          this.line(p.x, y, `✓ ${id}`, 22, COLORS.dim);
          y += 38;
        }
      }
    } else if (page === 'save' || page === 'load') {
      const p = this.clear(page === 'save' ? '저장' : '불러오기');
      const canSave = this.force || settings.menuSave;
      if (page === 'save' && !canSave) {
        this.line(p.x, p.y, '집이나 공중전화에서만 저장할 수 있다.', 22, COLORS.dim);
        return;
      }
      const slots = allSlots().filter((sl) => page === 'load' || sl !== 'auto');
      slots.forEach((sl, i) => {
        const f = readSave(sl);
        const label = `${sl === 'auto' ? '자동' : `슬롯 ${sl}`}   ${f ? `${f.summary}   ${f.savedAt.slice(0, 16).replace('T', ' ')}` : '— 비어 있음 —'}`;
        const b = button(this, p.x, p.y + i * 86, W - 340, 72, label, () => (page === 'save' ? this.doSave(sl) : this.doLoad(sl)), 22);
        if (page === 'load' && !f) b.setEnabled(false);
        this.body.add(b);
      });
    } else if (page === 'settings') {
      const p = this.clear('설정');
      const toggle = (y: number, label: string, get: () => boolean, set: (v: boolean) => void) => {
        const b = button(this, p.x, y, 520, 64, '', () => {
          set(!get());
          saveSettings();
          b.setLabel(`${label}: ${get() ? '켜짐' : '꺼짐'}`);
          (this.scene.get('Hud') as HudScene)?.applySettings?.();
        }, 22);
        b.setLabel(`${label}: ${get() ? '켜짐' : '꺼짐'}`);
        this.body.add(b);
      };
      toggle(p.y, '방향 패드', () => settings.dpad, (v) => (settings.dpad = v));
      toggle(p.y + 80, '메뉴에서 저장 (개발용)', () => settings.menuSave, (v) => (settings.menuSave = v));
      this.line(p.x, p.y + 170, '키보드: 방향키 이동 · Z 조사/넘기기 · X 메뉴 · Shift 빨리 넘기기', 20, COLORS.dim);
    }
  }

  private doSave(sl: Slot): void {
    const field = this.scene.get('Field') as FieldScene;
    writeSave(sl, game.state, field.summary());
    (this.scene.get('Hud') as HudScene)?.showToast('저장했다.');
    this.show('save');
  }

  private doLoad(sl: Slot): void {
    const f = readSave(sl);
    if (!f) return;
    game.state = f.state;
    this.scene.stop();
    const field = this.scene.get('Field') as FieldScene;
    for (const k of ['Hud', 'CG', 'Dialogue', 'Letter']) this.scene.stop(k);
    if (this.scene.isActive('Title')) this.scene.stop('Title');
    if (field.scene.isActive()) field.scene.restart();
    else this.scene.start('Field');
  }
}
