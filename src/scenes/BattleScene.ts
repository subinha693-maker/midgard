// 전투 화면 — 어두운 배경에 적이 스포트라이트를 받는 프론트뷰 [확정]
//  왼쪽 위 명령창 / 아래쪽 얼굴 초상화 + 상태바(HP·SP·판정값) / 매 행동 전 판정 연출(탭하면 건너뜀)
//  테두리 문양은 나중에 새로 만들 예정 → 지금은 단순한 사각 테두리
import Phaser from 'phaser';
import { BATTLE } from '../config/battle';
import { DISPLAY } from '../config/display';
import { ACTORS, ENEMIES, GROUPS, ITEMS, statsAt, type EnemyDef } from '../core/db';
import { portraitSets } from '../core/portraits';
import { game } from '../core/state';
import { alive, BattleCore, type Side, type Unit } from '../systems/battle/core';
import { canUse, useItem } from '../systems/inventory';
import { blocker, button, COLORS, panel, text, type Button } from '../ui/widgets';

const W = DISPLAY.width;
const H = DISPLAY.height;

export type BattleResult = 'win' | 'lose' | 'escape' | 'anomalized';
export interface BattleData {
  group: string;
  firstStrike?: Side | null;
  canEscape?: boolean;
  onEnd: (r: BattleResult) => void;
}

interface AllyView { w: number; bar: Phaser.GameObjects.Container; hp: Phaser.GameObjects.Graphics; sp: Phaser.GameObjects.Graphics; hpT: Phaser.GameObjects.Text; roll: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Text }
interface EnemyView { img: Phaser.GameObjects.Image; hp: Phaser.GameObjects.Graphics; roll: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; x: number; y: number }

export class BattleScene extends Phaser.Scene {
  private core!: BattleCore;
  private data0!: BattleData;
  private msg!: Phaser.GameObjects.Text;
  private cmdLayer!: Phaser.GameObjects.Container;
  private allyViews = new Map<string, AllyView>();
  private enemyViews = new Map<string, EnemyView>();
  private skip = false;
  private pickTarget: ((id: string) => void) | null = null;

  constructor() {
    super('Battle');
  }

  create(data: BattleData): void {
    this.data0 = data;
    this.allyViews.clear();
    this.enemyViews.clear();
    this.cameras.main.fadeIn(250);

    // 배경
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x07070b, 0x07070b, 0x15151f, 0x15151f, 1);
    bg.fillRect(0, 0, W, H);
    // 탭: 판정 연출 건너뛰기
    blocker(this, W, H, () => (this.skip = true));

    // 유닛 만들기
    const units: Unit[] = [];
    for (const id of game.state.party) {
      const def = ACTORS[id];
      const st = game.state.actors[id];
      if (!def || !st) continue;
      const s = statsAt(def, st.level);
      units.push({
        id, name: def.name, side: 'ally', hp: Math.max(1, st.hp), maxHp: s.hp, sp: st.sp, maxSp: s.sp,
        str: s['근력'], agi: s['민첩'], def: 0, attack: st.weapon ? ITEMS[st.weapon]?.attack ?? 0 : 0,
        buff: { str: 0, agi: 0 }, guard: false, nextRollBonus: 0,
      });
    }
    const g = GROUPS[data.group];
    const enemyDefs = (g?.enemies ?? []).map((k) => ENEMIES[k]).filter(Boolean) as EnemyDef[];
    const count: Record<string, number> = {};
    enemyDefs.forEach((e, i) => {
      count[e.name] = (count[e.name] ?? 0) + 1;
      const dup = enemyDefs.filter((x) => x.name === e.name).length > 1;
      units.push({
        id: `e${i}`, name: dup ? `${e.name} ${'ABCD'[count[e.name] - 1]}` : e.name, side: 'enemy',
        hp: e.hp, maxHp: e.hp, sp: 0, maxSp: 0, str: e['근력'], agi: e['민첩'], def: e['방어'], attack: 0,
        buff: { str: 0, agi: 0 }, guard: false, nextRollBonus: 0,
      });
    });
    this.core = new BattleCore(units);
    this.core.firstStrike(data.firstStrike ?? null);

    // 적: 스포트라이트 + 단색 실루엣 (임시 그래픽)
    const n = enemyDefs.length;
    enemyDefs.forEach((e, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * 260;
      const y = 300;
      const light = this.add.graphics();
      for (let r = 6; r >= 1; r--) {
        light.fillStyle(0xfff4d8, 0.025 * (7 - r));
        light.fillEllipse(x, y + 40, 90 + r * 34, 30 + r * 12);
      }
      light.fillStyle(0xfff4d8, 0.05);
      light.fillTriangle(x, -40, x - 150, y + 60, x + 150, y + 60);
      const key = Object.keys(ENEMIES).find((k) => ENEMIES[k] === e) ?? '';
      const hasImg = this.textures.exists('enemyimg:' + key);
      const img = this.add.image(x, y + 50, hasImg ? 'enemyimg:' + key : this.silhouette(e)).setOrigin(0.5, 1);
      if (hasImg) {
        img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        img.setScale((e.imageHeight ?? 220) / img.height);
      }
      const u = units.find((uu) => uu.id === `e${i}`)!;
      const name = text(this, x, y + 64, u.name, 20, COLORS.text).setOrigin(0.5, 0);
      const hp = this.add.graphics();
      const roll = text(this, x, y + 50 - img.displayHeight - 14, '', 30, COLORS.accent).setOrigin(0.5, 1).setShadow(2, 2, '#000', 3, true, true);
      const zone = this.add.zone(x, y + 50 - img.displayHeight / 2, img.displayWidth + 40, img.displayHeight + 40).setInteractive();
      zone.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        if (this.pickTarget && alive(u)) this.pickTarget(u.id);
      });
      this.enemyViews.set(u.id, { img, hp, roll, name, x, y });
    });

    // 아래 상태바
    const allies = units.filter((u) => u.side === 'ally');
    const bw = Math.min(520, (W - 32) / Math.max(1, allies.length));
    allies.forEach((u, i) => this.makeAllyBar(u, 16 + i * bw, H - 150, bw - 12));

    // 메시지 줄
    panel(this, 260, 16, W - 276, 64, 0.85);
    this.msg = text(this, 284, 48, '', 24).setOrigin(0, 0.5);

    this.cmdLayer = this.add.container(0, 0);
    this.refresh();
    void this.loop();
  }

  // ───────────── 그리기 ─────────────

  /** 적 실루엣 텍스처 (단색). 모양은 enemies.json 의 shape */
  private silhouette(e: EnemyDef): string {
    const key = `enemy:${e.shape}:${e.color}`;
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({}, false);
    const c = Phaser.Display.Color.HexStringToColor(e.color).color;
    g.fillStyle(c, 1);
    g.lineStyle(3, 0x8a8aa0, 0.6);
    if (e.shape === 'cat') {
      // 작은 고양이만 한 엉성한 짐승. 다리 개수가 맞지 않는다
      g.fillEllipse(110, 120, 150, 70);
      g.fillCircle(45, 85, 34);
      g.fillTriangle(22, 62, 30, 30, 48, 58);
      g.fillTriangle(50, 56, 66, 26, 72, 60);
      [40, 66, 92, 120, 150].forEach((x, i) => g.fillRect(x, 140, 9, 30 + (i % 2) * 8));
      g.fillTriangle(180, 110, 205, 60, 190, 120);
      g.fillStyle(0xd84a4a, 1);
      g.fillCircle(36, 82, 4);
      g.generateTexture(key, 215, 180);
    } else if (e.shape === 'dog') {
      // 강아지만 한 원시적 형태. 이빨이 몸 바깥으로 자라 있다
      g.fillEllipse(130, 120, 190, 90);
      g.fillEllipse(48, 92, 80, 64);
      [70, 100, 160, 190].forEach((x) => g.fillRect(x, 150, 14, 46));
      g.fillStyle(0xe8e2d0, 1);
      [[20, 110], [36, 118], [52, 120], [90, 150], [120, 70], [150, 68]].forEach(([x, y]) => g.fillTriangle(x, y, x + 8, y, x + 4, y + 18));
      g.fillStyle(0xd84a4a, 1);
      g.fillCircle(38, 84, 5);
      g.generateTexture(key, 240, 200);
    } else {
      g.fillEllipse(150, 170, 280, 200);
      for (let i = 0; i < 9; i++) g.fillTriangle(30 + i * 30, 110, 45 + i * 30, 20 + (i % 3) * 20, 60 + i * 30, 110);
      g.generateTexture(key, 300, 270);
    }
    g.destroy();
    return key;
  }

  private makeAllyBar(u: Unit, x: number, y: number, w: number): void {
    const c = this.add.container(x, y);
    c.add(panel(this, 0, 0, w, 134));
    // 얼굴: 내 CG를 portraits.json 의 faceCrop 으로 잘라 씀
    const face = this.faceImage(ACTORS[u.id]?.face ?? u.id);
    if (face) {
      face.setPosition(10, 10).setOrigin(0);
      face.setScale(114 / Math.max(face.width, face.height));
      c.add(face);
    }
    const fx = face ? 136 : 16;
    c.add(text(this, fx, 10, u.name, 22, COLORS.accent));
    const hp = this.add.graphics();
    const sp = this.add.graphics();
    const hpT = text(this, fx, 44, '', 18);
    const roll = text(this, w - 14, 10, '', 22, COLORS.text).setOrigin(1, 0);
    const mark = text(this, w - 14, 104, '', 18, COLORS.accent).setOrigin(1, 0);
    c.add([hp, sp, hpT, roll, mark]);
    this.allyViews.set(u.id, { w: w - 136 - 18, bar: c, hp, sp, hpT, roll, mark });
  }

  private faceImage(actor: string): Phaser.GameObjects.Image | null {
    const set = portraitSets[actor];
    if (!set) return null;
    const tkey = `pt:${actor}:${set.default}`;
    if (!this.textures.exists(tkey)) return null;
    const tex = this.textures.get(tkey);
    if (!tex.has('face') && set.faceCrop) {
      const inset = set.removeBg?.inset ?? 0;
      const f = set.faceCrop;
      tex.add('face', 0, Math.max(0, f.x - inset), Math.max(0, f.y - inset), f.w, f.h);
    }
    return this.add.image(0, 0, tkey, tex.has('face') ? 'face' : undefined);
  }

  private refresh(): void {
    for (const u of this.core.allies) {
      const v = this.allyViews.get(u.id);
      if (!v) continue;
      const w = v.w;
      const draw = (g: Phaser.GameObjects.Graphics, y: number, ratio: number, color: number) => {
        g.clear();
        g.fillStyle(0x000000, 0.6);
        g.fillRect(136, y, w, 12);
        g.fillStyle(color, 1);
        g.fillRect(136, y, w * Math.max(0, ratio), 12);
      };
      draw(v.hp, 72, u.hp / u.maxHp, 0x6fbf6a);
      draw(v.sp, 92, u.sp / Math.max(1, u.maxSp), 0x6a8fd8);
      v.hpT.setText(`HP ${u.hp}/${u.maxHp}   SP ${u.sp}/${u.maxSp}${u.sp <= 0 ? '  [패닉]' : ''}${u.guard ? '  [방어]' : ''}`);
    }
    for (const u of this.core.enemies) {
      const v = this.enemyViews.get(u.id);
      if (!v) continue;
      v.hp.clear();
      v.hp.fillStyle(0x000000, 0.6);
      v.hp.fillRect(v.x - 60, v.y + 92, 120, 8);
      v.hp.fillStyle(0xc85a4a, 1);
      v.hp.fillRect(v.x - 60, v.y + 92, 120 * (u.hp / u.maxHp), 8);
      v.img.setAlpha(alive(u) ? 1 : 0.15);
      v.name.setAlpha(alive(u) ? 1 : 0.4);
    }
  }

  // ───────────── 흐름 ─────────────

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, () => res()));
  }

  /** 메시지를 보여 주고 잠깐 기다림 (탭하면 빨리) */
  private async say(s: string, ms = 900): Promise<void> {
    this.msg.setText(s);
    this.skip = false;
    const end = this.time.now + ms;
    while (this.time.now < end && !this.skip) await this.wait(30);
  }

  private async loop(): Promise<void> {
    const names = this.core.enemies.map((u) => u.name).join(', ');
    await this.say(`${names}이(가) 나타났다!`, 1000);
    for (;;) {
      // 판정 연출
      const r = this.core.roll();
      const actor = this.core.get(r.winner);
      for (const u of this.core.units) {
        const v = u.side === 'ally' ? this.allyViews.get(u.id)?.roll : this.enemyViews.get(u.id)?.roll;
        if (!v) continue;
        v.setText(alive(u) ? `${r.rolls[u.id]}` : '');
        v.setColor(u.id === r.winner ? COLORS.accent : '#8a8578');
      }
      for (const [id, v] of this.allyViews) v.mark.setText(id === r.winner ? '▶ 다음 행동' : '');
      this.msg.setText(`판정 — ${actor.name}의 차례${r.rerolls ? ' (재판정)' : ''}`);
      this.skip = false;
      const end = this.time.now + BATTLE.rollShowMs;
      while (this.time.now < end && !this.skip) await this.wait(20);

      this.core.beginAction(actor.id);
      this.refresh();
      const done = actor.side === 'ally' ? await this.allyTurn(actor) : await this.enemyTurn(actor);
      if (done) return;
      this.core.endAction(actor.id);
      this.refresh();
      const out = this.core.outcome();
      if (out === 'win') {
        await this.rewards();
        return this.finish('win');
      }
      if (out === 'lose') return this.finish('lose');
    }
  }

  /** 명령창. 끝났으면(도망·이상체화) true */
  private allyTurn(u: Unit): Promise<boolean> {
    return new Promise((res) => {
      this.cmdLayer.removeAll(true);
      const box = this.add.container(16, 16);
      box.add(panel(this, 0, 0, 220, 5 * 70 + 24));
      const mk = (i: number, label: string, fn: () => void): Button => {
        const b = button(this, 12, 12 + i * 70, 196, 62, label, () => {
          this.cmdLayer.removeAll(true);
          fn();
        }, 24);
        box.add(b);
        return b;
      };
      mk(0, '공격', async () => {
        const t = await this.chooseTarget();
        const dmg = this.core.attack(u.id, t);
        await this.hitEffect(t, dmg);
        await this.say(dmg ? `${u.name}의 공격! ${this.core.get(t).name}에게 ${dmg}의 피해.` : `${u.name}의 공격은 빗나갔다… (패닉)`);
        res(false);
      });
      const skills = ACTORS[u.id]?.skills ?? [];
      mk(1, '기술', () => res(false)).setEnabled(skills.length > 0);
      mk(2, '방어', async () => {
        this.core.defend(u.id);
        this.refresh();
        await this.say(`${u.name}은(는) 몸을 낮춰 방어했다. (다음 판정 +${BATTLE.defendBonus})`);
        res(false);
      });
      const usable = Object.keys(game.state.items).filter(canUse);
      mk(3, '아이템', () => this.itemMenu(u, usable, res)).setEnabled(usable.length > 0);
      const canEscape = this.data0.canEscape !== false;
      mk(4, '도망', async () => {
        const e = this.core.escape();
        if (e.ok) {
          await this.say(`도망쳤다! (판정 ${e.ally} : ${e.enemy})`);
          this.finish('escape');
          res(true);
        } else {
          await this.say(`도망치지 못했다… (판정 ${e.ally} : ${e.enemy})`);
          res(false);
        }
      }).setEnabled(canEscape);
      this.cmdLayer.add(box);
      this.msg.setText(`${u.name}은(는) 어떻게 할까?`);
    });
  }

  private itemMenu(u: Unit, usable: string[], res: (done: boolean) => void): void {
    const box = this.add.container(16, 16);
    box.add(panel(this, 0, 0, 340, (usable.length + 1) * 70 + 24));
    usable.forEach((name, i) => {
      box.add(button(this, 12, 12 + i * 70, 316, 62, `${name} ×${game.state.items[name]}`, async () => {
        this.cmdLayer.removeAll(true);
        const r = useItem(game.state, name, u.id, u);
        for (const m of r.messages) await this.say(m, 1000);
        this.refresh();
        if (r.anomalized) {
          this.finish('anomalized');
          res(true);
        } else res(false);
      }, 22));
    });
    box.add(button(this, 12, 12 + usable.length * 70, 316, 62, '돌아가기', () => {
      this.cmdLayer.removeAll(true);
      void this.allyTurn(u).then(res);
    }, 22));
    this.cmdLayer.add(box);
    void ITEMS;
  }

  /** 살아 있는 적이 하나면 바로, 여럿이면 탭으로 고른다 */
  private chooseTarget(): Promise<string> {
    const live = this.core.enemies.filter(alive);
    if (live.length === 1) return Promise.resolve(live[0].id);
    this.msg.setText('누구를 공격할까? (적을 누른다)');
    return new Promise((res) => {
      const kb = this.input.keyboard!;
      const first = () => done(live[0].id);
      const done = (id: string) => {
        kb.off('keydown-Z', first);
        this.pickTarget = null;
        res(id);
      };
      this.pickTarget = done;
      kb.on('keydown-Z', first);
    });
  }

  private async hitEffect(id: string, dmg: number): Promise<void> {
    const u = this.core.get(id);
    if (u.side === 'enemy') {
      const v = this.enemyViews.get(id)!;
      this.tweens.add({ targets: v.img, x: v.x + 10, duration: 50, yoyo: true, repeat: 2 });
      v.img.setTintFill(0xffffff);
      this.time.delayedCall(90, () => v.img.clearTint());
      const pop = text(this, v.x, v.y - 60, dmg ? `${dmg}` : 'MISS', 34, '#ffffff').setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);
      this.tweens.add({ targets: pop, y: v.y - 110, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
    } else {
      this.cameras.main.shake(180, 0.008);
    }
    this.refresh();
    await this.wait(250);
  }

  private async enemyTurn(u: Unit): Promise<boolean> {
    const t = this.core.enemyTarget();
    const dmg = this.core.attack(u.id, t);
    await this.hitEffect(t, dmg);
    await this.say(`${u.name}의 공격! ${this.core.get(t).name}에게 ${dmg}의 피해.`);
    return false;
  }

  /** 이겼을 때: 경험치·돈, 레벨업 */
  private async rewards(): Promise<void> {
    const g = GROUPS[this.data0.group];
    const defs = (g?.enemies ?? []).map((k) => ENEMIES[k]).filter(Boolean);
    const exp = defs.reduce((a, e) => a + e.exp, 0);
    const money = defs.reduce((a, e) => a + e.money, 0);
    await this.say(`승리! 경험치 ${exp}${money ? `, ${money}연` : ''}`, 1100);
    game.state.money += money;
    for (const u of this.core.allies) {
      const st = game.state.actors[u.id];
      const def = ACTORS[u.id];
      if (!st || !def) continue;
      st.exp += exp;
      while (def.expToNext[st.level] !== undefined && st.exp >= def.expToNext[st.level]) {
        st.level++;
        const ns = statsAt(def, st.level);
        u.maxHp = ns.hp;
        u.hp = Math.min(ns.hp, u.hp + def.growth.hp);
        u.maxSp = ns.sp;
        await this.say(`${u.name}의 레벨이 ${st.level}(으)로 올랐다!`, 1100);
      }
    }
  }

  private finish(r: BattleResult): void {
    // 아군 HP·SP를 게임 상태로 돌려놓는다 (버프는 전투가 끝나면 사라짐)
    for (const u of this.core.allies) {
      const st = game.state.actors[u.id];
      if (st) {
        st.hp = u.hp;
        st.sp = u.sp;
      }
    }
    const cb = this.data0.onEnd;
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      cb(r);
    });
  }
}
