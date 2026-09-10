import { useEffect, useState } from 'react';

/**
 * 메뉴 한 줄. 구분선이거나, 고를 수 있는 항목이거나 둘 중 하나다.
 *
 * mark 를 주면 왼쪽 칸에 표시가 붙는다. 'check' 는 켜고 끄는 것(상태
 * 표시줄), 'radio' 는 여럿 중 하나인 것(탭)에 쓴다. 그 시절 보기 메뉴가
 * 그 둘을 그렇게 구분했다.
 */
export type MenuEntry =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      /** 오른쪽에 흐리게 붙는 단축키 안내. 실제 처리는 부르는 쪽에서 한다. */
      accel?: string;
      mark?: 'check' | 'radio';
      checked?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    };

export interface MenuSpec {
  /** 밑줄이 그어지는 앞 글자와 나머지. <u>파</u>일 */
  mnemonic: string;
  rest: string;
  items: MenuEntry[];
}

/**
 * 메뉴 막대.
 *
 * 하나가 열려 있을 때 다른 제목에 마우스를 얹으면 그쪽으로 옮겨 간다.
 * 95 메뉴가 그랬고, 이게 없으면 메뉴를 옮길 때마다 두 번씩 눌러야 한다.
 */
export function MenuBar({ menus }: { menus: MenuSpec[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;

    // 바깥을 누르거나 Esc 를 누르면 닫는다. 그 시절 메뉴가 그랬다.
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menubar" role="menubar">
      {menus.map((menu, i) => (
        <div className="menu" key={menu.mnemonic + menu.rest}>
          {/* 밑줄 글자를 <u> 로 감싸면 읽는 프로그램이 "편집" 을 "집" 으로
              흘리는 경우가 있다. aria-label 로 이름을 한 번 더 적어 둔다. */}
          <button
            type="button"
            className={`menu-title ${open === i ? 'open' : ''}`}
            aria-label={menu.mnemonic + menu.rest}
            aria-expanded={open === i}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === i ? null : i);
            }}
            onMouseEnter={() => {
              if (open !== null) setOpen(i);
            }}
          >
            <u>{menu.mnemonic}</u>
            {menu.rest}
          </button>

          {open === i && (
            <div className="menu-list" role="menu">
              {menu.items.map((item, j) =>
                item.separator ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <div className="menu-sep" key={`sep-${j}`} role="separator" />
                ) : (
                  <button
                    type="button"
                    key={item.label}
                    className="menu-item"
                    role={
                      item.mark === 'radio'
                        ? 'menuitemradio'
                        : item.mark === 'check'
                          ? 'menuitemcheckbox'
                          : 'menuitem'
                    }
                    aria-checked={item.mark ? Boolean(item.checked) : undefined}
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(null);
                      item.onSelect();
                    }}
                  >
                    <span className="menu-mark" aria-hidden="true">
                      {item.checked ? (item.mark === 'radio' ? '●' : '✓') : ''}
                    </span>
                    <span>{item.label}</span>
                    <span className="menu-accel">{item.accel ?? ''}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
