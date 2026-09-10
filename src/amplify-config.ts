import { Amplify } from 'aws-amplify';

/**
 * 로컬 모드.
 *
 * AWS 없이 이 컴퓨터에서만 돌리는 상태다. Cognito 를 거치지 않고
 * local/server.js 에 바로 붙는다. `npm run dev:local` 이 이 값을 넣어 준다.
 */
export const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === '1';

/**
 * CDK 스택 배포 후 출력된 값을 .env 에 채워 넣는다.
 * (.env.example 참고) 로컬 모드에서는 쓰지 않는다.
 */
const userPoolId = import.meta.env.VITE_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_USER_POOL_CLIENT_ID;

export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

/** 설정이 비어 있으면 화면에 안내를 띄우기 위해 미리 확인한다. */
export const isConfigured = IS_LOCAL
  ? Boolean(API_URL)
  : Boolean(userPoolId && userPoolClientId && API_URL);

if (!IS_LOCAL && isConfigured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
}
