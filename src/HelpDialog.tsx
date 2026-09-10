import { useEffect, useRef } from 'react';

import { TitleBar } from './TitleBar';

/**
 * 도움말 항목.
 *
 * 이 앱에서 눈에 안 보이는 것만 적는다. 저장 버튼처럼 화면에 이미 있는
 * 건 굳이 설명하지 않는다. 달력의 빈 날을 눌러 지난 날을 채울 수 있다는
 * 건 아무도 모르고 지나쳤다.
 */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="window help"
        role="dialog"
        aria-modal="true"
        aria-label="도움말 항목"
        onClick={(e) => e.stopPropagation()}
      >
        <TitleBar title="도움말 항목" onClose={onClose} closeLabel="닫기" />

        <div className="window-body">
          <div className="help-body">
            <h3>하루에 한 줄</h3>
            <p>
              280자까지 쓸 수 있습니다. 길게 쓰려면 미루게 되고, 미루면 아예
              안 쓰게 되어서 일부러 막아 두었습니다. 기분은 고르지 않아도
              저장됩니다.
            </p>

            <h3>지난 날 채워 넣기</h3>
            <p>
              <b>달력</b> 탭에서 비어 있는 날을 누르면 그날 기록을 지금
              쓸 수 있습니다. 어제 못 썼다고 그냥 넘어가지 않아도 됩니다.
            </p>

            <h3>고치기와 지우기</h3>
            <p>
              <b>목록</b> 탭의 <b>수정</b>을 누르면 그 날짜가 위쪽 입력 칸으로
              올라옵니다. 다시 저장하면 덮어씁니다. 삭제는 되돌릴 수 없어서
              한 번 물어봅니다.
            </p>

            <h3>단축키</h3>
            <table className="keys">
              <tbody>
                <tr>
                  <th>Ctrl+S</th>
                  <td>저장</td>
                </tr>
                <tr>
                  <th>Ctrl+A</th>
                  <td>입력 칸 전체 선택</td>
                </tr>
                <tr>
                  <th>Del</th>
                  <td>지금 올라와 있는 날의 기록 삭제</td>
                </tr>
                <tr>
                  <th>F5</th>
                  <td>새로 고침</td>
                </tr>
                <tr>
                  <th>F1</th>
                  <td>이 도움말</td>
                </tr>
              </tbody>
            </table>
            <p className="muted">
              Del 은 입력 칸 밖에 있을 때만 듣습니다. 글을 쓰다가 지워지면
              곤란하니까요.
            </p>
          </div>

          <div className="confirm-buttons">
            <button className="btn" ref={okRef} onClick={onClose}>
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
