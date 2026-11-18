// 원고(.md) 파서 — 형식은 docs/scenario_format.md
// 화면과 분리된 순수 함수. 문법 오류는 줄 번호와 함께 모아 돌려준다.

export interface Say { kind: 'say'; line: number; speaker?: string; expr?: string; side?: 'left' | 'right'; text: string }
export interface ChoiceOpt { text: string; target: string; line: number }
export interface Choice { kind: 'choice'; line: number; options: ChoiceOpt[] }
export interface IfNode { kind: 'if'; line: number; branches: { cond: string; body: Node[] }[]; elseBody: Node[] }
export interface Cmd { kind: 'cmd'; line: number; name: string; args: string[]; raw: string }
export type Node = Say | Choice | IfNode | Cmd;

export interface Label { name: string; file: string; line: number; body: Node[] }
export interface ParseError { file: string; line: number; message: string }

/** 원고에서 쓸 수 있는 명령. 인자 문법은 docs/scenario_format.md */
export const COMMANDS = new Set([
  'map', 'move', 'face', 'wait', 'fade', 'shake', 'tint', 'distort', 'cg', 'letter', 'battle',
  'flag', 'var', 'goto', 'call', 'return', 'stop', 'quest', 'item', 'money', 'concentration', 'time',
  'sprite', 'bgm', 'se', 'subtitle', 'speed', 'show', 'hide', 'save', 'autosave', 'title', 'end_demo',
]);

/** 따옴표를 존중해 공백으로 나눈다: 목표 "마을을 둘러본다" → ['목표', '마을을 둘러본다'] */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|“([^”]*)”|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const SAY_RE = /^\[([^\]:@]+)(?::([^\]@]+))?(?:@(왼쪽|오른쪽))?\]\s*(.*)$/;

function unescape(t: string): string {
  return t.replace(/\\n/g, '\n');
}

export function parseScenario(text: string, file: string): { labels: Label[]; errors: ParseError[] } {
  const labels: Label[] = [];
  const errors: ParseError[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  const err = (line: number, message: string) => errors.push({ file, line, message });

  let current: Label | null = null;
  // 블록 스택: 현재 명령을 넣을 목록. if 블록마다 하나씩 쌓인다
  let stack: { node: IfNode | null; list: Node[] }[] = [];
  let pendingChoice: Choice | null = null;
  let inComment = false;

  const closeLabel = (lineNo: number) => {
    if (current && stack.length > 1) err(stack[stack.length - 1].node!.line, '@if 가 @end 로 닫히지 않음');
    if (pendingChoice && pendingChoice.options.length < 2) err(pendingChoice.line, '선택지는 2~4개여야 함');
    pendingChoice = null;
    void lineNo;
  };

  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const rawLine = lines[i];
    let line = rawLine.trim();

    // 주석: <!-- --> 또는 // 로 시작
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inComment = true;
      continue;
    }
    if (!line || line.startsWith('//')) continue;

    // 선택지 항목
    if (pendingChoice && line.startsWith('-')) {
      const m = line.match(/^-\s*(.+?)\s*->\s*(\S+)\s*$/);
      if (!m) err(n, '선택지 형식: "- 텍스트 -> 라벨"');
      else pendingChoice.options.push({ text: m[1], target: m[2], line: n });
      if (pendingChoice.options.length > 4) err(n, '선택지는 최대 4개');
      continue;
    }
    if (pendingChoice) {
      if (pendingChoice.options.length < 2) err(pendingChoice.line, '선택지는 2~4개여야 함');
      pendingChoice = null;
    }

    if (line.startsWith('# ')) {
      closeLabel(n);
      const name = line.slice(2).trim().split(/\s+/)[0];
      current = { name, file, line: n, body: [] };
      labels.push(current);
      stack = [{ node: null, list: current.body }];
      continue;
    }
    if (line.startsWith('#')) {
      // "## 제목" 같은 마크다운 머리글은 무시 (원고 정리용)
      continue;
    }
    if (!current) {
      // 첫 라벨 앞의 글(제목·'초안' 표시 등)은 무시
      continue;
    }
    const top = stack[stack.length - 1];

    if (line.startsWith('@')) {
      const sp = line.indexOf(' ');
      const name = (sp < 0 ? line.slice(1) : line.slice(1, sp)).trim();
      const rest = sp < 0 ? '' : line.slice(sp + 1).trim();
      if (name === 'if') {
        if (!rest) err(n, '@if 뒤에 조건이 없음');
        const node: IfNode = { kind: 'if', line: n, branches: [{ cond: rest, body: [] }], elseBody: [] };
        top.list.push(node);
        stack.push({ node, list: node.branches[0].body });
      } else if (name === 'elif') {
        if (!top.node) { err(n, '@elif 앞에 @if 가 없음'); continue; }
        const b = { cond: rest, body: [] as Node[] };
        top.node.branches.push(b);
        top.list = b.body;
      } else if (name === 'else') {
        if (!top.node) { err(n, '@else 앞에 @if 가 없음'); continue; }
        top.list = top.node.elseBody;
      } else if (name === 'end') {
        if (!top.node) { err(n, '@end 앞에 @if 가 없음'); continue; }
        stack.pop();
      } else if (name === 'choice') {
        pendingChoice = { kind: 'choice', line: n, options: [] };
        top.list.push(pendingChoice);
      } else {
        if (!COMMANDS.has(name)) err(n, `알 수 없는 명령 @${name}`);
        top.list.push({ kind: 'cmd', line: n, name, args: splitArgs(rest), raw: rest });
      }
      continue;
    }

    const m = line.match(SAY_RE);
    if (m) {
      const side = m[3] === '왼쪽' ? 'left' : m[3] === '오른쪽' ? 'right' : undefined;
      top.list.push({ kind: 'say', line: n, speaker: m[1].trim(), expr: m[2]?.trim(), side, text: unescape(m[4]) });
      continue;
    }
    if (line.startsWith('[')) {
      err(n, '대사 형식: [인물:표정] 대사');
      continue;
    }
    // 그 밖의 줄은 서술(이름 없는 대사)
    top.list.push({ kind: 'say', line: n, text: unescape(line) });
  }
  closeLabel(lines.length);
  if (stack.length > 1) err(stack[stack.length - 1].node!.line, '@if 가 @end 로 닫히지 않음');
  return { labels, errors };
}

/** 여러 원고 파일을 묶은 라벨 사전 */
export class ScriptLibrary {
  labels = new Map<string, Label>();
  errors: ParseError[] = [];

  add(text: string, file: string): void {
    const r = parseScenario(text, file);
    this.errors.push(...r.errors);
    for (const l of r.labels) {
      const prev = this.labels.get(l.name);
      if (prev) this.errors.push({ file, line: l.line, message: `라벨 "${l.name}" 중복 (${prev.file}:${prev.line})` });
      else this.labels.set(l.name, l);
    }
  }

  /** @goto·@call·선택지가 가리키는 라벨이 실제로 있는지 확인 */
  validate(extraTargets: { file: string; line: number; label: string }[] = []): void {
    const check = (file: string, line: number, target: string) => {
      if (!this.labels.has(target)) this.errors.push({ file, line, message: `없는 라벨 "${target}"` });
    };
    const walk = (file: string, nodes: Node[]) => {
      for (const nd of nodes) {
        if (nd.kind === 'choice') nd.options.forEach((o) => check(file, o.line, o.target));
        else if (nd.kind === 'cmd' && (nd.name === 'goto' || nd.name === 'call')) check(file, nd.line, nd.args[0] ?? '');
        else if (nd.kind === 'if') {
          nd.branches.forEach((b) => walk(file, b.body));
          walk(file, nd.elseBody);
        }
      }
    };
    for (const l of this.labels.values()) walk(l.file, l.body);
    for (const t of extraTargets) check(t.file, t.line, t.label);
  }
}
