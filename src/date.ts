/** 날짜 키(YYYY-MM-DD) 다루기. 전부 로컬 시간대 기준이다. */

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 로컬 시간대 기준 YYYY-MM-DD. toISOString() 은 UTC 라 날짜가 밀린다. */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 키를 로컬 자정 Date 로. new Date('2026-08-31') 은 UTC 로 읽혀서 못 쓴다. */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** n 일 뒤(음수면 앞)의 키. 월말·윤년은 Date 가 알아서 넘겨 준다. */
export function shiftDay(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

/** 2026-08-31 -> 8월 31일 (월) */
export function formatDate(key: string): string {
  const d = parseKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/** 2026-08 -> 1996년 8월 시절 감성의 제목 */
export function monthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

/**
 * 달력 격자에 넣을 날짜 키. 1일 앞과 말일 뒤는 null 로 채워
 * 항상 7 의 배수 길이가 되게 한다.
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}
