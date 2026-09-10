import { useEffect, useState } from 'react';

import { MenuList, type MenuEntry } from './MenuBar';

export interface TaskWindow {
  id: string;
  title: string;
  minimized: boolean;
  /** 누르면 올라온다. 이미 올라와 있으면 내려간다 — 그 시절 그대로다. */
  onToggle: () => void;
}

/** 시계는 분까지만 보여 준다. 초까지 흐르면 눈이 그리로 간다. */
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="tray-clock">
      {now.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
    </span>
  );
}

/**
 * 작업 표시줄.
 *
 * 최소화한 창이 여기로 내려온다. 갈 곳이 없으면 최소화는 창을 잃어버리는
 * 단추일 뿐이다.
 *
 * 시작 단추도 실제로 열린다. 눌러도 아무 일이 없는 단추를 하나 더 만들 바에는
 * 없는 편이 낫다.
 */
export function Taskbar({
  windows,
  startItems,
}: {
  windows: TaskWindow[];
  startItems: MenuEntry[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="taskbar">
      <div className="menu">
        <button
          type="button"
          className={`btn start ${open ? 'on' : ''}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <span className="start-flag" aria-hidden="true" />
          시작
        </button>

        {open && (
          <MenuList
            items={startItems}
            className="up start-menu"
            onDone={() => setOpen(false)}
          />
        )}
      </div>

      <div className="task-buttons">
        {windows.map((w) => (
          <button
            type="button"
            key={w.id}
            className={`btn task-btn ${w.minimized ? '' : 'on'}`}
            onClick={w.onToggle}
            aria-pressed={!w.minimized}
          >
            {w.title}
          </button>
        ))}
      </div>

      <div className="tray">
        <Clock />
      </div>
    </div>
  );
}
