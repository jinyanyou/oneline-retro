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

/** 2026-08-31 -> 1996-08-31 시절 감성의 8월 31일 (월) */
function formatDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

/** 제목 표시줄. X 버튼에만 동작이 걸려 있고 나머지는 장식이다. */
function TitleBar({
  title,
  onClose,
  closeLabel,
}: {
  title: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="titlebar">
      <span className="titlebar-text">{title}</span>
      <div className="titlebar-buttons">
        <span className="tb-btn" aria-hidden="true">
          <i className="glyph-min" />
        </span>
        <span className="tb-btn" aria-hidden="true">
          <i className="glyph-max" />
        </span>
        {onClose ? (
          <button className="tb-btn" onClick={onClose} title={closeLabel}>
            <i className="glyph-close" />
            <span className="sr-only">{closeLabel}</span>
          </button>
        ) : (
          <span className="tb-btn" aria-hidden="true">
            <i className="glyph-close" />
          </span>
        )}
      </div>
    </div>
  );
}

function MenuBar() {
  return (
    <div className="menubar" aria-hidden="true">
      <span>
        <u>파</u>일
      </span>
      <span>
        <u>편</u>집
      </span>
      <span>
        <u>보</u>기
      </span>
      <span>
        <u>도</u>움말
      </span>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="desktop">
      <div className="window setup">
        <TitleBar title="한 줄 회고 - 설정 필요" />
        <div className="window-body">
          <div className="dialog">
            <div className="dialog-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="dialog-lead">
                백엔드 설정이 연결되지 않았습니다.
              </p>
              <ol className="steps">
                <li>
                  <code>cd infra &amp;&amp; npx cdk deploy</code> 로 백엔드를
                  배포합니다.
                </li>
                <li>
                  출력된 <code>UserPoolId</code>, <code>UserPoolClientId</code>,{' '}
                  <code>ApiUrl</code> 값을 확인합니다.
                </li>
                <li>
                  <code>.env.example</code> 을 <code>.env</code> 로 복사해 값을
                  채웁니다.
                </li>
                <li>개발 서버를 다시 시작합니다.</li>
              </ol>
            </div>
          </div>
        </div>
        <div className="statusbar">
          <span className="status-panel">준비되지 않음</span>
          <span className="status-panel grow" />
        </div>
      </div>
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
    <div className="desktop">
      <div className="window app">
        <TitleBar
          title={`한 줄 회고 - ${email || '사용자'}`}
          onClose={signOut}
          closeLabel="로그아웃"
        />
        <MenuBar />

        <div className="window-body">
          <fieldset className="group">
            <legend>{formatDate(today)}</legend>

            <div className="field-row">
              <span className="field-label">오늘 기분</span>
              <div className="moods">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`btn mood ${mood === m.value ? 'selected' : ''}`}
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                    aria-pressed={mood === m.value}
                  >
                    <span className="emoji">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
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
              <button className="btn" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>

            {error && (
              <div className="dialog error" role="alert">
                <div className="dialog-icon stop" aria-hidden="true">
                  ×
                </div>
                <p>{error}</p>
              </div>
            )}
          </fieldset>

          <fieldset className="group">
            <legend>지난 기록</legend>

            {loading && <p className="muted">불러오는 중…</p>}

            {!loading && past.length === 0 && (
              <p className="muted">
                아직 지난 기록이 없습니다. 오늘부터 시작해 보세요.
              </p>
            )}

            {past.length > 0 && (
              <ul className="entries">
                {past.map((entry) => {
                  const m = moodOf(entry.mood);
                  return (
                    <li key={entry.date} className="entry">
                      <div className="entry-main">
                        <div className="entry-meta">
                          <span className="emoji" title={m?.label}>
                            {m ? m.emoji : '·'}
                          </span>
                          <time>{formatDate(entry.date)}</time>
                        </div>
                        <p>{entry.text}</p>
                      </div>
                      <button
                        className="btn small"
                        onClick={() => handleDelete(entry.date)}
                        aria-label={`${formatDate(entry.date)} 기록 삭제`}
                      >
                        삭제
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
        </div>

        <div className="statusbar">
          <span className="status-panel">기록 {entries.length}개</span>
          <span className="status-panel grow">
            {savedAt ? `${savedAt} 저장됨` : '준비'}
          </span>
          <span className="status-panel">{today}</span>
        </div>
      </div>
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
