'use strict';

/**
 * 한마디 엔트리 API 의 공통 로직.
 *
 * 저장소를 주입받아 클라우드(DynamoDB)와 로컬(JSON 파일)이 같은 규칙으로 돈다.
 * 검증과 라우팅이 이 파일 한 곳에만 있어야 두 실행 환경이 갈라지지 않는다.
 *
 * 저장소는 아래 네 가지만 구현하면 된다. 모두 Promise 를 준다.
 *   list(userId, { from, to, limit })  최신 날짜부터, limit 개까지
 *   get(userId, date)                  없으면 null
 *   put(userId, entry)                 같은 날짜면 덮어쓴다
 *   remove(userId, date)               없어도 조용히 넘어간다
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 280;
const MOODS = ['good', 'soso', 'bad'];

/** 서버가 한 번에 내주는 최대 개수. 1 년 치면 달력과 통계에 충분하다. */
const MAX_LIMIT = 365;
const DEFAULT_LIMIT = 100;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

/** 본문을 파싱하고 검증한다. 통과하면 {text, mood}, 아니면 {error} 를 준다. */
function parseBody(event) {
  let raw = event.body;
  if (!raw) return { error: '본문이 비어 있습니다.' };
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'JSON 형식이 아닙니다.' };
  }

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
  if (!text) return { error: '내용을 입력해 주세요.' };
  if (text.length > MAX_TEXT) {
    return { error: `내용은 ${MAX_TEXT}자를 넘을 수 없습니다.` };
  }

  const mood = parsed.mood == null ? null : String(parsed.mood);
  if (mood !== null && !MOODS.includes(mood)) {
    return { error: `mood 는 ${MOODS.join(', ')} 중 하나여야 합니다.` };
  }

  return { text, mood };
}

/** from 과 to 는 함께 줘야 적용된다. 하나만 오면 조용히 무시한다. */
function parseQuery(query) {
  const limit = Math.min(Number(query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const from = query.from;
  const to = query.to;

  if (from && to) {
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return { error: 'from, to 는 YYYY-MM-DD 형식이어야 합니다.' };
    }
    return { from, to, limit };
  }

  return { limit };
}

function createHandler(store) {
  return async function handler(event) {
    // 클라우드에서는 JWT 권한 부여자가, 로컬에서는 서버가 사용자를 정한다.
    const claims =
      event.requestContext &&
      event.requestContext.authorizer &&
      event.requestContext.authorizer.jwt &&
      event.requestContext.authorizer.jwt.claims;
    const userId = claims && claims.sub;

    if (!userId) {
      return json(401, { message: '인증 정보를 확인할 수 없습니다.' });
    }

    const method = event.requestContext.http.method;
    const date = event.pathParameters && event.pathParameters.date;

    if (date && !DATE_RE.test(date)) {
      return json(400, { message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' });
    }

    try {
      if (!date) {
        if (method !== 'GET') {
          return json(405, { message: `${method} 는 지원하지 않습니다.` });
        }
        const query = parseQuery(event.queryStringParameters || {});
        if (query.error) return json(400, { message: query.error });
        return json(200, { entries: await store.list(userId, query) });
      }

      if (method === 'GET') {
        const entry = await store.get(userId, date);
        if (!entry) return json(404, { message: '해당 날짜의 기록이 없습니다.' });
        return json(200, { entry });
      }

      if (method === 'PUT') {
        const parsed = parseBody(event);
        if (parsed.error) return json(400, { message: parsed.error });

        const entry = {
          date,
          text: parsed.text,
          mood: parsed.mood,
          updatedAt: new Date().toISOString(),
        };
        await store.put(userId, entry);
        return json(200, { entry });
      }

      if (method === 'DELETE') {
        await store.remove(userId, date);
        return json(204, {});
      }

      return json(405, { message: `${method} 는 지원하지 않습니다.` });
    } catch (err) {
      console.error('unhandled error', err);
      return json(500, { message: '서버 오류가 발생했습니다.' });
    }
  };
}

module.exports = { createHandler, MAX_LIMIT, MAX_TEXT, MOODS, DATE_RE };
