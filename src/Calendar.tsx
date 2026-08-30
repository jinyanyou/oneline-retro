import { useMemo, useState } from 'react';

import type { Entry } from './api';
import { moodOf } from './moods';
import { WEEKDAYS, formatDate, monthGrid, monthLabel, parseKey } from './date';

/**
 * 월 단위 달력. 기록이 있는 날은 튀어나온 면에 기분 얼굴을 얹고,
 * 없는 날은 평면으로 둔다. 앞으로 올 날짜는 누를 수 없다.
 *
 * 날짜를 누르면 위쪽 입력 칸이 그 날짜로 바뀐다. 빈 날을 골라
 * 지난 날의 기록을 채워 넣는 것도 여기서 한다.
 */
export function Calendar({
  entries,
  today,
  selected,
  onPick,
}: {
  entries: Entry[];
  today: string;
  selected: string;
  onPick: (date: string) => void;
}) {
  // 탭을 열 때 보고 있던 날짜가 있는 달부터 보여 준다.
  const opened = parseKey(selected);
  const [year, setYear] = useState(opened.getFullYear());
  const [month, setMonth] = useState(opened.getMonth());

  const byDate = useMemo(
    () => new Map(entries.map((e) => [e.date, e])),
    [entries],
  );

  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  function moveMonth(step: number) {
    const d = new Date(year, month + step, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const start = parseKey(today);
  const thisMonth = year === start.getFullYear() && month === start.getMonth();
  const written = cells.filter((key) => key && byDate.has(key)).length;

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="btn small" onClick={() => moveMonth(-1)}>
          ◀ 이전
        </button>
        <span className="cal-title">{monthLabel(year, month)}</span>
        <button
          className="btn small"
          onClick={() => {
            setYear(start.getFullYear());
            setMonth(start.getMonth());
            onPick(today);
          }}
          disabled={thisMonth && selected === today}
        >
          오늘
        </button>
        <button className="btn small" onClick={() => moveMonth(1)}>
          다음 ▶
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`cal-weekday ${dayClass(i)}`}>
            {w}
          </span>
        ))}

        {cells.map((key, i) => {
          if (!key) {
            return <span key={`blank-${i}`} className="cal-cell blank" />;
          }

          const entry = byDate.get(key);
          const mood = moodOf(entry?.mood);
          const classes = [
            'cal-cell',
            dayClass(i % 7),
            entry ? 'has' : '',
            key === selected ? 'selected' : '',
            key === today ? 'today' : '',
          ];

          return (
            <button
              key={key}
              type="button"
              className={classes.join(' ')}
              disabled={key > today}
              aria-pressed={key === selected}
              title={entry ? entry.text : `${formatDate(key)} — 기록 없음`}
              onClick={() => onPick(key)}
            >
              <span className="cal-day">{parseKey(key).getDate()}</span>
              <span className="cal-mark" aria-hidden="true">
                {entry ? (mood ? mood.emoji : '●') : ''}
              </span>
            </button>
          );
        })}
      </div>

      <p className="cal-hint muted">
        이 달에 {written}일 기록했습니다. 날짜를 누르면 위 칸에서 그 날의 기록을
        쓰거나 고칠 수 있습니다.
      </p>
    </div>
  );
}

/** 일요일은 빨강, 토요일은 파랑. 달력의 오랜 관습이다. */
function dayClass(weekday: number) {
  if (weekday === 0) return 'sun';
  if (weekday === 6) return 'sat';
  return '';
}
