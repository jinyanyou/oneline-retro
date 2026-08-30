/** 제목 표시줄. X 버튼에만 동작이 걸려 있고 나머지는 장식이다. */
export function TitleBar({
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
