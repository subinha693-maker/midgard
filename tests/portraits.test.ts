import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import data from '../data/portraits.json';
import ill from '../data/illustrations.json';

// 연결표가 실제 파일을 가리키는지, 기본 표정이 있는지 확인
describe('portraits.json', () => {
  for (const [actor, set] of Object.entries((data as any).characters)) {
    const s = set as any;
    it(`${actor}: 기본 표정 존재`, () => expect(s.expressions[s.default]).toBeTruthy());
    it(`${actor}: 파일 존재`, () => {
      for (const e of Object.values(s.expressions) as any[]) expect(existsSync(e.file), e.file).toBe(true);
    });
  }
});

describe('illustrations.json', () => {
  it('파일 존재', () => {
    for (const e of Object.values((ill as any).illustrations) as any[]) expect(existsSync(e.file), e.file).toBe(true);
  });
});
