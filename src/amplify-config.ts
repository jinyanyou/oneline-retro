import { Amplify } from 'aws-amplify';

/**
 * CDK 스택 배포 후 출력된 값을 .env 에 채워 넣는다.
 * (.env.example 참고)
 */
const userPoolId = import.meta.env.VITE_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_USER_POOL_CLIENT_ID;

export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

/** 설정이 비어 있으면 화면에 안내를 띄우기 위해 미리 확인한다. */
export const isConfigured = Boolean(userPoolId && userPoolClientId && API_URL);

if (isConfigured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
}
