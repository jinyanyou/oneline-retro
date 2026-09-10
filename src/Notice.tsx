import { useEffect } from 'react';

import { TitleBar } from './TitleBar';

/** 읽고 사라지기에 넉넉한 시간. 더 길면 화면을 가리는 쪽이 커진다. */
const DURATION = 1800;

/**
 * 스스로 닫히는 알림 상자.
 *
 * 상태 표시줄의 "저장됨" 은 눈이 아래까지 가지 않아 놓치기 쉬웠다.
 * 그래서 창 한가운데 그 시절 메시지 상자를 잠깐 띄운다.
 *
 * 확인 버튼은 없다. 대신 뒤를 막지 않으므로(.notice-layer 가
 * pointer-events 를 흘려보낸다) 알림이 떠 있는 동안에도 계속 쓸 수 있고,
 * 초점도 빼앗지 않는다. 눌러서 미리 닫을 수도 있다.
 */
export function Notice({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  // onClose 는 호출하는 쪽에서 고정해 둬야 한다. 매번 새로 만들면
  // 글자를 입력할 때마다 다시 그려지면서 타이머가 계속 미뤄진다.
  useEffect(() => {
    const timer = setTimeout(onClose, DURATION);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="notice-layer">
      <div
        className="window notice"
        role="status"
        aria-live="polite"
        onClick={onClose}
      >
        <TitleBar title={title} onClose={onClose} closeLabel="닫기" />

        <div className="window-body">
          <div className="dialog">
            <div className="dialog-icon info" aria-hidden="true">
              i
            </div>
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
