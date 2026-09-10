/**
 * JSON 파일 저장소. 로컬에서 쓴다.
 *
 * DynamoDB 저장소와 같은 네 가지를 구현해 core.js 에 끼운다.
 * 기록이 많아야 하루 한 줄이라 통째로 메모리에 올려 두고, 바뀔 때마다
 * 파일에 쓴다.
 *
 * 파일 모양:
 *   { "entries": { "<userId>": { "<YYYY-MM-DD>": { date, text, mood, updatedAt } } } }
 */
import fs from 'node:fs';
import path from 'node:path';

export function createFileStore(file) {
  const data = read();

  /**
   * 파일이 없으면 새로 시작한다. 다만 파일이 있는데 깨져 있으면
   * 멈춘다 — 빈 값으로 덮어쓰면 그대로 기록이 날아간다.
   */
  function read() {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return { entries: {} };
      throw err;
    }

    try {
      const parsed = JSON.parse(raw);
      return parsed && parsed.entries ? parsed : { entries: {} };
    } catch {
      throw new Error(
        `${file} 을 읽을 수 없습니다 (JSON 형식이 아님).\n` +
          '내용을 확인해 고치거나, 파일을 옮겨 두고 다시 시작하세요.',
      );
    }
  }

  /** 같은 자리에 바로 쓰지 않는다. 쓰다 멈추면 파일이 반만 남는다. */
  function write() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, file);
  }

  function bucket(userId) {
    if (!data.entries[userId]) data.entries[userId] = {};
    return data.entries[userId];
  }

  return {
    async list(userId, { from, to, limit }) {
      let rows = Object.values(bucket(userId));
      if (from && to) {
        rows = rows.filter((e) => e.date >= from && e.date <= to);
      }
      // 최신 날짜 먼저. DynamoDB 의 ScanIndexForward: false 와 같다.
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return rows.slice(0, limit);
    },

    async get(userId, date) {
      return bucket(userId)[date] ?? null;
    },

    async put(userId, entry) {
      bucket(userId)[entry.date] = entry;
      write();
    },

    async remove(userId, date) {
      delete bucket(userId)[date];
      write();
    },
  };
}
