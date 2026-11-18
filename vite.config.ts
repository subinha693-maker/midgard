import { defineConfig } from 'vite';

// 정적 빌드: dist/ 를 어느 정적 호스팅에 올려도 열리도록 상대 경로 사용
export default defineConfig({
  base: './',
  server: { host: false, port: 5173 },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
