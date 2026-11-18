// A* 길찾기 — 4방향 격자. 순수 함수.
export interface P { x: number; y: number }

export function findPath(
  w: number,
  h: number,
  passable: (x: number, y: number) => boolean,
  start: P,
  goal: P,
  maxNodes = 4000,
): P[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const idx = (x: number, y: number) => y * w + x;
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const open: { i: number; f: number }[] = [];
  const hfn = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const si = idx(start.x, start.y);
  g.set(si, 0);
  open.push({ i: si, f: hfn(start.x, start.y) });
  const closed = new Set<number>();
  let visited = 0;
  while (open.length) {
    // 작은 맵이라 단순 선형 탐색으로 충분
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi, 1)[0];
    if (closed.has(cur.i)) continue;
    closed.add(cur.i);
    if (++visited > maxNodes) return null;
    const cx = cur.i % w;
    const cy = Math.floor(cur.i / w);
    if (cx === goal.x && cy === goal.y) {
      const path: P[] = [];
      let i = cur.i;
      while (i !== si) {
        path.push({ x: i % w, y: Math.floor(i / w) });
        i = came.get(i)!;
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const isGoal = nx === goal.x && ny === goal.y;
      if (!isGoal && !passable(nx, ny)) continue;
      if (isGoal && !passable(nx, ny)) continue;
      const ni = idx(nx, ny);
      const ng = g.get(cur.i)! + 1;
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng);
        came.set(ni, cur.i);
        open.push({ i: ni, f: ng + hfn(nx, ny) });
      }
    }
  }
  return null;
}
