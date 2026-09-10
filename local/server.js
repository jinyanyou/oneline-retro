/**
 * 로컬 API 서버.
 *
 * AWS 없이 한마디를 쓰기 위한 것이다. API Gateway 와 Lambda 가 하던 일을
 * 이 파일이 대신하되, 라우팅과 검증은 클라우드와 같은 core.js 를 쓴다.
 * 저장소만 DynamoDB 에서 JSON 파일로 바꿔 끼운다.
 *
 * 로그인은 없다. 127.0.0.1 에만 붙으므로 이 컴퓨터 밖에서는 닿지 않고,
 * 사용자는 아래 LOCAL_USER 하나로 고정한다.
 *
 *   node local/server.js            기본 8787 포트
 *   PORT=9000 node local/server.js  포트 지정
 */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createFileStore } from './file-store.js';

// core.js 는 Lambda 런타임에 맞춘 CommonJS 라 이렇게 불러온다.
const require = createRequire(import.meta.url);
const { createHandler } = require('../infra/lambda/core.js');

const here = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = 8787;
const HOST = '127.0.0.1';

/** 로컬에는 사용자 개념이 없다. 클라우드의 Cognito sub 자리에 이걸 넣는다. */
const LOCAL_USER = 'local';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 들어온 요청을 core.js 가 아는 API Gateway(HTTP API) 이벤트 모양으로 바꾼다. */
async function toEvent(req, url) {
  const rest = url.pathname.replace(/^\/entries\/?/, '');
  return {
    requestContext: {
      http: { method: req.method },
      // 클라우드에서 JWT 권한 부여자가 채우는 자리를 그대로 흉내 낸다.
      authorizer: { jwt: { claims: { sub: LOCAL_USER } } },
    },
    pathParameters: rest ? { date: decodeURIComponent(rest) } : undefined,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: req.method === 'PUT' ? await readBody(req) : undefined,
    isBase64Encoded: false,
  };
}

export function startApi({ port = Number(process.env.PORT) || DEFAULT_PORT, dataFile } = {}) {
  const file = dataFile ?? process.env.HANMADI_DATA ?? path.join(here, 'data.json');
  const handler = createHandler(createFileStore(file));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
      return;
    }

    // 브라우저 주소창으로 열어 본 사람에게 알려 준다.
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', ...CORS });
      res.end(`한마디 로컬 API 가 돌고 있습니다.\n기록 파일: ${file}\n`);
      return;
    }

    if (!url.pathname.startsWith('/entries')) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', ...CORS });
      res.end(JSON.stringify({ message: '없는 경로입니다.' }));
      return;
    }

    try {
      const result = await handler(await toEvent(req, url));
      const headers = { ...result.headers, ...CORS };

      // 204 에 본문을 실으면 안 된다. core 는 빈 객체를 주지만 여기서 버린다.
      if (result.statusCode === 204) {
        res.writeHead(204, CORS).end();
        return;
      }

      res.writeHead(result.statusCode, headers);
      res.end(result.body);
    } catch (err) {
      console.error('요청을 처리하지 못했습니다', err);
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', ...CORS });
      res.end(JSON.stringify({ message: '서버 오류가 발생했습니다.' }));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      resolve({ server, url: `http://localhost:${port}`, file });
    });
  });
}

// 직접 실행했을 때만 서버를 띄운다. local/dev.js 가 불러 쓸 때는 조용히 있는다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url, file } = await startApi();
  console.log(`한마디 로컬 API  ${url}`);
  console.log(`기록 파일        ${file}`);
}
