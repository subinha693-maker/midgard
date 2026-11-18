// 에셋 경로 해석: assets/ 아래 파일을 빌드에 포함시키고 실제 URL로 바꿔 준다.
// 원본 파일은 읽기만 한다.
const files = import.meta.glob('/assets/**/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** "assets/user/xxx.png" 처럼 저장소 기준 경로 → 브라우저 URL */
export function assetUrl(path: string): string | undefined {
  const key = '/' + path.replace(/^\/+/, '');
  return files[key];
}
