// 개발 모드 패널 (URL 에 ?debug=1) — 화면 위 DOM 으로 띄운다
//  - 원고·맵 오류 목록 (줄 번호)
//  - 아무 라벨 바로 실행 / 아무 맵으로 이동
//  - 플래그·변수·소지금 편집
import { contentErrors, library, maps } from '../scenario/content';
import { game } from './state';
import type { FieldScene } from '../scenes/FieldScene';

function field(): FieldScene | undefined {
  return (window as unknown as { __field?: FieldScene }).__field;
}

export function mountDevPanel(): void {
  const css = document.createElement('style');
  css.textContent = `
  #dev-btn{position:fixed;left:6px;top:6px;z-index:10;font:12px sans-serif;padding:4px 8px;background:#222c;color:#ddd;border:1px solid #666;border-radius:4px}
  #dev{position:fixed;left:6px;top:36px;z-index:10;width:340px;max-height:85vh;overflow:auto;background:#111e;color:#ddd;font:13px sans-serif;padding:10px;border:1px solid #555;border-radius:6px;display:none}
  #dev h4{margin:10px 0 4px;color:#e8c76a} #dev select,#dev input,#dev textarea{width:100%;box-sizing:border-box;background:#222;color:#eee;border:1px solid #555;margin:2px 0}
  #dev button{margin:2px 2px 2px 0;background:#333;color:#eee;border:1px solid #666;padding:4px 8px}
  #dev .err{color:#ff8a80;white-space:pre-wrap;font-family:monospace;font-size:12px}`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.id = 'dev-btn';
  btn.textContent = contentErrors.length ? `개발 ⚠${contentErrors.length}` : '개발';
  const box = document.createElement('div');
  box.id = 'dev';
  document.body.append(btn, box);
  btn.onclick = () => {
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
    if (box.style.display === 'block') render();
  };

  const render = () => {
    const labels = [...library.labels.keys()];
    const mapIds = [...maps.keys()];
    const s = game.state;
    box.innerHTML = `
      <h4>오류 ${contentErrors.length}개</h4>
      <div class="err">${contentErrors.map((e) => `${e.file}:${e.line}  ${e.message}`).join('\n') || '없음'}</div>
      <h4>라벨 실행 (아무 장면으로 바로 가기)</h4>
      <select id="dv-label">${labels.map((l) => `<option>${l}</option>`).join('')}</select>
      <button id="dv-run">실행</button>
      <h4>맵 이동</h4>
      <select id="dv-map">${mapIds.map((m) => `<option ${m === s.map.id ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input id="dv-xy" placeholder="x,y" value="${s.map.x},${s.map.y}">
      <button id="dv-go">이동</button>
      <h4>상태 (플래그·변수·소지금·소지품)</h4>
      <textarea id="dv-state" rows="10">${JSON.stringify({ flags: s.flags, vars: s.vars, money: s.money, items: s.items, time: s.time, concentration: s.concentration }, null, 1)}</textarea>
      <button id="dv-apply">적용</button> <button id="dv-refresh">새로 읽기</button>`;
    const $ = (id: string) => box.querySelector('#' + id) as HTMLInputElement;
    $('dv-run').onclick = () => {
      const f = field();
      if (!f) return alert('필드에서만 실행할 수 있음 (새 게임을 먼저 시작)');
      void f.runScript($('dv-label').value);
    };
    $('dv-go').onclick = () => {
      const f = field();
      if (!f) return;
      const [x, y] = $('dv-xy').value.split(',').map(Number);
      void f.transfer($('dv-map').value, x || 0, y || 0);
    };
    $('dv-apply').onclick = () => {
      try {
        Object.assign(game.state, JSON.parse(($('dv-state') as unknown as HTMLTextAreaElement).value));
        field()?.refreshEvents();
        field()?.applyTimeTint();
      } catch (e) {
        alert('JSON 오류: ' + (e as Error).message);
      }
    };
    $('dv-refresh').onclick = render;
  };
  if (contentErrors.length) {
    console.warn('[미드가르드] 원고·맵 오류', contentErrors);
    box.style.display = 'block';
    render();
  }
}
