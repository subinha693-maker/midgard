// 걸음 도트: data/sprites.json 의 시트를 실행 중에 가공해 텍스처로 만든다.
//  1) 칸 가장자리에서부터 배경색을 채워 지움 (캐릭터 안쪽의 흰 셔츠 등은 남음)
//  2) 줄마다 발끝 높이를 맞춤
//  3) data/sprites.json 의 displayHeight 에 맞춰 부드럽게 축소
// 원본 파일은 읽기만 한다.
import Phaser from 'phaser';
import spriteData from '../../data/sprites.json';
import { assetUrl } from './assets';
import { devWarn } from './debug';
import type { Dir } from './state';

interface SheetDef {
  file?: string;
  same?: string;
  grid?: [number, number];
  rows?: Record<Dir, number>;
  walk?: number[];
  stand?: number;
  bg?: string;
  tolerance?: number;
  frames?: Partial<Record<Dir, [number, number, number][]>>; // 방향별 [행, 열, 뒤집기]
}
const DATA = spriteData as unknown as { displayHeight: number; sheets: Record<string, SheetDef> };

export interface SheetInfo {
  texture: string;
  frameW: number;
  frameH: number;
  walk: number[];
  stand: number;
}
const info = new Map<string, SheetInfo>();
const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

function resolve(key: string): { key: string; def: SheetDef } | null {
  let d = DATA.sheets[key];
  let k = key;
  for (let i = 0; d?.same && i < 5; i++) {
    k = d.same;
    d = DATA.sheets[k];
  }
  return d && d.file ? { key: k, def: d } : null;
}

export function preloadSprites(scene: Phaser.Scene): void {
  const seen = new Set<string>();
  for (const key of Object.keys(DATA.sheets)) {
    const r = resolve(key);
    if (!r || seen.has(r.key)) continue;
    seen.add(r.key);
    const url = assetUrl(r.def.file!);
    if (!url) devWarn('걸음 도트 파일 없음:', r.def.file);
    else scene.load.image('src:' + r.key, url);
  }
}

export function buildSprites(scene: Phaser.Scene): void {
  for (const key of Object.keys(DATA.sheets)) {
    const r = resolve(key);
    if (!r) continue;
    if (!info.has(r.key)) {
      if (!scene.textures.exists('src:' + r.key)) continue;
      info.set(r.key, buildSheet(scene, r.key, r.def));
    }
    if (key !== r.key) info.set(key, info.get(r.key)!);
  }
}

export function sheetInfo(key: string): SheetInfo | null {
  const i = info.get(key);
  if (!i) devWarn('걸음 도트 없음:', key);
  return i ?? null;
}

export function frameName(dir: Dir, col: number): string {
  return `${dir}_${col}`;
}

function buildSheet(scene: Phaser.Scene, key: string, def: SheetDef): SheetInfo {
  const img = scene.textures.get('src:' + key).getSourceImage() as HTMLImageElement;
  const [cols, rows] = def.grid ?? [3, 4];
  const cw = Math.floor(img.width / cols);
  const ch = Math.floor(img.height / rows);
  const tol = def.tolerance ?? 60;

  // 칸마다 배경 지우기
  const cells: HTMLCanvasElement[][] = [];
  const inkBottom: number[] = [];
  let maxInkH = 0;
  for (let r = 0; r < rows; r++) {
    cells.push([]);
    let bottom = 0;
    for (let c = 0; c < cols; c++) {
      const cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = ch;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
      const box = removeBackground(ctx, cw, ch, tol);
      cells[r].push(cv);
      bottom = Math.max(bottom, box.bottom);
      maxInkH = Math.max(maxInkH, box.bottom - box.top + 1);
    }
    inkBottom.push(bottom);
  }

  // 축소 배율: 가장 큰 캐릭터 높이 → displayHeight
  const scale = DATA.displayHeight / Math.max(1, maxInkH);
  const fw = Math.ceil(cw * scale);
  const fh = DATA.displayHeight + 4;
  const out = document.createElement('canvas');
  out.width = fw * cols;
  out.height = fh * DIRS.length;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  const rowOf = def.rows ?? { down: 0, left: 1, right: 2, up: 3 };
  DIRS.forEach((d, di) => {
    // 기본: 그 방향 행의 칸을 순서대로. frames 가 있으면 [행, 열, 뒤집기] 대로
    const src = def.frames?.[d] ?? Array.from({ length: cols }, (_, c) => [rowOf[d], c, 0] as [number, number, number]);
    src.forEach(([r, c0, flipped], c) => {
      let cell = cells[r][c0];
      if (flipped) {
        const f = document.createElement('canvas');
        f.width = cw;
        f.height = ch;
        const fx = f.getContext('2d')!;
        fx.translate(cw, 0);
        fx.scale(-1, 1);
        fx.drawImage(cell, 0, 0);
        cell = f;
      }
      const small = downscale(cell, Math.round(cw * scale), Math.round(ch * scale));
      // 발끝(inkBottom)이 프레임 아래에서 2px 위에 오도록
      const dy = di * fh + (fh - 2) - Math.round(inkBottom[r] * scale);
      octx.drawImage(small, c * fw, dy);
    });
  });
  const tkey = 'walk:' + key;
  const tex = scene.textures.addCanvas(tkey, out)!;
  DIRS.forEach((d, di) => {
    for (let c = 0; c < cols; c++) tex.add(frameName(d, c), 0, c * fw, di * fh, fw, fh);
  });
  return { texture: tkey, frameW: fw, frameH: fh, walk: def.walk ?? [0, 1, 2, 1], stand: def.stand ?? 1 };
}

/** 가장자리에서 시작하는 채우기로 배경색을 투명하게. 잉크 영역 범위를 돌려준다 */
function removeBackground(ctx: CanvasRenderingContext2D, w: number, h: number, tol: number) {
  const id = ctx.getImageData(0, 0, w, h);
  const p = id.data;
  const br = p[0], bgc = p[1], bb = p[2];
  const near = (i: number, t: number) => Math.abs(p[i] - br) + Math.abs(p[i + 1] - bgc) + Math.abs(p[i + 2] - bb) <= t;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const k = stack.pop()!;
    if (seen[k]) continue;
    seen[k] = 1;
    if (!near(k * 4, tol)) continue;
    p[k * 4 + 3] = 0;
    const x = k % w;
    const y = (k / w) | 0;
    if (x > 0) stack.push(k - 1);
    if (x < w - 1) stack.push(k + 1);
    if (y > 0) stack.push(k - w);
    if (y < h - 1) stack.push(k + w);
  }
  // 테두리에 남은 배경빛 번짐 한 겹 더 지우기
  const clear: number[] = [];
  for (let k = 0; k < w * h; k++) {
    if (p[k * 4 + 3] === 0) continue;
    const x = k % w;
    const y = (k / w) | 0;
    const nb = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
    if (nb.some((n) => n >= 0 && p[n * 4 + 3] === 0) && near(k * 4, tol * 2.2)) clear.push(k);
  }
  for (const k of clear) p[k * 4 + 3] = 0;
  ctx.putImageData(id, 0, 0);
  let top = h, bottom = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (p[(y * w + x) * 4 + 3]) {
        if (y < top) top = y;
        bottom = y;
      }
  return { top: Math.min(top, bottom), bottom };
}

/** 여러 번 절반씩 줄여 깨끗하게 축소 */
function downscale(src: HTMLCanvasElement, tw: number, th: number): HTMLCanvasElement {
  let cur = src;
  while (cur.width / 2 > tw * 1.05) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(cur.width / 2);
    c.height = Math.ceil(cur.height / 2);
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, tw, th);
  return c;
}
