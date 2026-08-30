import { fetchAuthSession } from 'aws-amplify/auth';
import { API_URL } from './amplify-config';

export type Mood = 'good' | 'soso' | 'bad';

export interface Entry {
  date: string;
  text: string;
  mood: Mood | null;
  updatedAt: string;
}

/**
 * API Gateway 의 JWT 권한 부여자는 audience 를 앱 클라이언트 ID 로 검증한다.
 * 그 조건을 만족하는 건 액세스 토큰이 아니라 ID 토큰이다.
 */
async function authHeader(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('로그인이 필요합니다.');
  return { authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    'content-type': 'application/json',
    ...(await authHeader()),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message ?? `요청이 실패했습니다 (${res.status})`);
  }
  return body as T;
}

export function listEntries(): Promise<{ entries: Entry[] }> {
  return request('/entries');
}

export function saveEntry(
  date: string,
  text: string,
  mood: Mood | null,
): Promise<{ entry: Entry }> {
  return request(`/entries/${date}`, {
    method: 'PUT',
    body: JSON.stringify({ text, mood }),
  });
}

export function deleteEntry(date: string): Promise<void> {
  return request(`/entries/${date}`, { method: 'DELETE' });
}

/** 로컬 시간대 기준 YYYY-MM-DD. toISOString() 은 UTC 라 날짜가 밀린다. */
export function todayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
