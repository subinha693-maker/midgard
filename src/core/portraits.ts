import Phaser from 'phaser';
import portraitData from '../../data/portraits.json';
import { assetUrl } from './assets';
import { devWarn } from './debug';

// portraits.json 형식
export interface Rect { x: number; y: number; w: number; h: number }
export interface PortraitSet {
  name: string;
  default: string; // 기본 표정 키
  scale: number;
  expressions: Record<string, { file: string; rect?: Rect }>;
  faceCrop?: Rect; // 전투 상태바용, 표정 rect 기준 상대 좌표
  removeBg?: { inset: number; tolerance: number; erase: [number, number, number, number][] };
}

const DATA = portraitData as unknown as { characters: Record<string, PortraitSet> };

export const portraitSets = DATA.characters;

const srcKey = (file: string) => 'user:' + file;
const texKey = (actor: string, expr: string) => `pt:${actor}:${expr}`;

/** Boot에서 호출: 필요한 원본 이미지를 적재 */
export function preloadPortraits(scene: Phaser.Scene): void {
  const seen = new Set<string>();
  for (const set of Object.values(DATA.characters)) {
    for (const e of Object.values(set.expressions)) {
      if (seen.has(e.file)) continue;
      seen.add(e.file);
      const url = assetUrl(e.file);
      if (!url) { devWarn('초상화 파일 없음:', e.file); continue; }
      scene.load.image(srcKey(e.file), url);
    }
  }
}

/** 적재 후 호출: 표정마다 잘라 배경을 지운 텍스처를 만든다 (원본은 건드리지 않음) */
export function registerPortraitFrames(scene: Phaser.Scene): void {
  for (const [actor, set] of Object.entries(DATA.characters)) {
    for (const [expr, e] of Object.entries(set.expressions)) {
      if (!scene.textures.exists(srcKey(e.file))) continue;
      const img = scene.textures.get(srcKey(e.file)).getSourceImage() as HTMLImageElement;
      const r = e.rect ?? { x: 0, y: 0, w: img.width, h: img.height };
      const rb = set.removeBg;
      const inset = rb?.inset ?? 0;
      const w = r.w - inset * 2;
      const h = r.h - inset * 2;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, r.x + inset, r.y + inset, w, h, 0, 0, w, h);
      if (rb) removePortraitBg(ctx, w, h, rb.tolerance, rb.erase.map(([x, y, ew, eh]) => [x - inset, y - inset, ew, eh]));
      const t = scene.textures.addCanvas(texKey(actor, expr), cv)!;
      // 손그림 CG는 도트가 아니므로 부드럽게 축소 (게임 전체는 pixelArt)
      t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}

/**
 * 가장자리에서 시작해 밝고 채도 낮은 배경을 지운다.
 * 비교 기준색을 이웃을 따라 옮겨 가므로 그라데이션 배경도 지워지고, 선화(외곽선)에서 멈춘다.
 */
function removePortraitBg(ctx: CanvasRenderingContext2D, w: number, h: number, tol: number, erase: number[][]): void {
  const id = ctx.getImageData(0, 0, w, h);
  const p = id.data;
  // 이름표 영역은 오른쪽 위 모서리 배경색으로 덮는다
  const bi = (w - 1) * 4;
  for (const [ex, ey, ew, eh] of erase)
    for (let y = Math.max(0, ey); y < Math.min(h, ey + eh); y++)
      for (let x = Math.max(0, ex); x < Math.min(w, ex + ew); x++) {
        const i = (y * w + x) * 4;
        p[i] = p[bi];
        p[i + 1] = p[bi + 1];
        p[i + 2] = p[bi + 2];
      }
  const bgLike = (i: number) => {
    const mn = Math.min(p[i], p[i + 1], p[i + 2]);
    const mx = Math.max(p[i], p[i + 1], p[i + 2]);
    return mn > 195 && mx - mn < 40;
  };
  const seen = new Uint8Array(w * h);
  // 큐: [픽셀 번호, 기준 픽셀 번호]
  const q: number[] = [];
  for (let x = 0; x < w; x++) q.push(x, x);
  for (let y = 0; y < h; y++) q.push(y * w, y * w, y * w + w - 1, y * w + w - 1);
  for (let head = 0; head < q.length; head += 2) {
    const k = q[head];
    const ref = q[head + 1];
    if (seen[k]) continue;
    const i = k * 4;
    const j = ref * 4;
    if (!bgLike(i) || Math.abs(p[i] - p[j]) + Math.abs(p[i + 1] - p[j + 1]) + Math.abs(p[i + 2] - p[j + 2]) > tol) continue;
    seen[k] = 1;
    const x = k % w;
    const y = (k / w) | 0;
    if (x > 0) q.push(k - 1, k);
    if (x < w - 1) q.push(k + 1, k);
    if (y > 0) q.push(k - w, k);
    if (y < h - 1) q.push(k + w, k);
  }
  for (let k = 0; k < w * h; k++) if (seen[k]) p[k * 4 + 3] = 0;
  // 지운 곳과 닿은 밝은 테두리는 반투명하게 (흰 번짐 줄이기)
  for (let k = 0; k < w * h; k++) {
    if (seen[k]) continue;
    const x = k % w;
    const y = (k / w) | 0;
    const nb = (x > 0 && seen[k - 1]) || (x < w - 1 && seen[k + 1]) || (y > 0 && seen[k - w]) || (y < h - 1 && seen[k + w]);
    if (!nb) continue;
    const i = k * 4;
    const mn = Math.min(p[i], p[i + 1], p[i + 2]);
    p[i + 3] = Math.max(60, Math.min(255, (255 - mn) * 3));
  }
  ctx.putImageData(id, 0, 0);
}

/** 인물+표정 → 텍스처 키. 표정이 없으면 기본 표정으로 대체하고 경고 */
export function resolvePortrait(actor: string, expr?: string): { texture: string; frame?: string } | null {
  const set = DATA.characters[actor];
  if (!set) { devWarn('초상화 없는 인물:', actor); return null; }
  const key = expr && set.expressions[expr] ? expr : set.default;
  if (expr && key !== expr) devWarn(`표정 "${actor}:${expr}" 없음 → 기본 표정 "${key}"로 대체`);
  return { texture: texKey(actor, key) };
}
