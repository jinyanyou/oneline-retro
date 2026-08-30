import { useEffect, useRef } from 'react';

import { TitleBar } from './TitleBar';

/**
 * 확인 대화 상자.
 *
 * 삭제는 되돌릴 수 없는데 버튼 한 번이면 끝나던 것을 한 번 가로챈다.
 * 초점은 "아니오" 에 두고 Esc 로도 닫히게 해서, 잘못 눌러도 기록이
 * 사라지지 않게 한다.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = '예',
  cancelLabel = '아니오',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="window confirm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <TitleBar title={title} onClose={onCancel} closeLabel="닫기" />

        <div className="window-body">
          <div className="dialog">
            <div className="dialog-icon" aria-hidden="true">
              ?
            </div>
            <p>{message}</p>
          </div>

          <div className="confirm-buttons">
            <button className="btn" onClick={onConfirm}>
              {confirmLabel}
            </button>
            <button className="btn" ref={cancelRef} onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
