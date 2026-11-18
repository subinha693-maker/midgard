// 개발 모드: URL에 ?debug=1
export const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

export function devWarn(...args: unknown[]): void {
  if (DEBUG || import.meta.env.DEV) console.warn('[미드가르드]', ...args);
}
