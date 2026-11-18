// 게임 상태: 플래그·변수·소지금·소지품·파티·퀘스트·위치·시간
// 화면과 분리된 순수 데이터. 저장 파일은 이 객체를 그대로 직렬화한다.

export type Dir = 'down' | 'left' | 'right' | 'up';
export type Period = '아침' | '낮' | '저녁' | '밤';
export const PERIODS: Period[] = ['아침', '낮', '저녁', '밤'];

export interface QuestState {
  status: 'active' | 'done';
  objective: string;
}

export interface GameState {
  flags: Record<string, boolean>;
  vars: Record<string, number>;
  money: number;
  items: Record<string, number>;
  party: string[];
  quests: Record<string, QuestState>;
  questOrder: string[];
  map: { id: string; x: number; y: number; dir: Dir };
  playerSprite: string;
  playerSpeed: number; // 이동 속도 배율 (M02 무기력 장면 등)
  time: { day: number; period: Period };
  concentration: Record<string, number>; // 발현 농도 (P3)
  playSeconds: number;
}

export function newState(): GameState {
  return {
    flags: {},
    vars: {},
    money: 0,
    items: {},
    party: ['클로토'],
    quests: {},
    questOrder: [],
    map: { id: '', x: 0, y: 0, dir: 'down' },
    playerSprite: 'klotho_home',
    playerSpeed: 1,
    time: { day: 1, period: '아침' },
    concentration: { 클로토: 0 },
    playSeconds: 0,
  };
}

/** 현재 진행 중인 게임 상태 (전역 하나) */
export const game: { state: GameState } = { state: newState() };

export function addItem(s: GameState, name: string, n: number): void {
  const v = (s.items[name] ?? 0) + n;
  if (v <= 0) delete s.items[name];
  else s.items[name] = v;
}

export function setQuest(s: GameState, id: string, action: '시작' | '목표' | '완료', text?: string): void {
  let q = s.quests[id];
  if (!q) {
    q = { status: 'active', objective: '' };
    s.quests[id] = q;
    s.questOrder.push(id);
  }
  if (action === '완료') q.status = 'done';
  else q.status = q.status === 'done' && action === '목표' ? 'done' : 'active';
  if (text !== undefined) q.objective = text;
}
