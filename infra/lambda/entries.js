'use strict';

/**
 * 한마디 엔트리 API.
 *
 * 번들러를 쓰지 않으므로 Lambda 런타임에 기본 포함된 것만 사용한다.
 * @aws-sdk/client-dynamodb 는 Node 20 런타임에 들어 있다.
 * 스키마가 전부 문자열이라 marshall 헬퍼 없이 직접 변환한다.
 */
const {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} = require('@aws-sdk/client-dynamodb');

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 280;
const MOODS = ['good', 'soso', 'bad'];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function toItem(row) {
  const item = {
    userId: { S: row.userId },
    date: { S: row.date },
    text: { S: row.text },
    updatedAt: { S: row.updatedAt },
  };
  if (row.mood) item.mood = { S: row.mood };
  return item;
}

function fromItem(item) {
  if (!item) return null;
  return {
    date: item.date.S,
    text: item.text.S,
    mood: item.mood ? item.mood.S : null,
    updatedAt: item.updatedAt.S,
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

async function listEntries(userId, query) {
  const from = query.from;
  const to = query.to;

  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': { S: userId } },
    ScanIndexForward: false, // 최신 날짜 먼저
    Limit: Math.min(Number(query.limit) || 100, 365),
  };

  // 기간이 주어지면 SK range query, 아니면 최근 것부터 전부.
  // date 는 DynamoDB 예약어라 이름을 치환해야 하는데, 쓰지도 않는
  // ExpressionAttributeNames 를 넘기면 ValidationException 이 난다.
  // 그래서 범위 조회일 때만 붙인다.
  if (from && to) {
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return json(400, { message: 'from, to 는 YYYY-MM-DD 형식이어야 합니다.' });
    }
    params.KeyConditionExpression += ' AND #d BETWEEN :from AND :to';
    params.ExpressionAttributeNames = { '#d': 'date' };
    params.ExpressionAttributeValues[':from'] = { S: from };
    params.ExpressionAttributeValues[':to'] = { S: to };
  }

  const res = await ddb.send(new QueryCommand(params));

  return json(200, { entries: (res.Items || []).map(fromItem) });
}

async function getEntry(userId, date) {
  const res = await ddb.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { userId: { S: userId }, date: { S: date } },
    }),
  );
  const entry = fromItem(res.Item);
  if (!entry) return json(404, { message: '해당 날짜의 기록이 없습니다.' });
  return json(200, { entry });
}

async function putEntry(userId, date, event) {
  const parsed = parseBody(event);
  if (parsed.error) return json(400, { message: parsed.error });

  const entry = {
    userId,
    date,
    text: parsed.text,
    mood: parsed.mood,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutItemCommand({ TableName: TABLE_NAME, Item: toItem(entry) }),
  );

  return json(200, {
    entry: {
      date: entry.date,
      text: entry.text,
      mood: entry.mood,
      updatedAt: entry.updatedAt,
    },
  });
}

async function deleteEntry(userId, date) {
  await ddb.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: { userId: { S: userId }, date: { S: date } },
    }),
  );
  return json(204, {});
}

exports.handler = async (event) => {
  // JWT 권한 부여자가 통과시킨 요청만 도달한다. sub 이 곧 사용자 식별자.
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
  const query = event.queryStringParameters || {};

  if (date && !DATE_RE.test(date)) {
    return json(400, { message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' });
  }

  try {
    if (!date) {
      if (method === 'GET') return await listEntries(userId, query);
      return json(405, { message: `${method} 는 지원하지 않습니다.` });
    }

    if (method === 'GET') return await getEntry(userId, date);
    if (method === 'PUT') return await putEntry(userId, date, event);
    if (method === 'DELETE') return await deleteEntry(userId, date);

    return json(405, { message: `${method} 는 지원하지 않습니다.` });
  } catch (err) {
    console.error('unhandled error', err);
    return json(500, { message: '서버 오류가 발생했습니다.' });
  }
};
