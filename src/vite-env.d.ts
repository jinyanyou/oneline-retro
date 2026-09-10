/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION: string;
  readonly VITE_USER_POOL_ID: string;
  readonly VITE_USER_POOL_CLIENT_ID: string;
  readonly VITE_API_URL: string;
  /** '1' 이면 로컬 모드. npm run dev:local 이 넣어 준다. */
  readonly VITE_LOCAL_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
