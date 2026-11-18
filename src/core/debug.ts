// 개발 모드: URL에 ?debug=1 또는 #debug (아티팩트 페이지에서는 # 만 전달됨)
export const DEBUG =
  new URLSearchParams(location.search).get('debug') === '1' || location.hash === '#debug';

export function devWarn(...args: unknown[]): void {
  if (DEBUG || import.meta.env.DEV) console.warn('[미드가르드]', ...args);
}
