import { useCallback, useEffect, useMemo, useState } from 'react';

import { isConfigured } from './amplify-config';
import { deleteEntry, listEntries, saveEntry, type Entry } from './api';
import { MOODS, moodOf, type Mood } from './moods';
import { formatDate, todayKey } from './date';
import { Auth } from './Auth';
import { Calendar } from './Calendar';
import { Stats } from './Stats';
import { TitleBar } from './TitleBar';
import './App.css';

const MAX_TEXT = 280;

/** 서버가 허용하는 최대치. 1 년 치면 달력과 통계에 충분하다. */
const FETCH_LIMIT = 365;

const TABS = [
  { id: 'list', label: '목록' },
  { id: 'calendar', label: '달력' },
  { id: 'stats', label: '통계' },
] as const;

type TabId = (typeof TABS)[number]['id'];

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
        <TitleBar title="한마디 - 설정 필요" />
        <div className="window-body">
          <div className="dialog">
            <div className="dialog-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="dialog-lead">백엔드 설정이 연결되지 않았습니다.</p>
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
  const [editing, setEditing] = useState(today);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [tab, setTab] = useState<TabId>('list');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries } = await listEntries({ limit: FETCH_LIMIT });
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

  /** 달력이나 목록에서 고른 날짜를 입력 칸으로 가져온다. */
  const pickDate = useCallback(
    (date: string) => {
      const found = entries.find((e) => e.date === date);
      setEditing(date);
      setText(found?.text ?? '');
      setMood(found?.mood ?? null);
      setError(null);
      setSavedAt(null);
    },
    [entries],
  );

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { entry } = await saveEntry(editing, trimmed, mood);
      // 날짜가 키라, 같은 날 기록은 갈아 끼운다. 목록은 최신 날짜가 먼저다.
      setEntries((prev) =>
        [entry, ...prev.filter((e) => e.date !== editing)].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
      setSavedAt(new Date().toLocaleTimeString('ko-KR'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(
    async (date: string) => {
      setError(null);
      try {
        await deleteEntry(date);
        setEntries((prev) => prev.filter((e) => e.date !== date));
        if (date === editing) {
          setText('');
          setMood(null);
          setSavedAt(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
      }
    },
    [editing],
  );

  const isToday = editing === today;
  const remaining = MAX_TEXT - text.length;

  return (
    <div className="desktop">
      <div className="window app">
        <TitleBar
          title={`한마디 - ${email || '사용자'}`}
          onClose={signOut}
          closeLabel="로그아웃"
        />
        <MenuBar />

        <div className="window-body">
          <fieldset className="group">
            <legend>
              {formatDate(editing)}
              {isToday ? '' : ' — 지난 날 기록'}
            </legend>

            <div className="field-row">
              <span className="field-label">
                {isToday ? '오늘 기분' : '그날 기분'}
              </span>
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
              placeholder={
                isToday
                  ? '오늘 하루를 한마디로 남겨보세요.'
                  : '그날 하루를 한마디로 남겨보세요.'
              }
              rows={3}
            />

            <div className="actions">
              <span className={`counter ${remaining < 20 ? 'low' : ''}`}>
                {remaining}자 남음
              </span>
              <div className="action-buttons">
                {!isToday && (
                  <button className="btn" onClick={() => pickDate(today)}>
                    오늘로
                  </button>
                )}
                <button className="btn" onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
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

          {/* 속성 시트 탭. 지난 기록을 목록 / 달력 / 통계로 나눠 본다. */}
          <div className="tabbed">
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`tab ${tab === t.id ? 'selected' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="tab-body" role="tabpanel">
              {loading && <p className="muted">불러오는 중…</p>}

              {!loading && tab === 'list' && (
                <EntryList
                  entries={entries}
                  editing={editing}
                  onPick={pickDate}
                  onDelete={handleDelete}
                />
              )}

              {!loading && tab === 'calendar' && (
                <Calendar
                  entries={entries}
                  today={today}
                  selected={editing}
                  onPick={pickDate}
                />
              )}

              {!loading && tab === 'stats' && (
                <Stats entries={entries} today={today} />
              )}
            </div>
          </div>
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

function EntryList({
  entries,
  editing,
  onPick,
  onDelete,
}: {
  entries: Entry[];
  editing: string;
  onPick: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="muted">아직 기록이 없습니다. 오늘부터 시작해 보세요.</p>;
  }

  return (
    <ul className="entries">
      {entries.map((entry) => {
        const m = moodOf(entry.mood);
        return (
          <li
            key={entry.date}
            className={`entry ${entry.date === editing ? 'current' : ''}`}
          >
            <div className="entry-main">
              <div className="entry-meta">
                <span className="emoji" title={m?.label}>
                  {m ? m.emoji : '·'}
                </span>
                <time>{formatDate(entry.date)}</time>
              </div>
              <p>{entry.text}</p>
            </div>
            <div className="entry-buttons">
              <button
                className="btn small"
                onClick={() => onPick(entry.date)}
                aria-label={`${formatDate(entry.date)} 기록 수정`}
              >
                수정
              </button>
              <button
                className="btn small"
                onClick={() => onDelete(entry.date)}
                aria-label={`${formatDate(entry.date)} 기록 삭제`}
              >
                삭제
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  if (!isConfigured) return <SetupNotice />;

  return (
    <Auth>
      {({ email, signOut }) => <Journal email={email} signOut={signOut} />}
    </Auth>
  );
}
