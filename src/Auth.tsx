import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  confirmSignUp,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';

import { TitleBar } from './TitleBar';

/**
 * 로그인 화면.
 *
 * @aws-amplify/ui-react 의 Authenticator 를 쓰면 번들이 배로 늘고,
 * 결국 CSS 로 90년대 풍을 덮어씌워야 했다. 필요한 건 가입·확인·로그인
 * 세 단계뿐이라 aws-amplify/auth 만 직접 부른다.
 */

type Mode = 'signIn' | 'signUp' | 'confirm';

/** Cognito 예외 이름을 사람이 읽을 문장으로 바꾼다. */
function messageOf(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  switch (name) {
    case 'UserNotFoundException':
    case 'NotAuthorizedException':
      return '이메일 또는 비밀번호가 맞지 않습니다.';
    case 'UsernameExistsException':
      return '이미 가입된 이메일입니다. 로그인 탭에서 들어가세요.';
    case 'InvalidPasswordException':
    case 'InvalidParameterException':
      return '비밀번호는 8자 이상이고 소문자와 숫자를 포함해야 합니다.';
    case 'CodeMismatchException':
      return '인증 코드가 맞지 않습니다.';
    case 'ExpiredCodeException':
      return '인증 코드가 만료되었습니다. 다시 받아 주세요.';
    case 'UserNotConfirmedException':
      return '이메일 인증이 끝나지 않았습니다. 코드를 입력해 주세요.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return '시도가 너무 잦습니다. 잠시 후 다시 해 주세요.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : '처리하지 못했습니다.';
  }
}

export function Auth({
  children,
}: {
  children: (props: { email: string; signOut: () => void }) => ReactNode;
}) {
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('signIn');
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** 이미 로그인된 세션이 있는지 본다. 없으면 그냥 로그인 화면이다. */
  const refresh = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setEmail(user.signInDetails?.loginId ?? user.username);
    } catch {
      setEmail(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSignIn() {
    const { isSignedIn, nextStep } = await signIn({
      username: form.email.trim(),
      password: form.password,
    });

    if (isSignedIn) {
      await refresh();
      return;
    }

    // 가입만 하고 코드를 못 넣은 계정. 코드를 다시 보내고 확인 단계로 보낸다.
    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      await resendSignUpCode({ username: form.email.trim() });
      setMode('confirm');
      setNotice('인증 코드를 다시 보냈습니다. 메일함을 확인해 주세요.');
      return;
    }

    setError(`이 계정은 추가 인증이 필요합니다 (${nextStep.signInStep}).`);
  }

  async function handleSignUp() {
    const username = form.email.trim();
    const { isSignUpComplete, nextStep } = await signUp({
      username,
      password: form.password,
      options: { userAttributes: { email: username } },
    });

    if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
      setMode('confirm');
      setNotice(`${username} 으로 인증 코드를 보냈습니다.`);
      return;
    }

    if (isSignUpComplete) await handleSignIn();
  }

  async function handleConfirm() {
    await confirmSignUp({
      username: form.email.trim(),
      confirmationCode: form.code.trim(),
    });
    // 방금 입력한 비밀번호가 아직 남아 있으니 바로 로그인한다.
    await handleSignIn();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signIn') await handleSignIn();
      else if (mode === 'signUp') await handleSignUp();
      else await handleConfirm();
    } catch (err) {
      // 다른 탭에서 이미 로그인한 경우 등
      if (err instanceof Error && err.name === 'UserAlreadyAuthenticatedException') {
        await refresh();
      } else {
        setError(messageOf(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError(null);
    try {
      await resendSignUpCode({ username: form.email.trim() });
      setNotice('인증 코드를 다시 보냈습니다.');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setEmail(null);
    setMode('signIn');
    setForm({ email: '', password: '', code: '' });
  }

  if (!checked) {
    return (
      <div className="desktop">
        <div className="window auth">
          <TitleBar title="한마디" />
          <div className="window-body">
            <p className="muted">확인 중…</p>
          </div>
        </div>
      </div>
    );
  }

  if (email) return <>{children({ email, signOut: () => void handleSignOut() })}</>;

  const submitLabel =
    mode === 'signIn' ? '로그인' : mode === 'signUp' ? '가입' : '확인';

  return (
    <div className="desktop">
      <div className="window auth">
        <TitleBar title="한마디 - 로그인" />

        <div className="window-body">
          {mode === 'confirm' ? (
            <p className="muted">
              메일로 받은 6자리 코드를 넣으면 가입이 끝납니다.
            </p>
          ) : (
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signIn'}
                className={`tab ${mode === 'signIn' ? 'selected' : ''}`}
                onClick={() => switchMode('signIn')}
              >
                로그인
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signUp'}
                className={`tab ${mode === 'signUp' ? 'selected' : ''}`}
                onClick={() => switchMode('signUp')}
              >
                회원가입
              </button>
            </div>
          )}

          <form className="tab-body" onSubmit={handleSubmit}>
            {mode === 'confirm' ? (
              <label className="form-row">
                <span>인증 코드</span>
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                />
              </label>
            ) : (
              <>
                <label className="form-row">
                  <span>이메일</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </label>

                <label className="form-row">
                  <span>비밀번호</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    autoComplete={
                      mode === 'signUp' ? 'new-password' : 'current-password'
                    }
                    required
                  />
                </label>

                {mode === 'signUp' && (
                  <p className="muted form-help">
                    8자 이상, 소문자와 숫자를 포함해야 합니다.
                  </p>
                )}
              </>
            )}

            {notice && <p className="muted form-help">{notice}</p>}

            {error && (
              <div className="dialog error" role="alert">
                <div className="dialog-icon stop" aria-hidden="true">
                  ×
                </div>
                <p>{error}</p>
              </div>
            )}

            <div className="actions">
              {mode === 'confirm' ? (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void handleResend()}
                  disabled={busy}
                >
                  코드 다시 받기
                </button>
              ) : (
                <span />
              )}

              <div className="action-buttons">
                {mode === 'confirm' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => switchMode('signIn')}
                    disabled={busy}
                  >
                    취소
                  </button>
                )}
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? '잠시만…' : submitLabel}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="statusbar">
          <span className="status-panel grow">
            {busy ? '서버와 통신 중…' : '준비'}
          </span>
        </div>
      </div>
    </div>
  );
}
