// 저장·불러오기 — localStorage. 저장 데이터에 버전 번호를 넣고, 구조가 바뀌면 migrate 에서 올려 준다.
import { SAVE } from '../config/save';
import { newState, type GameState } from './state';

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  savedAt: string; // ISO 시각
  summary: string; // 슬롯 목록에 보일 한 줄 (맵 이름 · 일차 등)
  state: GameState;
}

export type Slot = 'auto' | 1 | 2 | 3;

/** 테스트에서 가짜 저장소를 넣을 수 있게 */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function store(): KV | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const key = (slot: Slot) => SAVE.storagePrefix + slot;

/** 옛 버전 저장 데이터를 현재 구조로 올린다. 빠진 칸은 새 게임 기본값으로 채운다 */
export function migrate(raw: unknown): SaveFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<SaveFile> & { version?: number };
  if (typeof f.version !== 'number' || !f.state) return null;
  if (f.version > SAVE_VERSION) return null; // 더 새로운 게임에서 만든 저장
  const base = newState();
  const st = { ...base, ...f.state } as GameState;
  // 하위 객체도 빠진 키를 채움
  st.map = { ...base.map, ...(f.state.map ?? {}) };
  st.time = { ...base.time, ...(f.state.time ?? {}) };
  st.concentration = { ...base.concentration, ...(f.state.concentration ?? {}) };
  // (버전별 변환은 여기에 추가: if (f.version < 2) { … })
  return { version: SAVE_VERSION, savedAt: f.savedAt ?? '', summary: f.summary ?? '', state: st };
}

export function writeSave(slot: Slot, state: GameState, summary: string, kv: KV | null = store()): boolean {
  if (!kv) return false;
  const file: SaveFile = { version: SAVE_VERSION, savedAt: new Date().toISOString(), summary, state };
  try {
    kv.setItem(key(slot), JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function readSave(slot: Slot, kv: KV | null = store()): SaveFile | null {
  if (!kv) return null;
  try {
    const t = kv.getItem(key(slot));
    return t ? migrate(JSON.parse(t)) : null;
  } catch {
    return null;
  }
}

export function deleteSave(slot: Slot, kv: KV | null = store()): void {
  kv?.removeItem(key(slot));
}

export function allSlots(): Slot[] {
  const s: Slot[] = ['auto'];
  for (let i = 1; i <= SAVE.slots; i++) s.push(i as Slot);
  return s;
}

export function hasAnySave(kv: KV | null = store()): boolean {
  return allSlots().some((s) => readSave(s, kv) !== null);
}
