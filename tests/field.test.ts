import { describe, it, expect } from 'vitest';
import { findPath } from '../src/field/pathfind';
import { parseMap, MapError, expandRoute } from '../src/field/mapdata';
import { migrate, readSave, writeSave, SAVE_VERSION, type KV } from '../src/core/save';
import { newState } from '../src/core/state';
import { readFileSync, readdirSync } from 'node:fs';

describe('A* 길찾기', () => {
  const rows = ['.....', '.###.', '...#.', '.#...'];
  const pass = (x: number, y: number) => rows[y][x] !== '#';
  it('벽을 돌아가는 최단 경로', () => {
    const p = findPath(5, 4, pass, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(p).not.toBeNull();
    expect(p!.length).toBe(4);
    expect(p![p!.length - 1]).toEqual({ x: 2, y: 2 });
  });
  it('막힌 목표는 null', () => {
    expect(findPath(5, 4, pass, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
});

describe('맵 파일', () => {
  it('ASCII 레이어와 통행', () => {
    const m = parseMap({ legend: { '.': 'floor', '#': { tile: 'wall', block: true } }, ground: ['#..', '...'], events: [{ id: 'a', x: 1, y: 1, label: 'L' }] }, 't');
    expect(m.w).toBe(3);
    expect(m.block[0][0]).toBe(true);
    expect(m.block[1][1]).toBe(false);
    expect(m.events[0].pages[0].label).toBe('L');
  });
  it('legend 에 없는 문자는 오류', () => {
    expect(() => parseMap({ legend: { '.': 'floor' }, ground: ['.x'] }, 't')).toThrow(MapError);
  });
  it('경로 펼치기', () => {
    expect(expandRoute(['up*2', 'wait 1'])).toEqual(['up', 'up', 'wait 1']);
  });
  it('data/maps 의 모든 맵이 읽힘', () => {
    for (const f of readdirSync('data/maps').filter((n) => n.endsWith('.json'))) {
      expect(() => parseMap(JSON.parse(readFileSync(`data/maps/${f}`, 'utf8')), f)).not.toThrow();
    }
  });
});

describe('저장', () => {
  const mem = (): KV => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };
  it('저장 후 불러오기', () => {
    const kv = mem();
    const s = newState();
    s.flags['x'] = true;
    s.money = 77;
    expect(writeSave(1, s, '테스트', kv)).toBe(true);
    const f = readSave(1, kv)!;
    expect(f.version).toBe(SAVE_VERSION);
    expect(f.state.flags['x']).toBe(true);
    expect(f.state.money).toBe(77);
  });
  it('빠진 칸은 기본값으로 채움, 미래 버전은 거부', () => {
    const f = migrate({ version: 1, state: { money: 5 } })!;
    expect(f.state.money).toBe(5);
    expect(f.state.party).toEqual(['클로토']);
    expect(migrate({ version: 999, state: {} })).toBeNull();
  });
});

describe('맵 연결 (P4)', () => {
  const all = new Map(
    readdirSync('data/maps')
      .filter((n) => n.endsWith('.json'))
      .map((f) => [f.replace('.json', ''), parseMap(JSON.parse(readFileSync(`data/maps/${f}`, 'utf8')), f)]),
  );
  it('모든 이동 목적지가 지나갈 수 있는 칸이고, 바로 다른 이동 칸이 아님', () => {
    for (const m of all.values())
      for (const ev of m.events) {
        if (!ev.transfer) continue;
        const t = ev.transfer;
        const dst = all.get(t.map);
        expect(dst, `${m.id} → ${t.map}`).toBeTruthy();
        expect(dst!.block[t.y]?.[t.x], `${m.id} → ${t.map} (${t.x},${t.y}) 막힘`).toBe(false);
        expect(dst!.events.some((e) => e.transfer && e.x === t.x && e.y === t.y), `${t.map} (${t.x},${t.y}) 도착 칸이 이동 칸`).toBe(false);
      }
  });
  it('집 2층에서 걸어서 미르 레브리까지 이어짐 (배 구간 제외)', () => {
    // 맵 안에서 이동 칸끼리 걸어서 닿는지 + 맵 사이 연결
    const reach = (id: string, sx: number, sy: number) => {
      const m = all.get(id)!;
      const seen = new Set<string>([`${sx},${sy}`]);
      const q = [[sx, sy]];
      while (q.length) {
        const [x, y] = q.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || m.block[ny][nx] || seen.has(`${nx},${ny}`)) continue;
          seen.add(`${nx},${ny}`);
          q.push([nx, ny]);
        }
      }
      return m.events.filter((e) => e.transfer && seen.has(`${e.x},${e.y}`)).map((e) => e.transfer!);
    };
    const visited = new Set<string>();
    const stack: [string, number, number][] = [['erisia_home_2f', 3, 4], ['mir_port', 12, 9]]; // 미르는 배에서 내리는 곳부터
    while (stack.length) {
      const [id, x, y] = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const t of reach(id, x, y)) stack.push([t.map, t.x, t.y]);
    }
    for (const id of ['erisia_home_1f', 'erisia_town', 'erisia_bakery', 'erisia_cityhall', 'erisia_clinic', 'erisia_testground', 'noggria_port', 'argo_deck', 'argo_cabin', 'mir_market', 'mir_hammer', 'mir_lebri'])
      expect(visited.has(id), id).toBe(true);
  });
});
