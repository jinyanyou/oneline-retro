/**
 * 로컬 모드 실행기.
 *
 * API 서버와 Vite 개발 서버를 한 프로세스에서 같이 띄운다.
 * 터미널을 두 개 열 필요도, .env 를 고쳐 둘 필요도 없다.
 *
 *   npm run dev:local
 *
 * .env 에 클라우드 값이 들어 있어도 여기서 넣는 값이 이긴다. define 으로
 * 빌드 시점에 박아 넣기 때문이다.
 */
import { createServer } from 'vite';

import { startApi } from './server.js';

const api = await startApi();

const vite = await createServer({
  define: {
    'import.meta.env.VITE_LOCAL_MODE': JSON.stringify('1'),
    'import.meta.env.VITE_API_URL': JSON.stringify(api.url),
  },
});

await vite.listen();

console.log('\n  한마디 — 로컬 모드 (AWS 를 쓰지 않는다)\n');
vite.printUrls();
console.log(`\n  API      ${api.url}`);
console.log(`  기록 파일 ${api.file}\n`);
