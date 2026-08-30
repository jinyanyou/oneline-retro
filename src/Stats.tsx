import { useMemo } from 'react';

import type { Entry } from './api';
import { MOODS } from './moods';
import { parseKey, shiftDay } from './date';

/** 오늘(오늘이 비었으면 어제)부터 거꾸로 세는 연속 기록과, 역대 최장 연속. */
function streaks(dates: Set<string>, today: string) {
  let cursor = dates.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (dates.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...dates].sort()) {
    run = prev !== null && shiftDay(prev, 1) === date ? run + 1 : 1;
    if (run > best) best = run;
    prev = date;
  }

  return { current, best };
}

export function Stats({ entries, today }: { entries: Entry[]; today: string }) {
  const stat = useMemo(() => {
    const dates = new Set(entries.map((e) => e.date));
    const { current, best } = streaks(dates, today);

    // 기분별 개수. 고르지 않은 기록은 마지막 칸에 모은다.
    const counts = MOODS.map((m) => ({
      emoji: m.emoji,
      label: m.label,
      count: entries.filter((e) => e.mood === m.value).length,
    }));
    const none = entries.filter((e) => !e.mood).length;
    if (none) counts.push({ emoji: '·', label: '고르지 않음', count: none });

    // 이번 달은 아직 안 지난 날을 빼고 센다.
    const now = parseKey(today);
    const prefix = today.slice(0, 7);
    const elapsed = now.getDate();
    const thisMonth = entries.filter((e) => e.date.startsWith(prefix)).length;

    return { current, best, counts, total: entries.length, thisMonth, elapsed };
  }, [entries, today]);

  if (stat.total === 0) {
    return <p className="muted">기록이 쌓이면 여기에 통계가 나옵니다.</p>;
  }

  const rate = Math.round((stat.thisMonth / stat.elapsed) * 100);

  return (
    <div className="stats">
      <div className="tiles">
        <div className="tile">
          <b>{stat.current}</b>
          연속 기록 (일)
        </div>
        <div className="tile">
          <b>{stat.best}</b>
          최장 연속 (일)
        </div>
        <div className="tile">
          <b>{stat.total}</b>
          전체 기록 (개)
        </div>
      </div>

      <div className="field-row">
        <span className="field-label">이번 달</span>
        <span className="muted">
          {stat.elapsed}일 중 {stat.thisMonth}일 ({rate}%)
        </span>
      </div>
      <Bar value={stat.thisMonth} max={stat.elapsed} />

      <div className="bars">
        {stat.counts.map((m) => (
          <div key={m.label} className="bar-row">
            <span className="bar-label">
              <span className="emoji">{m.emoji}</span> {m.label}
            </span>
            <Bar value={m.count} max={stat.total} />
            <span className="bar-count">{m.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 95년식 진행 막대. 채운 부분을 통짜가 아니라 블록으로 끊어 그린다. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="presentation">
      <span className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
