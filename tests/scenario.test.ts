import { describe, it, expect, beforeEach } from 'vitest';
import { parseScenario, ScriptLibrary, splitArgs } from '../src/scenario/parser';
import { Runner, type Host } from '../src/scenario/runner';
import { evaluate } from '../src/scenario/cond';
import { game, newState } from '../src/core/state';

const SRC = `<!-- 초안 -->
제목 줄은 무시
# 시작
[아난:기본] 일어났어?
[클로토:당황@오른쪽] ……알면서.
그냥 서술 줄
@flag 아침_끝 = true
@var 횟수 += 2
@choice
  - 묻는다 -> 묻기
  - 넘어간다 -> 계속

# 묻기
@if 횟수 >= 2
[아난] 몰라.
@else
[아난] 글쎄.
@end
@goto 계속

# 계속
@quest M01 목표 "마을을 둘러본다"
@item 생일 케이크 +1
@money +500
`;

describe('원고 파서', () => {
  it('라벨·대사·선택지·조건 블록', () => {
    const { labels, errors } = parseScenario(SRC, 't.md');
    expect(errors).toEqual([]);
    expect(labels.map((l) => l.name)).toEqual(['시작', '묻기', '계속']);
    const b = labels[0].body;
    expect(b[0]).toMatchObject({ kind: 'say', speaker: '아난', expr: '기본', text: '일어났어?' });
    expect(b[1]).toMatchObject({ kind: 'say', speaker: '클로토', expr: '당황', side: 'right' });
    expect(b[2]).toMatchObject({ kind: 'say', text: '그냥 서술 줄' });
    expect((b[2] as { speaker?: string }).speaker).toBeUndefined();
    expect(b[5]).toMatchObject({ kind: 'choice', options: [{ text: '묻는다', target: '묻기' }, { text: '넘어간다', target: '계속' }] });
  });

  it('문법 오류는 줄 번호와 함께', () => {
    const { errors } = parseScenario('# 가\n@없는명령 1\n@if 조건\n[이름\n', 'e.md');
    const lines = errors.map((e) => e.line);
    expect(lines).toContain(2); // 알 수 없는 명령
    expect(lines).toContain(3); // @end 없음
    expect(lines).toContain(4); // 대사 형식
  });

  it('없는 라벨을 가리키면 검증 오류', () => {
    const lib = new ScriptLibrary();
    lib.add('# 가\n@goto 없음\n', 'a.md');
    lib.validate();
    expect(lib.errors[0].message).toContain('없음');
  });

  it('따옴표 인자', () => {
    expect(splitArgs('M01 목표 "마을을 둘러본다"')).toEqual(['M01', '목표', '마을을 둘러본다']);
  });
});

describe('조건식', () => {
  beforeEach(() => {
    game.state = newState();
  });
  it('플래그·변수·소지금·아이템', () => {
    const s = game.state;
    s.flags['a'] = true;
    s.vars['n'] = 3;
    s.money = 120;
    s.items['열쇠'] = 1;
    expect(evaluate('a', s)).toBe(true);
    expect(evaluate('!a', s)).toBe(false);
    expect(evaluate('n >= 3 && 소지금 > 100', s)).toBe(true);
    expect(evaluate('아이템:열쇠', s)).toBe(true);
    expect(evaluate('아이템:없음 || b', s)).toBe(false);
  });
});

describe('원고 실행기', () => {
  beforeEach(() => {
    game.state = newState();
  });
  it('선택지 → 분기 → 상태 변경', async () => {
    const lib = new ScriptLibrary();
    lib.add(SRC, 't.md');
    const said: string[] = [];
    const host: Host = {
      say: async (sp, _e, _s, t) => void said.push(`${sp ?? ''}:${t}`),
      choose: async () => 0,
      command: async () => {},
    };
    await new Runner(lib, host).run('시작');
    const s = game.state;
    expect(s.flags['아침_끝']).toBe(true);
    expect(s.vars['횟수']).toBe(2);
    expect(said).toContain('아난:몰라.');
    expect(s.quests['M01'].objective).toBe('마을을 둘러본다');
    expect(s.items['생일 케이크']).toBe(1);
    expect(s.money).toBe(500);
  });
});
