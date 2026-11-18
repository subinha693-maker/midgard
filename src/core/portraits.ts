import Phaser from 'phaser';
import portraitData from '../../data/portraits.json';
import { assetUrl } from './assets';
import { devWarn } from './debug';

// portraits.json 형식
export interface Rect { x: number; y: number; w: number; h: number }
export interface PortraitSet {
  name: string;
  default: string; // 기본 표정 키
  side: 'left' | 'right';
  scale: number;
  expressions: Record<string, { file: string; rect?: Rect }>;
  faceCrop?: Rect; // 전투 상태바용, 표정 rect 기준 상대 좌표
}

const DATA = portraitData as unknown as { characters: Record<string, PortraitSet> };

export const portraitSets = DATA.characters;

const texKey = (file: string) => 'user:' + file;
const frameKey = (actor: string, expr: string) => `${actor}:${expr}`;

/** Boot에서 호출: 필요한 원본 이미지를 텍스처로 적재 */
export function preloadPortraits(scene: Phaser.Scene): void {
  const seen = new Set<string>();
  for (const set of Object.values(DATA.characters)) {
    for (const e of Object.values(set.expressions)) {
      if (seen.has(e.file)) continue;
      seen.add(e.file);
      const url = assetUrl(e.file);
      if (!url) { devWarn('초상화 파일 없음:', e.file); continue; }
      scene.load.image(texKey(e.file), url);
    }
  }
}

/** 적재 후 호출: 표정별 자르기 영역을 프레임으로 등록 (원본은 건드리지 않음) */
export function registerPortraitFrames(scene: Phaser.Scene): void {
  for (const [actor, set] of Object.entries(DATA.characters)) {
    for (const [expr, e] of Object.entries(set.expressions)) {
      const tex = scene.textures.get(texKey(e.file));
      if (!tex || tex.key === '__MISSING') continue;
      // 손그림 CG는 도트가 아니므로 부드럽게 축소 (게임 전체는 pixelArt)
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      const src = tex.getSourceImage() as HTMLImageElement;
      const r = e.rect ?? { x: 0, y: 0, w: src.width, h: src.height };
      tex.add(frameKey(actor, expr), 0, r.x, r.y, r.w, r.h);
    }
  }
}

/** 인물+표정 → {텍스처, 프레임}. 표정이 없으면 기본 표정으로 대체하고 경고 */
export function resolvePortrait(actor: string, expr?: string): { texture: string; frame: string } | null {
  const set = DATA.characters[actor];
  if (!set) { devWarn('초상화 없는 인물:', actor); return null; }
  let key = expr && set.expressions[expr] ? expr : set.default;
  if (expr && key !== expr) devWarn(`표정 "${actor}:${expr}" 없음 → 기본 표정 "${key}"로 대체`);
  const e = set.expressions[key];
  return { texture: texKey(e.file), frame: frameKey(actor, key) };
}
