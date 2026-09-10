'use strict';

/**
 * DynamoDB 저장소. 클라우드에서 쓴다.
 *
 * 번들러를 쓰지 않으므로 Lambda 런타임에 기본 포함된 것만 사용한다.
 * @aws-sdk/client-dynamodb 는 Node 런타임에 들어 있다.
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

function toItem(userId, entry) {
  const item = {
    userId: { S: userId },
    date: { S: entry.date },
    text: { S: entry.text },
    updatedAt: { S: entry.updatedAt },
  };
  if (entry.mood) item.mood = { S: entry.mood };
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

const store = {
  async list(userId, { from, to, limit }) {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': { S: userId } },
      ScanIndexForward: false, // 최신 날짜 먼저
      Limit: limit,
    };

    // 기간이 주어지면 SK range query, 아니면 최근 것부터 전부.
    // date 는 DynamoDB 예약어라 이름을 치환해야 하는데, 쓰지도 않는
    // ExpressionAttributeNames 를 넘기면 ValidationException 이 난다.
    // 그래서 범위 조회일 때만 붙인다.
    if (from && to) {
      params.KeyConditionExpression += ' AND #d BETWEEN :from AND :to';
      params.ExpressionAttributeNames = { '#d': 'date' };
      params.ExpressionAttributeValues[':from'] = { S: from };
      params.ExpressionAttributeValues[':to'] = { S: to };
    }

    const res = await ddb.send(new QueryCommand(params));
    return (res.Items || []).map(fromItem);
  },

  async get(userId, date) {
    const res = await ddb.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { userId: { S: userId }, date: { S: date } },
      }),
    );
    return fromItem(res.Item);
  },

  async put(userId, entry) {
    await ddb.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: toItem(userId, entry),
      }),
    );
  },

  async remove(userId, date) {
    await ddb.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { userId: { S: userId }, date: { S: date } },
      }),
    );
  },
};

module.exports = { store };
