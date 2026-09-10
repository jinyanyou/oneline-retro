import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isConfigured, IS_LOCAL } from './amplify-config';
import { deleteEntry, listEntries, saveEntry, type Entry } from './api';
import { MOODS, moodOf, type Mood } from './moods';
import { formatDate, todayKey } from './date';
import { AboutDialog } from './AboutDialog';
import { Auth } from './Auth';
import { Calendar } from './Calendar';
import { ConfirmDialog } from './ConfirmDialog';
import { HelpDialog } from './HelpDialog';
import { MenuBar, type MenuEntry, type MenuSpec } from './MenuBar';
import { Minesweeper } from './Minesweeper';
import { Notice } from './Notice';
import { Stats } from './Stats';
import { Taskbar, type TaskWindow } from './Taskbar';
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

/** 창 상태. 최소화한 창은 작업 표시줄에만 남는다. */
type WinState = 'normal' | 'min' | 'max';

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
              <p className="dialog-lead">AWS 없이 쓰려면</p>
              <p>
                <code>npm run dev:local</code> 로 실행하면 이 컴퓨터의{' '}
                <code>local/data.json</code> 에 기록이 쌓입니다. 로그인도,
                계정도 필요 없습니다.
              </p>
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

function Journal({
  email,
  signOut,
}: {
  email: string;
  signOut: (() => void) | null;
}) {
  const today = useMemo(() => todayKey(), []);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState(today);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [tab, setTab] = useState<TabId>('list');
  // 삭제를 기다리는 날짜. 확인 대화 상자를 띄우는 조건이기도 하다.
  const [pending, setPending] = useState<string | null>(null);
  // 저장이 끝났음을 알리는 문구. 있으면 알림 상자가 뜬다.
  const [notice, setNotice] = useState<string | null>(null);
  // Notice 가 이 함수를 타이머에 건다. 매번 새로 만들면 다시 그려질 때마다
  // 타이머가 처음부터 시작해서 알림이 닫히지 않는다.
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // 보기 메뉴에서 끄고 켠다. 그 시절 보기 메뉴에 꼭 있던 항목이다.
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [dialog, setDialog] = useState<'help' | 'about' | null>(null);
  const [game, setGame] = useState(false);
  // 창마다 보통 / 최소화 / 최대화 셋 중 하나다.
  const [appWin, setAppWin] = useState<WinState>('normal');
  const [gameWin, setGameWin] = useState<WinState>('normal');

  // 편집 메뉴가 입력 칸을 직접 건드린다 (모두 선택, 지운 뒤 초점 되돌리기).
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSave = useCallback(async () => {
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
      setNotice(`${formatDate(entry.date)} 기록을 저장했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }, [editing, text, mood]);

  const handleDelete = useCallback(
    async (date: string) => {
      setPending(null);
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

  /** 지금 입력 칸에 올라와 있는 날짜의 저장된 기록. 없으면 아직 안 쓴 날이다. */
  const saved = entries.find((e) => e.date === editing);

  const selectAll = useCallback(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const clearInput = useCallback(() => {
    setText('');
    setMood(null);
    setSavedAt(null);
    textareaRef.current?.focus();
  }, []);

  const copyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('입력 칸의 글을 복사했습니다.');
    } catch {
      setError('복사하지 못했습니다. 직접 선택해 복사해 주세요.');
    }
  }, [text]);

  /** 이미 열려 있는데 최소화돼 있었다면 다시 올린다. */
  const openGame = useCallback(() => {
    setGame(true);
    setGameWin('normal');
  }, []);

  // 메뉴에 적어 둔 단축키를 실제로 처리한다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 게임이나 대화 상자가 떠 있으면 앱 단축키는 쉰다. 특히 Del 이
      // 뒤에서 기록을 지우려 드는 일이 없어야 한다.
      if (
        appWin === 'min' ||
        (game && gameWin !== 'min') ||
        dialog !== null ||
        pending !== null
      ) {
        return;
      }

      const el = e.target;
      const typing =
        el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;

      if (e.key === 'F1') {
        e.preventDefault();
        setDialog('help');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        void load();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      // Del 은 입력 칸 밖에 있을 때만 듣는다. 글을 쓰다 기록이 날아가면 곤란하다.
      if (e.key === 'Delete' && !typing && saved) {
        e.preventDefault();
        setPending(editing);
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    load,
    handleSave,
    selectAll,
    saved,
    editing,
    game,
    gameWin,
    appWin,
    dialog,
    pending,
  ]);

  const menus: MenuSpec[] = [
    {
      mnemonic: '파',
      rest: '일',
      items: [
        {
          label: '저장',
          accel: 'Ctrl+S',
          disabled: saving || !text.trim(),
          onSelect: () => void handleSave(),
        },
        { separator: true },
        {
          label: '로그아웃',
          // 로컬 모드에는 로그아웃할 세션이 없다. 항목은 두되 흐리게 둔다.
          disabled: !signOut,
          onSelect: () => signOut?.(),
        },
      ],
    },
    {
      mnemonic: '편',
      rest: '집',
      items: [
        {
          label: '모두 선택',
          accel: 'Ctrl+A',
          disabled: !text,
          onSelect: selectAll,
        },
        {
          label: '복사',
          accel: 'Ctrl+C',
          disabled: !text,
          onSelect: () => void copyText(),
        },
        {
          label: '입력 지우기',
          disabled: !text && !mood,
          onSelect: clearInput,
        },
        { separator: true },
        {
          // 위의 "입력 지우기" 와 다르다. 이건 서버에 저장된 것을 지운다.
          label: '이 날 기록 삭제',
          accel: 'Del',
          disabled: !saved,
          onSelect: () => setPending(editing),
        },
      ],
    },
    {
      mnemonic: '보',
      rest: '기',
      items: [
        ...TABS.map((t) => ({
          label: t.label,
          mark: 'radio' as const,
          checked: tab === t.id,
          onSelect: () => setTab(t.id),
        })),
        { separator: true },
        {
          label: '상태 표시줄',
          mark: 'check' as const,
          checked: showStatusBar,
          onSelect: () => setShowStatusBar((v) => !v),
        },
        { label: '새로 고침', accel: 'F5', onSelect: () => void load() },
      ],
    },
    {
      mnemonic: '게',
      rest: '임',
      items: [{ label: '지뢰 찾기', onSelect: openGame }],
    },
    {
      mnemonic: '도',
      rest: '움말',
      items: [
        { label: '도움말 항목', accel: 'F1', onSelect: () => setDialog('help') },
        { separator: true },
        { label: '한마디 정보', onSelect: () => setDialog('about') },
      ],
    },
  ];

  const taskWindows: TaskWindow[] = [
    {
      id: 'app',
      title: '한마디',
      minimized: appWin === 'min',
      // 올라와 있는 창을 다시 누르면 내려간다. 그 시절 그대로다.
      onToggle: () =>
        setAppWin((w) => (w === 'min' ? 'normal' : 'min')),
    },
    ...(game
      ? [
          {
            id: 'game',
            title: '지뢰 찾기',
            minimized: gameWin === 'min',
            onToggle: () =>
              setGameWin((w) => (w === 'min' ? 'normal' : 'min')),
          },
        ]
      : []),
  ];

  const startItems: MenuEntry[] = [
    { label: '지뢰 찾기', onSelect: openGame },
    { separator: true },
    { label: '도움말 항목', accel: 'F1', onSelect: () => setDialog('help') },
    { label: '한마디 정보', onSelect: () => setDialog('about') },
    { separator: true },
    { label: '로그아웃', disabled: !signOut, onSelect: () => signOut?.() },
  ];

  const isToday = editing === today;
  const remaining = MAX_TEXT - text.length;

  return (
    <div className="desktop">
      <div
        className={`window app${appWin === 'max' ? ' maximized' : ''}`}
        hidden={appWin === 'min'}
      >
        <TitleBar
          title={`한마디 - ${email || '사용자'}`}
          onClose={signOut ?? undefined}
          closeLabel="로그아웃"
          onMinimize={() => setAppWin('min')}
          onMaximize={() =>
            setAppWin((w) => (w === 'max' ? 'normal' : 'max'))
          }
          maximized={appWin === 'max'}
        />
        <MenuBar menus={menus} />

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
              ref={textareaRef}
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
                  onDelete={setPending}
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

        {showStatusBar && (
          <div className="statusbar">
            <span className="status-panel">기록 {entries.length}개</span>
            <span className="status-panel grow">
              {savedAt ? `${savedAt} 저장됨` : '준비'}
            </span>
            <span className="status-panel">{today}</span>
          </div>
        )}
      </div>

      {notice && (
        <Notice title="한마디" message={notice} onClose={dismissNotice} />
      )}

      {game && (
        <Minesweeper
          onClose={() => setGame(false)}
          onMinimize={() => setGameWin('min')}
          onMaximize={() =>
            setGameWin((w) => (w === 'max' ? 'normal' : 'max'))
          }
          maximized={gameWin === 'max'}
          minimized={gameWin === 'min'}
        />
      )}

      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}

      {dialog === 'about' && (
        <AboutDialog
          email={email}
          count={entries.length}
          onClose={() => setDialog(null)}
        />
      )}

      {pending && (
        <ConfirmDialog
          title="기록 삭제"
          message={`${formatDate(pending)} 기록을 삭제할까요? 되돌릴 수 없습니다.`}
          onConfirm={() => void handleDelete(pending)}
          onCancel={() => setPending(null)}
        />
      )}

      <Taskbar windows={taskWindows} startItems={startItems} />
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

  // 로컬 모드는 로그인을 거치지 않는다. 이 컴퓨터에 나 혼자 쓴다.
  if (IS_LOCAL) return <Journal email="로컬" signOut={null} />;

  return (
    <Auth>
      {({ email, signOut }) => <Journal email={email} signOut={signOut} />}
    </Auth>
  );
}
