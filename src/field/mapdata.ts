// 맵 파일(data/maps/*.json) 읽기 — 형식은 docs/map_format.md
// 바닥·물체 레이어는 ASCII 격자, 문자 → 타일 대응표(legend)는 맵 파일 안에 둔다.
import type { Dir } from '../core/state';

export interface LegendEntry { tile: string; block?: boolean; above?: boolean }

export interface EventPage { if?: string; label: string }
export interface MapEvent {
  id: string;
  x: number;
  y: number;
  sprite?: string; // 걸음 도트 시트 키 (없으면 보이지 않는 이벤트)
  dir?: Dir;
  trigger: 'talk' | 'touch' | 'autorun' | 'parallel';
  pages: EventPage[];
  show?: string; // 이 조건이 참일 때만 나타남
  through?: boolean; // 통과 가능 (기본: 도트가 있으면 막힘)
  route?: string[]; // NPC 이동 경로: "left", "up*2", "wait 1", "face down"
  routeLoop?: boolean;
  transfer?: { map: string; x: number; y: number; dir?: Dir };
}

export interface MapData {
  id: string;
  name: string;
  w: number;
  h: number;
  indoor: boolean; // true 면 시간대 색조 미적용
  hospital?: { map: string; x: number; y: number }; // 전투에서 쓰러지면 깨어날 곳
  ground: (string | null)[][];
  objects: (string | null)[][];
  above: boolean[][]; // 캐릭터보다 위에 그릴 물체
  block: boolean[][];
  events: MapEvent[];
}

export class MapError extends Error {}

interface RawMap {
  name?: string;
  indoor?: boolean;
  hospital?: { map: string; x: number; y: number };
  legend: Record<string, string | LegendEntry>;
  ground: string[];
  objects?: string[];
  events?: Partial<MapEvent>[] & { label?: string }[];
}

export function parseMap(raw: unknown, id: string): MapData {
  const m = raw as RawMap;
  const errs: string[] = [];
  if (!m || !Array.isArray(m.ground) || !m.legend) throw new MapError(`${id}: ground 또는 legend 없음`);
  const legend: Record<string, LegendEntry> = {};
  for (const [ch, v] of Object.entries(m.legend)) legend[ch] = typeof v === 'string' ? { tile: v } : v;

  const h = m.ground.length;
  const w = Math.max(...m.ground.map((r) => [...r].length));
  const grid = (rows: string[] | undefined, layer: string, emptyOk: boolean) => {
    const out: (LegendEntry | null)[][] = [];
    for (let y = 0; y < h; y++) {
      const row = [...(rows?.[y] ?? '')];
      if (rows && row.length !== w) errs.push(`${layer} ${y}행 길이 ${row.length} ≠ ${w}`);
      const r: (LegendEntry | null)[] = [];
      for (let x = 0; x < w; x++) {
        const ch = row[x] ?? ' ';
        if (ch === ' ' && emptyOk) r.push(null);
        else if (!legend[ch]) {
          errs.push(`${layer} (${x},${y}) 문자 "${ch}" 가 legend 에 없음`);
          r.push(null);
        } else r.push(legend[ch]);
      }
      out.push(r);
    }
    return out;
  };
  const g = grid(m.ground, 'ground', false);
  const o = grid(m.objects, 'objects', true);
  if (m.objects && m.objects.length !== h) errs.push(`objects 행 수 ${m.objects.length} ≠ ${h}`);

  const block = g.map((row, y) => row.map((c, x) => !!c?.block || !!o[y][x]?.block));
  const above = o.map((row) => row.map((c) => !!c?.above));

  const events: MapEvent[] = (m.events ?? []).map((e: Partial<MapEvent> & { label?: string }, i) => {
    const ev: MapEvent = {
      id: e.id ?? `ev${i}`,
      x: e.x ?? 0,
      y: e.y ?? 0,
      sprite: e.sprite,
      dir: e.dir ?? 'down',
      trigger: e.trigger ?? (e.transfer ? 'touch' : 'talk'),
      pages: e.pages ?? (e.label ? [{ label: e.label }] : []),
      show: e.show,
      through: e.through,
      route: e.route,
      routeLoop: e.routeLoop ?? true,
      transfer: e.transfer,
    };
    if (ev.x < 0 || ev.y < 0 || ev.x >= w || ev.y >= h) errs.push(`이벤트 ${ev.id} 위치 (${ev.x},${ev.y}) 가 맵 밖`);
    if (!ev.pages.length && !ev.transfer) errs.push(`이벤트 ${ev.id} 에 label/pages/transfer 가 없음`);
    return ev;
  });

  if (errs.length) throw new MapError(`${id}: ` + errs.join(' / '));
  return {
    id,
    name: m.name ?? id,
    w,
    h,
    indoor: !!m.indoor,
    hospital: m.hospital,
    ground: g.map((r) => r.map((c) => c?.tile ?? null)),
    objects: o.map((r) => r.map((c) => c?.tile ?? null)),
    above,
    block,
    events,
  };
}

/** 이동 경로 한 줄 → 단계 목록. "up*3" → ['up','up','up'] */
export function expandRoute(steps: string[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    const m = s.match(/^(\S+)\*(\d+)$/);
    if (m) for (let i = 0; i < Number(m[2]); i++) out.push(m[1]);
    else out.push(s);
  }
  return out;
}
