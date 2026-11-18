// 게임 데이터 묶음: 원고(data/scenario/*.md), 맵(data/maps/*.json), 편지(data/letters/*.txt)
// 빌드에 함께 들어가고, 개발 중에는 파일을 고치면 바로 다시 읽힌다.
import { ScriptLibrary, type ParseError } from './parser';
import { parseMap, type MapData } from '../field/mapdata';

const scenarioFiles = import.meta.glob('/data/scenario/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const mapFiles = import.meta.glob('/data/maps/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const letterFiles = import.meta.glob('/data/letters/*.txt', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

const base = (p: string) => p.split('/').pop()!.replace(/\.[^.]+$/, '');

export const library = new ScriptLibrary();
export const maps = new Map<string, MapData>();
export const letters = new Map<string, string>();
/** 원고·맵 오류 (개발 모드에서 화면에 띄움) */
export const contentErrors: ParseError[] = [];

for (const [path, text] of Object.entries(scenarioFiles)) library.add(text, path.replace(/^\//, ''));

for (const [path, raw] of Object.entries(mapFiles)) {
  try {
    maps.set(base(path), parseMap(raw, base(path)));
  } catch (e) {
    contentErrors.push({ file: path.replace(/^\//, ''), line: 0, message: (e as Error).message });
  }
}

for (const [path, text] of Object.entries(letterFiles)) letters.set(base(path), text.replace(/\r/g, '').replace(/\n+$/, ''));

// 맵 이벤트가 가리키는 라벨도 검사
const targets: { file: string; line: number; label: string }[] = [];
for (const m of maps.values())
  for (const ev of m.events) for (const pg of ev.pages) targets.push({ file: `data/maps/${m.id}.json`, line: 0, label: pg.label });
library.validate(targets);
contentErrors.push(...library.errors);
