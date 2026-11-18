// 원고 실행기 — 라벨 하나를 처음부터 끝까지 순서대로 실행한다.
// 화면 일은 Host(필드 장면)에 맡기고, 흐름 제어(@if·@goto·@call·선택지)와 상태 명령은 여기서 처리한다.
import type { Cmd, Node, ScriptLibrary } from './parser';
import { evaluate } from './cond';
import { addItem, autoEquip, game, PERIODS, setQuest } from '../core/state';
import { ITEMS } from '../core/db';

export interface Host {
  say(speaker: string | undefined, expr: string | undefined, side: 'left' | 'right' | undefined, text: string): Promise<void>;
  choose(options: string[]): Promise<number>;
  /** 화면·연출 명령 (map, move, fade …). 모르는 명령은 무시해도 된다 */
  command(cmd: Cmd): Promise<void | { goto: string }>;
  /** 시간대가 바뀔 때 (농도 감소 등, P3) */
  onTimeAdvance?(steps: number): void;
  warn?(msg: string): void;
  /** 플래그·변수 등이 바뀐 뒤 (이벤트 보이기 다시 계산) */
  refresh?(): void;
}

class Jump {
  constructor(public label: string) {}
}
class Stop {}
class Return {}

const MAX_JUMPS = 10000; // 무한 @goto 방지
/** 화면 쪽 명령이 실행을 끝내고 싶을 때 (게임 오버 등) */
export const STOP_LABEL = '__stop';

export class Runner {
  running = false;
  private jumps = 0;

  constructor(private lib: ScriptLibrary, private host: Host) {}

  async run(label: string): Promise<void> {
    this.running = true;
    this.jumps = 0;
    try {
      let next: string | null = label;
      while (next && next !== STOP_LABEL) {
        next = await this.runLabel(next);
      }
    } finally {
      this.running = false;
    }
  }

  /** 라벨 실행. @goto 면 다음 라벨 이름을 돌려준다 */
  private async runLabel(name: string): Promise<string | null> {
    const label = this.lib.labels.get(name);
    if (!label) {
      this.host.warn?.(`없는 라벨: ${name}`);
      return null;
    }
    if (++this.jumps > MAX_JUMPS) throw new Error('@goto 가 너무 많이 반복됨');
    try {
      await this.exec(label.body);
      return null;
    } catch (e) {
      if (e instanceof Jump) return e.label;
      if (e instanceof Stop || e instanceof Return) return null;
      throw e;
    }
  }

  /** @call: 라벨을 실행한 뒤 돌아온다 (그 안의 @goto 는 그 라벨 안에서 이어진다) */
  private async call(name: string): Promise<void> {
    let next: string | null = name;
    while (next) {
      if (next === STOP_LABEL) throw new Stop();
      const label = this.lib.labels.get(next);
      if (!label) {
        this.host.warn?.(`없는 라벨: ${next}`);
        return;
      }
      try {
        await this.exec(label.body);
        next = null;
      } catch (e) {
        if (e instanceof Jump) next = e.label;
        else if (e instanceof Return) next = null;
        else throw e;
      }
    }
  }

  private async exec(nodes: Node[]): Promise<void> {
    for (const nd of nodes) {
      switch (nd.kind) {
        case 'say':
          await this.host.say(nd.speaker, nd.expr, nd.side, nd.text);
          break;
        case 'choice': {
          const i = await this.host.choose(nd.options.map((o) => o.text));
          throw new Jump(nd.options[i].target);
        }
        case 'if': {
          const b = nd.branches.find((br) => evaluate(br.cond, game.state));
          await this.exec(b ? b.body : nd.elseBody);
          break;
        }
        case 'cmd':
          await this.cmd(nd);
          break;
      }
    }
  }

  private async cmd(c: Cmd): Promise<void> {
    await this.cmdInner(c);
    if (['flag', 'var', 'item', 'quest', 'money'].includes(c.name)) this.host.refresh?.();
  }

  private async cmdInner(c: Cmd): Promise<void> {
    const s = game.state;
    const a = c.args;
    switch (c.name) {
      case 'goto':
        throw new Jump(a[0]);
      case 'call':
        await this.call(a[0]);
        return;
      case 'return':
        throw new Return();
      case 'stop':
        throw new Stop();
      case 'flag': {
        // @flag 이름 = true   /  @flag 이름 (= true)
        const v = (a[2] ?? a[1] ?? 'true').toLowerCase();
        s.flags[a[0]] = !(v === 'false' || v === '거짓' || v === '0');
        return;
      }
      case 'var': {
        // @var 이름 = 3 | += 1 | -= 1
        const op = a[1] ?? '=';
        const n = Number(a[2] ?? a[1]);
        const cur = s.vars[a[0]] ?? 0;
        s.vars[a[0]] = op === '+=' ? cur + n : op === '-=' ? cur - n : n;
        return;
      }
      case 'money': {
        // @money +500 | -30 | =100
        const t = a[0] ?? '0';
        if (t.startsWith('=')) s.money = Number(t.slice(1));
        else s.money = Math.max(0, s.money + Number(t));
        return;
      }
      case 'item': {
        // @item 생일 케이크 +1  (이름에 공백 허용: 마지막 인자가 수량)
        const last = a[a.length - 1];
        const hasN = /^[+-]\d+$/.test(last);
        const name = (hasN ? a.slice(0, -1) : a).join(' ');
        const n = hasN ? Number(last) : 1;
        addItem(s, name, n);
        if (n > 0) autoEquip(s, name, ITEMS[name]?.type === 'weapon');
        return;
      }
      case 'quest': {
        // @quest M01 시작 "설명" | 목표 "…" | 완료
        const action = a[1] as '시작' | '목표' | '완료';
        setQuest(s, a[0], action, a[2]);
        return;
      }
      case 'time': {
        // @time 아침 | @time next
        const t = a[0];
        if (t === 'next' || t === '다음') {
          this.advanceTime(1);
        } else {
          const target = PERIODS.indexOf(t as never);
          if (target < 0) this.host.warn?.(`알 수 없는 시간대: ${t}`);
          else {
            const cur = PERIODS.indexOf(s.time.period);
            const steps = (target - cur + PERIODS.length) % PERIODS.length;
            if (steps) this.advanceTime(steps);
          }
        }
        await this.host.command(c);
        return;
      }
      case 'speed':
        s.playerSpeed = Number(a[0] ?? 1) || 1;
        return;
      default: {
        const r = await this.host.command(c);
        if (r && r.goto) throw new Jump(r.goto);
      }
    }
  }

  private advanceTime(steps: number): void {
    const s = game.state;
    for (let i = 0; i < steps; i++) {
      const idx = PERIODS.indexOf(s.time.period) + 1;
      if (idx >= PERIODS.length) s.time.day += 1;
      s.time.period = PERIODS[idx % PERIODS.length];
    }
    this.host.onTimeAdvance?.(steps);
  }
}
