import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 걸음 도트 시트 규격: 144×192 (48×48 프레임 3열×4행)
function pngSize(path: string) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('걸음 도트 시트', () => {
  for (const n of ['klotho_coat', 'klotho_home', 'anan', 'hans']) {
    it(`${n}.png 144×192`, () => expect(pngSize(`assets/sprites/${n}.png`)).toEqual({ w: 144, h: 192 }));
  }
});
