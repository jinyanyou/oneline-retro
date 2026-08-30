import { fetchAuthSession } from 'aws-amplify/auth';
import { API_URL } from './amplify-config';
import type { Mood } from './moods';

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

/** 기간은 from 과 to 를 함께 줘야 적용된다. limit 은 서버에서 365 로 잘린다. */
export function listEntries(
  params: { from?: string; to?: string; limit?: number } = {},
): Promise<{ entries: Entry[] }> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return request(`/entries${qs ? `?${qs}` : ''}`);
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
