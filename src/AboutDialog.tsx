import { useEffect, useRef } from 'react';

import { IS_LOCAL } from './amplify-config';
import { TitleBar } from './TitleBar';

/**
 * 한마디 정보.
 *
 * 고전 정보 상자에 지금 상태를 얹었다. 클라우드에 붙어 있는지 로컬에서
 * 도는지, 기록이 몇 개인지를 여기서 확인할 수 있으면 상자가 장식으로만
 * 남지 않는다.
 */
export function AboutDialog({
  email,
  count,
  onClose,
}: {
  email: string;
  count: number;
  onClose: () => void;
}) {
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
        className="window about"
        role="dialog"
        aria-modal="true"
        aria-label="한마디 정보"
        onClick={(e) => e.stopPropagation()}
      >
        <TitleBar title="한마디 정보" onClose={onClose} closeLabel="닫기" />

        <div className="window-body">
          <div className="about-head">
            <div className="about-icon" aria-hidden="true">
              <span className="about-lines" />
            </div>
            <div>
              <p className="about-name">한마디</p>
              <p className="muted">하루를 한마디로 기록하는 회고 노트</p>
            </div>
          </div>

          <div className="about-facts">
            <dl>
              <dt>사용자</dt>
              <dd>{email || '알 수 없음'}</dd>
              <dt>기록</dt>
              <dd>{count}개</dd>
              <dt>연결</dt>
              <dd>
                {IS_LOCAL
                  ? '로컬 (이 컴퓨터의 파일에 저장)'
                  : '클라우드 (Cognito + DynamoDB)'}
              </dd>
            </dl>
          </div>

          <p className="about-foot">
            테두리는 전부 box-shadow 를 4겹으로 겹쳐 그렸습니다.
            이미지는 한 장도 쓰지 않았습니다.
          </p>

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
