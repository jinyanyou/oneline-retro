import { useCallback, useEffect, useMemo, useState } from 'react';
import { Authenticator, translations } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';

import { isConfigured } from './amplify-config';
import {
  deleteEntry,
  listEntries,
  saveEntry,
  todayKey,
  type Entry,
  type Mood,
} from './api';
import './App.css';

I18n.putVocabularies(translations);
I18n.setLanguage('ko');

const MAX_TEXT = 280;

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'good', emoji: '😊', label: '좋았다' },
  { value: 'soso', emoji: '😐', label: '그럭저럭' },
  { value: 'bad', emoji: '😞', label: '아쉬웠다' },
];

function moodOf(mood: Mood | null) {
  return MOODS.find((m) => m.value === mood);
}

/** 2026-08-31 -> 8월 31일 (월) */
function formatDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

function SetupNotice() {
  return (
    <div className="setup">
      <h1>한 줄 회고</h1>
      <div className="stripes" aria-hidden="true" />
      <p>아직 백엔드 설정이 연결되지 않았습니다.</p>
      <ol>
        <li>
          <code>cd infra &amp;&amp; npx cdk deploy</code> 로 백엔드를 배포합니다.
        </li>
        <li>
          출력된 <code>UserPoolId</code>, <code>UserPoolClientId</code>,{' '}
          <code>ApiUrl</code> 값을 확인합니다.
        </li>
        <li>
          <code>.env.example</code> 을 <code>.env</code> 로 복사해 값을 채웁니다.
        </li>
        <li>개발 서버를 다시 시작합니다.</li>
      </ol>
    </div>
  );
}

function Journal({ email, signOut }: { email: string; signOut: () => void }) {
  const today = useMemo(() => todayKey(), []);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries } = await listEntries();
      setEntries(entries);

      // 오늘 기록이 이미 있으면 편집 상태로 채워 둔다.
      const mine = entries.find((e) => e.date === today);
      if (mine) {
        setText(mine.text);
        setMood(mine.mood);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { entry } = await saveEntry(today, trimmed, mood);
      setEntries((prev) => [entry, ...prev.filter((e) => e.date !== today)]);
      setSavedAt(new Date().toLocaleTimeString('ko-KR'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date: string) {
    setError(null);
    try {
      await deleteEntry(date);
      setEntries((prev) => prev.filter((e) => e.date !== date));
      if (date === today) {
        setText('');
        setMood(null);
        setSavedAt(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    }
  }

  const past = entries.filter((e) => e.date !== today);
  const remaining = MAX_TEXT - text.length;

  return (
    <div className="app">
      <header className="header">
        <h1>한 줄 회고</h1>
        <div className="account">
          <span className="email">{email}</span>
          <button className="link" onClick={signOut}>
            로그아웃
          </button>
        </div>
      </header>

      <div className="stripes" aria-hidden="true" />

      <section className="today">
        <div className="today-head">
          <h2>{formatDate(today)}</h2>
          {savedAt && <span className="saved">{savedAt} 저장됨</span>}
        </div>

        <div className="moods">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`mood ${mood === m.value ? 'selected' : ''}`}
              onClick={() => setMood(mood === m.value ? null : m.value)}
              aria-pressed={mood === m.value}
            >
              <span className="emoji">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          placeholder="오늘 하루를 한 줄로 남겨보세요."
          rows={3}
        />

        <div className="actions">
          <span className={`counter ${remaining < 20 ? 'low' : ''}`}>
            {remaining}자 남음
          </span>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <section className="past">
        <h2>지난 기록 {past.length > 0 && <span>({past.length})</span>}</h2>

        {loading && <p className="muted">불러오는 중…</p>}

        {!loading && past.length === 0 && (
          <p className="muted">아직 지난 기록이 없습니다. 오늘부터 시작해 보세요.</p>
        )}

        <ul className="entries">
          {past.map((entry) => {
            const m = moodOf(entry.mood);
            return (
              <li key={entry.date} className="entry">
                <div className="entry-main">
                  <div className="entry-meta">
                    {m && (
                      <span className="emoji" title={m.label}>
                        {m.emoji}
                      </span>
                    )}
                    <time>{formatDate(entry.date)}</time>
                  </div>
                  <p>{entry.text}</p>
                </div>
                <button
                  className="link danger"
                  onClick={() => handleDelete(entry.date)}
                  aria-label={`${formatDate(entry.date)} 기록 삭제`}
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default function App() {
  if (!isConfigured) return <SetupNotice />;

  return (
    <Authenticator signUpAttributes={['email']}>
      {({ signOut, user }) => (
        <Journal
          email={user?.signInDetails?.loginId ?? ''}
          signOut={() => signOut?.()}
        />
      )}
    </Authenticator>
  );
}
