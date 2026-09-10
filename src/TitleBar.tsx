/**
 * 제목 표시줄.
 *
 * 최소화·최대화 단추는 처리할 함수를 넘길 때만 그린다. 그 시절 대화 상자에는
 * 그 둘이 아예 없었고 X 만 있었다. 넘기지 않으면 저절로 그 모양이 된다.
 */
export function TitleBar({
  title,
  onClose,
  closeLabel,
  onMinimize,
  onMaximize,
  maximized = false,
}: {
  title: string;
  onClose?: () => void;
  closeLabel?: string;
  onMinimize?: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
}) {
  return (
    <div className="titlebar">
      <span className="titlebar-text">{title}</span>
      <div className="titlebar-buttons">
        {onMinimize ? (
          <button
            className="tb-btn"
            onClick={onMinimize}
            title="최소화"
            aria-label="최소화"
          >
            <i className="glyph-min" />
          </button>
        ) : null}

        {onMaximize ? (
          <button
            className="tb-btn"
            onClick={onMaximize}
            title={maximized ? '이전 크기로' : '최대화'}
            aria-label={maximized ? '이전 크기로' : '최대화'}
          >
            <i className={maximized ? 'glyph-restore' : 'glyph-max'} />
          </button>
        ) : null}

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
