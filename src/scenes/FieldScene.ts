// 필드: 맵·캐릭터·이동·이벤트, 그리고 원고 실행기의 화면 쪽 처리(Host)
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { FIELD } from '../config/field';
import { SAVE } from '../config/save';
import { TIME_TINT } from '../config/time';
import { devWarn, DEBUG } from '../core/debug';
import { writeSave } from '../core/save';
import { ACTORS, GROUPS, statsAt } from '../core/db';
import { addConcentration, decayConcentration, setConcentration } from '../systems/concentration';
import { hospitalFee } from '../systems/battle/core';
import type { BattleResult } from './BattleScene';
import { game, type Dir } from '../core/state';
import { TILE_INDEX } from '../core/tiles';
import { CharSprite, DIR_VEC } from '../field/CharSprite';
import { expandRoute, PROPS, type MapData, type MapEvent } from '../field/mapdata';
import { findPath } from '../field/pathfind';
import { evaluate } from '../scenario/cond';
import { letters, library, maps } from '../scenario/content';
import type { Cmd } from '../scenario/parser';
import { Runner, type Host } from '../scenario/runner';
import type { CGScene } from './CGScene';
import type { DialogueScene } from './DialogueScene';
import type { HudScene } from './HudScene';
import type { LetterScene } from './LetterScene';

const T = DISPLAY.tile;
const W = DISPLAY.width;
const H = DISPLAY.height;

const DIR_WORDS: Record<string, Dir> = {
  down: 'down', up: 'up', left: 'left', right: 'right',
  아래: 'down', 위: 'up', 왼쪽: 'left', 오른쪽: 'right',
};

interface Npc {
  ev: MapEvent;
  ch: CharSprite;
  route: string[];
  ri: number;
  waitUntil: number;
  busy: boolean;
}

export class FieldScene extends Phaser.Scene implements Host {
  map!: MapData;
  player!: CharSprite;
  private npcs = new Map<string, Npc>();
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private tilemaps: Phaser.Tilemaps.Tilemap[] = [];
  private propImages: Phaser.GameObjects.Image[] = [];
  runner!: Runner;
  private parallel = new Set<string>();
  private path: { x: number; y: number }[] = [];
  private pendingInteract: { x: number; y: number } | null = null;
  private timeTint!: Phaser.GameObjects.Rectangle;
  private scriptTint!: Phaser.GameObjects.Rectangle;
  private barrel: Phaser.FX.Barrel | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private transferring = false;
  menuOpen = false;
  private autorunGuard = 0;
  private inputCooldownUntil = 0; // 대사를 닫은 키가 바로 다시 조사로 이어지지 않게
  /** 제한 시간 (체력 시험·추격). 원고·메뉴 중에는 멈춘다 */
  private timer: { left: number; label: string } | null = null;

  ui!: { dlg: DialogueScene; cg: CGScene; hud: HudScene; letter: LetterScene };

  constructor() {
    super('Field');
  }

  private ready = false;

  create(data: { label?: string }): void {
    this.ready = false;
    this.runner = new Runner(library, this);
    // 위에 겹치는 화면들
    for (const k of ['Hud', 'CG', 'Dialogue', 'Letter']) {
      if (!this.scene.isActive(k)) this.scene.launch(k);
      this.scene.bringToTop(k);
    }
    // 위 화면들은 다음 프레임 이후에 만들어지므로, 모두 준비되면 초기화한다
    this.initData = data;
  }

  private initData: { label?: string } | null = null;

  private uiReady(): boolean {
    return ['Hud', 'CG', 'Dialogue', 'Letter'].every((k) => this.scene.get(k)?.sys.settings.status === Phaser.Scenes.RUNNING);
  }

  private setupField(data: { label?: string }): void {
    this.ui = {
      dlg: this.scene.get('Dialogue') as DialogueScene,
      cg: this.scene.get('CG') as CGScene,
      hud: this.scene.get('Hud') as HudScene,
      letter: this.scene.get('Letter') as LetterScene,
    };

    this.timeTint = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(1e6);
    this.timeTint.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.scriptTint = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(1e6 + 1);
    this.scriptTint.setBlendMode(Phaser.BlendModes.MULTIPLY);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,X,SPACE,ENTER,ESC,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.ui.hud.events.on('action', () => this.tryInteract());
    this.ui.hud.events.on('menu', () => this.openMenu());
    this.events.once('shutdown', () => {
      this.ui.hud.events.off('action');
      this.ui.hud.events.off('menu');
    });

    const m = game.state.map;
    this.loadMap(m.id, m.x, m.y, m.dir);
    this.ui.cg.fade('in', 0.4);
    if (data?.label) void this.runScript(data.label);
    else this.checkAutorun();

    if (DEBUG) (window as unknown as { __field: FieldScene }).__field = this;
    this.ready = true;
  }

  // ───────────── 맵 ─────────────

  loadMap(id: string, x: number, y: number, dir: Dir): void {
    const m = maps.get(id);
    if (!m) {
      devWarn('없는 맵:', id);
      return;
    }
    this.layers.forEach((l) => l.destroy());
    this.tilemaps.forEach((t) => t.destroy());
    this.layers = [];
    this.tilemaps = [];
    this.propImages.forEach((i) => i.destroy());
    this.propImages = [];
    this.npcs.forEach((n) => n.ch.destroy());
    this.npcs.clear();
    this.parallel.clear();
    this.player?.destroy();
    this.path = [];
    this.pendingInteract = null;

    this.map = m;
    game.state.map = { id, x, y, dir };
    const idx = (name: string | null) => (name === null ? -1 : TILE_INDEX[name] ?? (devWarn('없는 타일:', name), 0));
    const addLayer = (grid: (string | null)[][], depthOf: (y: number) => number, filter?: (x: number, y: number) => boolean) => {
      const data = grid.map((row, yy) => row.map((t, xx) => (filter && !filter(xx, yy) ? -1 : idx(t))));
      const tm = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
      const ts = tm.addTilesetImage('tiles', 'tiles', T, T, 0, 0)!;
      const layer = tm.createLayer(0, ts, 0, 0)!;
      layer.setDepth(depthOf(0));
      this.tilemaps.push(tm);
      this.layers.push(layer);
    };
    addLayer(m.ground, () => -10);
    addLayer(m.objects, () => -5, (xx, yy) => !m.above[yy][xx]);
    addLayer(m.objects, () => 1e5, (xx, yy) => m.above[yy][xx]);

    // 소품 (data/props.json)
    for (const p of m.props) {
      const d = PROPS[p.prop];
      if (!d || !this.textures.exists('sheet:' + d.src)) continue;
      const img = this.add.image((p.x + d.foot[0] / 2) * T, (p.y + d.foot[1]) * T, 'sheet:' + d.src, 'prop:' + p.prop).setOrigin(0.5, 1);
      img.setDepth(d.flat ? -6 : d.wall ? -4 : (p.y + d.foot[1] - 1) * 10 + 4);
      this.propImages.push(img);
    }

    this.player = new CharSprite(this, game.state.playerSprite, x, y, dir);
    this.player.setVisible(!game.state.flags['_플레이어숨김']);
    for (const ev of m.events) {
      const ch = new CharSprite(this, ev.sprite, ev.x, ev.y, ev.dir ?? 'down');
      this.npcs.set(ev.id, { ev, ch, route: expandRoute(ev.route ?? []), ri: 0, waitUntil: 0, busy: false });
    }
    this.refreshEvents();

    const cam = this.cameras.main;
    const mw = m.w * T;
    const mh = m.h * T;
    cam.setBounds(Math.min(0, (mw - W) / 2), Math.min(0, (mh - H) / 2), Math.max(mw, W), Math.max(mh, H));
    cam.startFollow(this.player.sprite, true, 0.25, 0.25, 0, T / 2);
    this.applyTimeTint();
    this.ui.hud.showToast(m.name);
  }

  /** 맵 이동 (페이드 포함). 이미 암전 중이면 암전을 유지한다 */
  async transfer(id: string, x: number, y: number, dir?: Dir): Promise<void> {
    this.transferring = true;
    const wasBlack = this.ui.cg.isBlack;
    if (!wasBlack) await this.ui.cg.fade('out', 0.3);
    this.loadMap(id, x, y, dir ?? this.player.dir);
    if (SAVE.autosaveOnMapChange) this.autosave();
    if (!wasBlack) await this.ui.cg.fade('in', 0.3);
    this.transferring = false;
  }

  autosave(): void {
    writeSave('auto', game.state, this.summary());
  }

  summary(): string {
    const s = game.state;
    return `${this.map?.name ?? ''} · ${s.time.day}일차 ${s.time.period}`;
  }

  applyTimeTint(): void {
    const t = this.map?.indoor ? { color: 0xffffff, alpha: 0 } : TIME_TINT[game.state.time.period];
    this.timeTint.setFillStyle(t.color, t.alpha);
  }

  // ───────────── 이벤트 ─────────────

  private activePage(ev: MapEvent) {
    try {
      return ev.pages.find((p) => !p.if || evaluate(p.if, game.state)) ?? null;
    } catch (e) {
      devWarn(`이벤트 ${ev.id} 조건 오류:`, (e as Error).message);
      return null;
    }
  }

  private isShown(n: Npc): boolean {
    if (game.state.flags[`_숨김:${this.map.id}:${n.ev.id}`]) return false;
    if (!n.ev.show) return true;
    try {
      return evaluate(n.ev.show, game.state);
    } catch {
      return false;
    }
  }

  /** 조건에 따라 이벤트 보이기/숨기기 */
  refreshEvents(): void {
    for (const n of this.npcs.values()) n.ch.setVisible(this.isShown(n));
  }

  private eventsAt(x: number, y: number): Npc[] {
    return [...this.npcs.values()].filter((n) => n.ch.gx === x && n.ch.gy === y && this.isShown(n));
  }

  private blocksAt(x: number, y: number): boolean {
    return this.eventsAt(x, y).some((n) => (!!n.ev.sprite && !n.ev.through) || !!n.ev.block);
  }

  passable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return false;
    if (this.map.block[y][x]) return false;
    if (this.blocksAt(x, y)) return false;
    if (this.player && this.player.gx === x && this.player.gy === y) return false;
    return true;
  }

  get busy(): boolean {
    return this.runner.running || this.menuOpen || this.transferring;
  }

  /** 개발용: 원고 몇 줄을 바로 실행 */
  async runScriptText(src: string): Promise<void> {
    library.add(`# __dev\n${src}\n`, '__dev');
    await this.runScript('__dev');
    library.labels.delete('__dev');
  }

  async runScript(label: string): Promise<void> {
    if (this.runner.running) return;
    this.path = [];
    this.ui.hud.setControlsVisible(false);
    try {
      await this.runner.run(label);
    } catch (e) {
      devWarn('원고 실행 오류:', (e as Error).message);
    } finally {
      this.ui.dlg.close();
      this.ui.hud.setControlsVisible(true);
      this.inputCooldownUntil = this.time.now + 250;
      this.refreshEvents();
    }
    this.checkAutorun();
  }

  private trigger(n: Npc): boolean {
    if (n.ev.transfer) {
      const t = n.ev.transfer;
      void this.transfer(t.map, t.x, t.y, t.dir).then(() => this.checkAutorun());
      return true;
    }
    const pg = this.activePage(n.ev);
    if (!pg) return false;
    // 말을 걸면 NPC가 플레이어 쪽을 본다
    if (n.ev.sprite && n.ev.trigger === 'talk') {
      const dx = this.player.gx - n.ch.gx;
      const dy = this.player.gy - n.ch.gy;
      n.ch.face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    }
    void this.runScript(pg.label);
    return true;
  }

  checkAutorun(): void {
    if (this.busy) return;
    for (const n of this.npcs.values()) {
      if (!this.isShown(n)) continue;
      const pg = this.activePage(n.ev);
      if (!pg) continue;
      if (n.ev.trigger === 'autorun') {
        if (++this.autorunGuard > 50) {
          devWarn(`자동 실행 이벤트 ${n.ev.id} 가 끝없이 반복됨 — 원고에서 플래그를 바꿔 멈춰야 함`);
          return;
        }
        void this.runScript(pg.label);
        return;
      }
      if (n.ev.trigger === 'parallel' && !this.parallel.has(n.ev.id)) this.startParallel(n, pg.label);
    }
    this.autorunGuard = 0;
  }

  private startParallel(n: Npc, label: string): void {
    this.parallel.add(n.ev.id);
    const r = new Runner(library, this);
    const loop = async () => {
      while (this.parallel.has(n.ev.id) && this.map.events.includes(n.ev)) {
        await r.run(label);
        await this.wait(0.1);
        const pg = this.activePage(n.ev);
        if (!pg) break;
        label = pg.label;
      }
      this.parallel.delete(n.ev.id);
    };
    void loop();
  }

  tryInteract(): void {
    if (this.busy || this.player.moving || this.time.now < this.inputCooldownUntil) return;
    const [fx, fy] = this.player.front();
    const cands = [...this.eventsAt(fx, fy), ...this.eventsAt(this.player.gx, this.player.gy).filter((n) => !n.ev.sprite)];
    // 계산대 너머의 사람
    if (this.map.counter[fy]?.[fx]) {
      const [dx, dy] = DIR_VEC[this.player.dir];
      cands.push(...this.eventsAt(fx + dx, fy + dy));
    }
    for (const n of cands) if ((n.ev.trigger === 'talk' || (n.ev.trigger === 'touch' && !!n.ev.sprite)) && this.trigger(n)) return;
  }

  // ───────────── 입력·이동 ─────────────

  private onTap(p: Pointer): void {
    if (this.busy || !FIELD.tapMove) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const tx = Math.floor(wp.x / T);
    const ty = Math.floor(wp.y / T);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return;
    const here = { x: this.player.gx, y: this.player.gy };
    const talk = this.eventsAt(tx, ty).some((n) => n.ev.trigger === 'talk' || (n.ev.trigger === 'touch' && !!n.ev.sprite));
    this.pendingInteract = null;
    if (talk || !this.passable(tx, ty)) {
      // 말 걸 대상 → 옆 칸까지 가서 바라보고 조사
      if (!talk) return;
      const across = Math.abs(tx - here.x) + Math.abs(ty - here.y) === 2 && (tx === here.x || ty === here.y) && this.map.counter[(ty + here.y) / 2]?.[(tx + here.x) / 2];
      if (Math.abs(tx - here.x) + Math.abs(ty - here.y) === 1 || across) {
        this.player.face(tx < here.x ? 'left' : tx > here.x ? 'right' : ty < here.y ? 'up' : 'down');
        this.tryInteract();
        return;
      }
      let best: { x: number; y: number }[] | null = null;
      for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
        let ax = tx + dx;
        let ay = ty + dy;
        // 계산대 너머: 한 칸 더 떨어진 곳에서 말을 건다
        if (this.map.counter[ay]?.[ax]) {
          ax += dx;
          ay += dy;
        }
        if (!this.passable(ax, ay) && !(ax === here.x && ay === here.y)) continue;
        const pth = findPath(this.map.w, this.map.h, (x, y) => this.passable(x, y), here, { x: ax, y: ay }, FIELD.pathMaxNodes);
        if (pth && (!best || pth.length < best.length)) best = pth;
      }
      if (best) {
        this.path = best;
        this.pendingInteract = { x: tx, y: ty };
      }
      return;
    }
    const pth = findPath(this.map.w, this.map.h, (x, y) => this.passable(x, y), here, { x: tx, y: ty }, FIELD.pathMaxNodes);
    if (pth) this.path = pth;
  }

  private heldDir(): Dir | null {
    const k = this.keys;
    if (k.UP.isDown || k.W.isDown) return 'up';
    if (k.DOWN.isDown || k.S.isDown) return 'down';
    if (k.LEFT.isDown || k.A.isDown) return 'left';
    if (k.RIGHT.isDown || k.D.isDown) return 'right';
    return this.ui.hud.dir;
  }

  update(_t: number, dt: number): void {
    if (!this.ready) {
      if (this.initData && this.uiReady()) {
        const d = this.initData;
        this.initData = null;
        this.setupField(d);
      }
      return;
    }
    const JD = Phaser.Input.Keyboard.JustDown;
    const actionKey = JD(this.keys.Z) || JD(this.keys.SPACE) || JD(this.keys.ENTER);
    const menuKey = JD(this.keys.X) || JD(this.keys.ESC);
    game.state.playSeconds += dt / 1000;

    // 캐릭터 애니메이션
    const playerWalking = this.player.moving;
    this.player.update(dt, playerWalking);
    for (const n of this.npcs.values()) n.ch.update(dt, n.ch.moving);

    this.updateNpcs();
    if (this.timer) {
      if (!this.busy) this.timer.left -= dt / 1000;
      this.ui.hud.setTimer(Math.max(0, this.timer.left));
      if (this.timer.left <= 0 && !this.busy) {
        const label = this.timer.label;
        this.timer = null;
        this.ui.hud.setTimer(null);
        this.path = [];
        void this.runScript(label);
        return;
      }
    }
    if (this.busy) return;
    if (this.time.now < this.inputCooldownUntil) return;
    if (menuKey) return this.openMenu();
    if (this.player.moving) return;
    if (actionKey) return this.tryInteract();

    const held = this.heldDir();
    if (held) {
      this.path = [];
      this.pendingInteract = null;
      void this.tryStep(held);
      return;
    }
    if (this.path.length) {
      const nx = this.path.shift()!;
      const d: Dir = nx.x < this.player.gx ? 'left' : nx.x > this.player.gx ? 'right' : nx.y < this.player.gy ? 'up' : 'down';
      if (!this.passable(nx.x, nx.y)) {
        this.path = [];
        return;
      }
      void this.tryStep(d);
      return;
    }
    // 경로를 다 걸은 뒤: 탭했던 대상을 바라보고 조사 (걸음이 완전히 끝난 다음 프레임에)
    if (this.pendingInteract) {
      const p = this.pendingInteract;
      this.pendingInteract = null;
      this.player.face(p.x < this.player.gx ? 'left' : p.x > this.player.gx ? 'right' : p.y < this.player.gy ? 'up' : 'down');
      this.tryInteract();
    }
  }

  private async tryStep(d: Dir): Promise<void> {
    const [dx, dy] = DIR_VEC[d];
    const nx = this.player.gx + dx;
    const ny = this.player.gy + dy;
    if (!this.passable(nx, ny)) {
      this.player.face(d);
      // 막힌 칸의 '밟기' NPC (부딪히면 실행)
      for (const n of this.eventsAt(nx, ny)) if (n.ev.trigger === 'touch' && n.ev.sprite && this.trigger(n)) return;
      return;
    }
    const run = !!game.state.flags['달리기_해금'] && (this.ui.hud.running || this.keys.SHIFT.isDown);
    await this.player.step(d, game.state.playerSpeed * (run ? FIELD.runMultiplier : 1));
    game.state.map.x = this.player.gx;
    game.state.map.y = this.player.gy;
    game.state.map.dir = this.player.dir;
    for (const n of this.eventsAt(this.player.gx, this.player.gy)) {
      if (n.ev.trigger === 'touch' && !n.ev.sprite && this.trigger(n)) {
        this.path = [];
        return;
      }
    }
  }

  /** NPC 이동 경로 (원고 실행 중에는 멈춤) */
  private updateNpcs(): void {
    if (this.runner.running) return;
    const now = this.time.now;
    for (const n of this.npcs.values()) {
      if (!n.route.length || n.ch.moving || n.busy || !this.isShown(n) || now < n.waitUntil) continue;
      if (n.ri >= n.route.length) {
        if (!n.ev.routeLoop) continue;
        n.ri = 0;
      }
      const s = n.route[n.ri];
      const [cmd, arg] = s.split(/\s+/);
      if (cmd === 'wait' || cmd === '대기') {
        n.waitUntil = now + Number(arg ?? 1) * 1000;
        n.ri++;
      } else if (cmd === 'face' || cmd === '보기') {
        n.ch.face(DIR_WORDS[arg] ?? n.ch.dir);
        n.ri++;
      } else {
        const d = cmd === 'random' || cmd === '무작위' ? (['down', 'left', 'right', 'up'] as Dir[])[Math.floor(Math.random() * 4)] : DIR_WORDS[cmd];
        if (!d) {
          n.ri++;
          continue;
        }
        const [dx, dy] = DIR_VEC[d];
        if (this.passable(n.ch.gx + dx, n.ch.gy + dy)) {
          n.busy = true;
          void n.ch.step(d).then(() => (n.busy = false));
          n.ri++;
        } else {
          n.ch.face(d);
          n.waitUntil = now + 400; // 막혔으면 잠시 기다렸다 다시
        }
      }
    }
  }

  openMenu(): void {
    if (this.busy) return;
    this.menuOpen = true;
    this.path = [];
    this.scene.launch('Menu');
    this.scene.bringToTop('Menu');
  }

  // ───────────── Host: 원고 명령의 화면 쪽 ─────────────

  say(speaker: string | undefined, expr: string | undefined, side: 'left' | 'right' | undefined, t: string): Promise<void> {
    return this.ui.dlg.say(speaker, expr, side, t);
  }

  choose(options: string[]): Promise<number> {
    return this.ui.dlg.choose(options);
  }

  warn(msg: string): void {
    devWarn(msg);
  }

  refresh(): void {
    this.refreshEvents();
  }

  onTimeAdvance(steps: number): void {
    const before = game.state.time.day;
    decayConcentration(game.state, steps); // 클로토만 가라앉음 (actors.json concentrationDecay)
    this.applyTimeTint();
    // 7일마다 방세 처리용 훅 — 방세 자체는 M06 이후
    const s = game.state;
    if (s.time.day !== before && (s.time.day - 1) % 7 === 0) this.events.emit('weekly', s.time.day);
    void before;
  }

  /** 전투 한 판 (재시험·병원 처리 포함). 못 이기는 전투에서 지면 라벨을 돌려준다 */
  async battle(group: string, loseLabel?: string, firstStrike: 'ally' | 'enemy' | null = null): Promise<{ goto: string } | void> {
    const g = GROUPS[group];
    if (!g) {
      devWarn('없는 전투 그룹:', group);
      return;
    }
    this.ui.hud.setControlsVisible(false);
    for (;;) {
      await this.ui.cg.fade('out', 0.3);
      const r = await new Promise<BattleResult>((res) => {
        this.scene.launch('Battle', { group, firstStrike, canEscape: !g.retry && !g.scriptedLoss, onEnd: res });
        this.scene.bringToTop('Battle');
      });
      game.state.vars['전투결과'] = r === 'win' ? 1 : r === 'escape' ? 2 : 0;
      if (r === 'anomalized') {
        await this.gameOver();
        return { goto: '__stop' };
      }
      if (r === 'lose') {
        const label = loseLabel ?? g.scriptedLoss;
        if (label) {
          this.restoreParty();
          await this.ui.cg.fade('in', 0.3);
          return { goto: label };
        }
        if (g.retry) {
          // 프롤로그 시험 전투: 지면 재시험
          this.restoreParty();
          await this.ui.cg.fade('in', 0.3);
          await this.say(undefined, undefined, undefined, '쓰러졌다… 재시험을 본다.');
          firstStrike = null;
          continue;
        }
        // 게임 오버가 아니라 근처 병원에서 깨어나고 돈만 잃는다 [확정]
        const fee = hospitalFee(game.state.money);
        game.state.money -= fee;
        this.restoreParty();
        const h = this.map.hospital;
        if (h) this.loadMap(h.map, h.x, h.y, 'down');
        await this.ui.cg.fade('in', 0.6);
        await this.say(undefined, undefined, undefined, `병원에서 눈을 떴다. 치료비로 ${fee}연을 냈다.`);
        return;
      }
      await this.ui.cg.fade('in', 0.3);
      return;
    }
  }

  private restoreParty(): void {
    for (const id of game.state.party) {
      const st = game.state.actors[id];
      const def = ACTORS[id];
      if (st && def) {
        const ns = statsAt(def, st.level);
        st.hp = ns.hp;
        st.sp = ns.sp;
      }
    }
  }

  /** 발현 농도 100 → 이상체화 → 게임 오버(배드엔딩) [확정] */
  async gameOver(): Promise<void> {
    this.ui.dlg.close();
    await this.ui.cg.fade('out', 1.2, 0x000000);
    await this.ui.dlg.subtitle('혈중 발현 농도 100.0 mg/dL', 2.5);
    await this.ui.dlg.subtitle('— 배드 엔딩 —', 2.5);
    this.toTitle();
  }

  wait(sec: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(sec * 1000, () => res()));
  }

  private charOf(target: string): CharSprite | null {
    if (['플레이어', 'player', '클로토'].includes(target)) return this.player;
    const n = this.npcs.get(target);
    if (!n) devWarn('없는 대상:', target);
    return n?.ch ?? null;
  }

  async command(c: Cmd): Promise<void | { goto: string }> {
    const a = c.args;
    switch (c.name) {
      case 'map': {
        // @map 맵id x,y 방향
        const [x, y] = (a[1] ?? '0,0').split(',').map(Number);
        await this.transfer(a[0], x, y, DIR_WORDS[a[2]] ?? undefined);
        return;
      }
      case 'move': {
        // @move 대상 위 위 왼쪽*2 [대기없이]
        const ch = this.charOf(a[0]);
        if (!ch) return;
        const nowait = a.includes('대기없이') || a.includes('nowait');
        const steps = expandRoute(a.slice(1).filter((s) => s !== '대기없이' && s !== 'nowait'));
        const go = async () => {
          for (const s of steps) {
            const [cmd, arg] = s.split(':');
            if (cmd === 'face' || cmd === '보기') ch.face(DIR_WORDS[arg] ?? ch.dir);
            else if (cmd === 'wait' || cmd === '대기') await this.wait(Number(arg ?? 0.5));
            else if (DIR_WORDS[cmd]) {
              // 컷신 이동은 통행을 무시한다 (원고 작성자가 경로를 책임짐)
              await ch.step(DIR_WORDS[cmd], ch === this.player ? game.state.playerSpeed : 1);
            }
          }
          if (ch === this.player) game.state.map = { ...game.state.map, x: ch.gx, y: ch.gy, dir: ch.dir };
        };
        if (nowait) void go();
        else await go();
        return;
      }
      case 'face': {
        const ch = this.charOf(a[0]);
        const d = DIR_WORDS[a[1]];
        if (ch && d) ch.face(d);
        else if (ch && a[1] === '플레이어') {
          const dx = this.player.gx - ch.gx;
          const dy = this.player.gy - ch.gy;
          ch.face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
        }
        return;
      }
      case 'wait':
        await this.wait(Number(a[0] ?? 0.5));
        return;
      case 'timer':
        // @timer 시작 25 실패라벨 / @timer 끝
        if (a[0] === '시작' || a[0] === 'start') this.timer = { left: Number(a[1] ?? 30), label: a[2] ?? '' };
        else {
          this.timer = null;
          this.ui.hud.setTimer(null);
        }
        return;
      case 'fade': {
        // @fade out 0.5 [흰색]
        const color = a[2] === '흰색' || a[2] === 'white' ? 0xffffff : 0x000000;
        await this.ui.cg.fade(a[0] === 'in' || a[0] === '인' ? 'in' : 'out', Number(a[1] ?? 0.5), color);
        return;
      }
      case 'shake':
        this.cameras.main.shake(Number(a[1] ?? 0.4) * 1000, Number(a[0] ?? 0.01));
        return;
      case 'tint': {
        // @tint #203060 0.4 [초] / @tint 끄기 [초]
        const off = a[0] === '끄기' || a[0] === 'off';
        const sec = Number(off ? a[1] ?? 0.5 : a[2] ?? 0.5);
        if (!off) this.scriptTint.setFillStyle(parseInt(a[0].replace('#', ''), 16), 0);
        await new Promise<void>((res) =>
          this.tweens.add({ targets: this.scriptTint, fillAlpha: off ? 0 : Number(a[1] ?? 0.4), duration: sec * 1000, onComplete: () => res() }),
        );
        return;
      }
      case 'distort': {
        // @distort 세기 초  — '그녀' 연출용 화면 일그러짐
        const cam = this.cameras.main;
        if (a[0] === '끄기' || a[0] === 'off') {
          if (this.barrel) cam.postFX.remove(this.barrel);
          this.barrel = null;
          return;
        }
        const k = Number(a[0] ?? 0.15);
        const sec = Number(a[1] ?? 1.5);
        if (!this.barrel) this.barrel = cam.postFX.addBarrel(1);
        const b = this.barrel;
        await new Promise<void>((res) =>
          this.tweens.add({
            targets: b,
            amount: { from: 1 - k, to: 1 + k },
            duration: 220,
            yoyo: true,
            repeat: Math.max(0, Math.round((sec * 1000) / 440) - 1),
            onComplete: () => {
              cam.postFX.remove(b);
              if (this.barrel === b) this.barrel = null;
              res();
            },
          }),
        );
        return;
      }
      case 'cg':
        if (a[0] === '끄기' || a[0] === 'off') await this.ui.cg.hideCG(Number(a[1] ?? 0.6));
        else await this.ui.cg.showCG(a[0], Number(a[1] ?? 0.6));
        return;
      case 'letter': {
        // @letter 생일메모 [강조 "문구"]
        const body = letters.get(a[0]);
        if (body === undefined) return devWarn('없는 편지:', a[0]);
        const hi = a[1] === '강조' ? a[2] : undefined;
        this.scene.bringToTop('Letter');
        await this.ui.letter.open(body, hi);
        return;
      }
      case 'subtitle':
        await this.ui.dlg.subtitle((a[0] ?? '').replace(/\\n/g, '\n'), a[1] ? Number(a[1]) : undefined);
        return;
      case 'sprite': {
        // @sprite 대상 시트키
        const ch = this.charOf(a[0]);
        if (ch === this.player) game.state.playerSprite = a[1];
        ch?.setSheet(a[1]);
        return;
      }
      case 'show':
      case 'hide': {
        if (['플레이어', 'player', '클로토'].includes(a[0])) {
          game.state.flags['_플레이어숨김'] = c.name === 'hide';
          this.player.setVisible(c.name === 'show');
          return;
        }
        delete game.state.flags[`_숨김:${this.map.id}:${a[0]}`];
        if (c.name === 'hide') game.state.flags[`_숨김:${this.map.id}:${a[0]}`] = true;
        this.refreshEvents();
        return;
      }
      case 'time':
        this.applyTimeTint();
        return;
      case 'concentration': {
        // @concentration 클로토 +10 | =0
        const who = a[0] ?? '클로토';
        const hit = a[1]?.startsWith('=') ? setConcentration(game.state, who, Number(a[1].slice(1))) : addConcentration(game.state, who, Number(a[1] ?? 0));
        if (hit && who === '클로토') {
          await this.gameOver();
          return { goto: '__stop' };
        }
        return;
      }
      case 'battle': {
        // @battle 그룹 [패배라벨] [선제:아군|적]
        const fs = a.find((x) => x.startsWith('선제:'));
        const lose = a.slice(1).find((x) => !x.startsWith('선제:'));
        const side = fs === '선제:아군' ? 'ally' : fs === '선제:적' ? 'enemy' : null;
        return this.battle(a[0], lose, side);
      }
      case 'save':
        this.menuOpen = true;
        this.scene.launch('Menu', { page: 'save', force: true });
        this.scene.bringToTop('Menu');
        await new Promise<void>((res) => this.events.once('menuClosed', () => res()));
        return;
      case 'autosave':
        this.autosave();
        return;
      case 'bgm':
      case 'se':
        // 음악·효과음은 이번 범위 밖 — 파일이 생기면 여기서 연결
        if (DEBUG) console.info(`[소리 생략] @${c.name} ${c.raw}`);
        return;
      case 'title':
        await this.ui.cg.fade('out', 0.6);
        this.toTitle();
        return;
      case 'end_demo':
        await this.ui.cg.fade('out', 0.8);
        await this.ui.dlg.subtitle((a[0] ?? 'M06으로 이어짐').replace(/\\n/g, '\n'), 4);
        this.toTitle();
        return;
      default:
        devWarn(`처리하지 않은 명령 @${c.name} (${c.raw})`);
    }
  }

  toTitle(): void {
    for (const k of ['Hud', 'CG', 'Dialogue', 'Letter', 'Menu']) this.scene.stop(k);
    this.scene.start('Title');
  }
}

type Pointer = Phaser.Input.Pointer;
