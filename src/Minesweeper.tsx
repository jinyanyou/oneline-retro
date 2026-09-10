import { useCallback, useEffect, useState } from 'react';

import { MenuBar, type MenuSpec } from './MenuBar';
import { TitleBar } from './TitleBar';

/** 1995년 지뢰 찾기의 세 난이도 그대로. */
const LEVELS = {
  beginner: { label: '초급', cols: 9, rows: 9, mines: 10 },
  intermediate: { label: '중급', cols: 16, rows: 16, mines: 40 },
  expert: { label: '고급', cols: 30, rows: 16, mines: 99 },
} as const;

type LevelId = keyof typeof LEVELS;
type CellState = 'hidden' | 'flagged' | 'revealed';
type Status = 'ready' | 'playing' | 'won' | 'lost';

interface Cell {
  mine: boolean;
  /** 이웃 여덟 칸의 지뢰 수. 지뢰를 놓기 전에는 0 이다. */
  near: number;
  state: CellState;
}

/** 숫자판은 세 자리에서 멈춘다. 그 시절 표시기가 그랬다. */
const LED_MAX = 999;

function emptyBoard(level: LevelId): Cell[] {
  const { cols, rows } = LEVELS[level];
  return Array.from({ length: cols * rows }, () => ({
    mine: false,
    near: 0,
    state: 'hidden' as CellState,
  }));
}

function neighbors(level: LevelId, i: number): number[] {
  const { cols, rows } = LEVELS[level];
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

/**
 * 첫 칸을 누른 다음에 지뢰를 놓는다. 그래야 첫 수에 죽는 일이 없다.
 * 원본도 그랬다 — 다만 첫 칸만 비켜 갈 뿐, 그 이웃은 지뢰일 수 있다.
 */
function placeMines(level: LevelId, board: Cell[], safe: number): Cell[] {
  const { mines } = LEVELS[level];
  const next = board.map((cell) => ({ ...cell }));

  const spots: number[] = [];
  for (let i = 0; i < next.length; i += 1) if (i !== safe) spots.push(i);

  // 피셔-예이츠로 앞에서 mines 개만 뽑는다.
  for (let i = 0; i < mines; i += 1) {
    const j = i + Math.floor(Math.random() * (spots.length - i));
    [spots[i], spots[j]] = [spots[j], spots[i]];
    next[spots[i]].mine = true;
  }

  for (let i = 0; i < next.length; i += 1) {
    next[i].near = neighbors(level, i).filter((n) => next[n].mine).length;
  }
  return next;
}

/** 빈 칸을 열면 이웃도 따라 열린다. 숫자가 나오면 거기서 멈춘다. */
function floodReveal(level: LevelId, board: Cell[], from: number): Cell[] {
  const next = board.map((cell) => ({ ...cell }));
  const stack = [from];

  while (stack.length > 0) {
    const i = stack.pop() as number;
    const cell = next[i];
    if (cell.state === 'revealed' || cell.state === 'flagged') continue;

    cell.state = 'revealed';
    if (cell.near === 0 && !cell.mine) stack.push(...neighbors(level, i));
  }
  return next;
}

function countFlags(board: Cell[]): number {
  return board.filter((c) => c.state === 'flagged').length;
}

/** 지뢰가 아닌 칸을 다 열었으면 이긴 것이다. */
function isCleared(level: LevelId, board: Cell[]): boolean {
  const left = board.filter((c) => c.state !== 'revealed').length;
  return left === LEVELS[level].mines;
}

/** 세 자리 숫자판. 음수는 앞에 빼기를 붙여 두 자리로 줄인다. */
function Led({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-99, Math.min(LED_MAX, value));
  const text =
    clamped < 0
      ? `-${String(Math.abs(clamped)).padStart(2, '0')}`
      : String(clamped).padStart(3, '0');

  return (
    <span className="led" role="status" aria-label={`${label} ${value}`}>
      {text}
    </span>
  );
}

/**
 * 지뢰 찾기.
 *
 * 한마디와는 아무 상관이 없다. 청록색 데스크톱 위에 창이 뜨는 앱을
 * 만들어 놓고 이게 없는 게 더 이상했다.
 *
 * 왼쪽 단추로 열고, 오른쪽 단추로 깃발을 꽂는다. 열린 숫자를 두 번 누르면
 * 그 둘레의 깃발 수가 숫자와 같을 때 나머지를 한꺼번에 연다.
 */
export function Minesweeper({
  onClose,
  onMinimize,
  onMaximize,
  maximized,
  minimized,
}: {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  maximized: boolean;
  /** 최소화는 감추기만 한다. 이 컴포넌트를 걷어내면 판이 처음으로 돌아간다. */
  minimized: boolean;
}) {
  const [level, setLevel] = useState<LevelId>('beginner');
  const [board, setBoard] = useState<Cell[]>(() => emptyBoard('beginner'));
  const [status, setStatus] = useState<Status>('ready');
  const [time, setTime] = useState(0);
  /** 누르고 있는 동안 얼굴이 놀란다. */
  const [pressing, setPressing] = useState(false);
  /** 밟은 지뢰. 나머지 지뢰와 달리 붉게 칠한다. */
  const [boom, setBoom] = useState<number | null>(null);

  const reset = useCallback((next: LevelId) => {
    setLevel(next);
    setBoard(emptyBoard(next));
    setStatus('ready');
    setTime(0);
    setBoom(null);
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => setTime((t) => Math.min(t + 1, LED_MAX)), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    // 내려가 있는 동안에는 키를 받지 않는다. 보이지도 않는 창이 Esc 를
    // 가로채면 안 된다.
    if (minimized) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'F2') {
        e.preventDefault();
        reset(level);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, reset, level, minimized]);

  const finish = useCallback((next: Cell[], hit: number | null) => {
    if (hit !== null) {
      setBoom(hit);
      setStatus('lost');
      setBoard(next.map((c) => ({ ...c })));
      return;
    }
    // 이겼으면 남은 지뢰에 깃발을 꽂아 준다. 원본이 그렇게 마무리했다.
    setStatus('won');
    setBoard(
      next.map((c) =>
        c.mine && c.state !== 'revealed' ? { ...c, state: 'flagged' } : c,
      ),
    );
  }, []);

  function open(i: number) {
    if (status === 'won' || status === 'lost') return;
    if (board[i].state !== 'hidden') return;

    // 첫 수를 놓고 나서야 지뢰를 뿌린다.
    let base = board;
    if (status === 'ready') {
      base = placeMines(level, board, i);
      setStatus('playing');
    }

    if (base[i].mine) {
      finish(base, i);
      return;
    }

    const next = floodReveal(level, base, i);
    if (isCleared(level, next)) finish(next, null);
    else setBoard(next);
  }

  function flag(i: number) {
    if (status === 'won' || status === 'lost') return;
    if (board[i].state === 'revealed') return;

    setBoard(
      board.map((c, j) =>
        j === i
          ? { ...c, state: c.state === 'flagged' ? 'hidden' : 'flagged' }
          : c,
      ),
    );
  }

  /** 열린 숫자 둘레의 깃발이 숫자와 맞으면 나머지를 한꺼번에 연다. */
  function chord(i: number) {
    if (status !== 'playing') return;
    const cell = board[i];
    if (cell.state !== 'revealed' || cell.near === 0) return;

    const around = neighbors(level, i);
    const flags = around.filter((n) => board[n].state === 'flagged').length;
    if (flags !== cell.near) return;

    const targets = around.filter((n) => board[n].state === 'hidden');
    const hit = targets.find((n) => board[n].mine);
    if (hit !== undefined) {
      finish(board, hit);
      return;
    }

    let next = board;
    for (const n of targets) next = floodReveal(level, next, n);
    if (isCleared(level, next)) finish(next, null);
    else setBoard(next);
  }

  const menus: MenuSpec[] = [
    {
      mnemonic: '게',
      rest: '임',
      items: [
        { label: '새 게임', accel: 'F2', onSelect: () => reset(level) },
        { separator: true },
        ...(Object.keys(LEVELS) as LevelId[]).map((id) => ({
          label: LEVELS[id].label,
          mark: 'radio' as const,
          checked: level === id,
          onSelect: () => reset(id),
        })),
        { separator: true },
        { label: '끝내기', onSelect: onClose },
      ],
    },
  ];

  // 기분 칸에서 이미 그림 문자를 쓰고 있으니 얼굴도 그쪽에 맞춘다.
  // 글자로 그린 얼굴은 18px 단추 안에서 너무 흐렸다.
  const face =
    status === 'lost'
      ? '😵'
      : status === 'won'
        ? '😎'
        : pressing
          ? '😮'
          : '🙂';

  const { cols } = LEVELS[level];
  const done = status === 'won' || status === 'lost';

  return (
    <div className="modal-backdrop game" hidden={minimized}>
      <div
        className={`window mine${maximized ? ' maximized' : ''}`}
        role="dialog"
        aria-label="지뢰 찾기"
        onContextMenu={(e) => e.preventDefault()}
      >
        <TitleBar
          title="지뢰 찾기"
          onClose={onClose}
          closeLabel="닫기"
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          maximized={maximized}
        />
        <MenuBar menus={menus} />

        <div className="mine-body">
          <div className="mine-head">
            <Led
              value={LEVELS[level].mines - countFlags(board)}
              label="남은 지뢰"
            />
            <button
              type="button"
              className="btn face"
              onClick={() => reset(level)}
              aria-label="새 게임"
            >
              {face}
            </button>
            <Led value={time} label="경과 시간" />
          </div>

          <div className="mine-scroll">
            <div
              className="mine-grid"
              style={{ gridTemplateColumns: `repeat(${cols}, 18px)` }}
              onMouseDown={() => setPressing(true)}
              onMouseUp={() => setPressing(false)}
              onMouseLeave={() => setPressing(false)}
            >
              {board.map((cell, i) => {
                // 진 뒤에는 숨어 있던 지뢰를 모두 드러낸다.
                const showMine = done && cell.mine && cell.state !== 'flagged';
                // 엉뚱한 곳에 꽂은 깃발도 그때 드러난다.
                const wrongFlag =
                  status === 'lost' && cell.state === 'flagged' && !cell.mine;
                const revealed = cell.state === 'revealed' || showMine;

                let content = '';
                let kind = '';
                if (wrongFlag) {
                  content = '✕';
                } else if (cell.state === 'flagged') {
                  content = '⚑';
                  kind = ' flag';
                } else if (revealed && cell.mine) {
                  content = '●';
                } else if (revealed && cell.near > 0) {
                  content = String(cell.near);
                }

                return (
                  <button
                    type="button"
                    key={i}
                    className={`mine-cell${revealed ? ' open' : ''}${kind}${
                      i === boom ? ' boom' : ''
                    }${wrongFlag ? ' wrong' : ''}`}
                    data-near={
                      revealed && !cell.mine ? String(cell.near) : undefined
                    }
                    aria-label={`${Math.floor(i / cols) + 1}행 ${(i % cols) + 1}열`}
                    onClick={() => open(i)}
                    onDoubleClick={() => chord(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      flag(i);
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="statusbar">
          <span className="status-panel grow">
            {status === 'lost'
              ? '지뢰를 밟았습니다'
              : status === 'won'
                ? `${LEVELS[level].label} ${time}초`
                : '오른쪽 단추로 깃발'}
          </span>
        </div>
      </div>
    </div>
  );
}
