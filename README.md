# 한마디

하루를 한마디로 기록하고 지난 기록을 돌아보는 서비스.

지난 기록은 세 가지로 본다.

- **목록** — 최신 날짜부터. 각 줄에서 바로 수정·삭제
- **달력** — 기록한 날은 튀어나온 칸에 기분 얼굴이 찍힌다. 빈 날을 눌러
  지난 날의 기록을 채워 넣을 수도 있다
- **통계** — 연속 기록 일수, 최장 연속, 이번 달 기록률, 기분 분포

## 구성

| 계층 | 서비스 |
| --- | --- |
| 프론트엔드 | React + TypeScript + Vite → Amplify Hosting |
| 로그인 | Amazon Cognito User Pool |
| API | API Gateway (HTTP API) + JWT 권한 부여자 |
| 로직 | AWS Lambda (Node.js 24) |
| 데이터 | DynamoDB |

AWS 계정: `514090179227` / 리전: `ap-northeast-2` (서울)

> 같은 계정에 있는 `Aibc*` 스택은 이 프로젝트와 무관하다. 건드리지 말 것.

## 디렉터리

```
.
├── src/                  프론트엔드
│   ├── App.tsx           창 전체 + 입력 칸 + 탭
│   ├── Auth.tsx          로그인 / 회원가입 / 코드 확인
│   ├── TitleBar.tsx      창 제목 표시줄
│   ├── Calendar.tsx      달력 탭
│   ├── Stats.tsx         통계 탭
│   ├── date.ts           날짜 키 다루기
│   ├── moods.ts          기분 목록
│   ├── api.ts            API 호출 + 토큰 첨부
│   └── amplify-config.ts Cognito 설정
├── infra/                백엔드 (AWS CDK)
│   ├── bin/app.ts        CDK 진입점
│   ├── lib/retro-stack.ts 리소스 정의
│   └── lambda/entries.js  API 핸들러
└── amplify.yml           Amplify Hosting 빌드 설정
```

## API

모든 요청에 Cognito **ID 토큰**이 필요하다 (`Authorization: Bearer <token>`).

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/entries` | 내 기록 목록 (최신순, `from`/`to`/`limit` 옵션) |
| GET | `/entries/{date}` | 특정 날짜 기록 |
| PUT | `/entries/{date}` | 기록 생성/수정 `{ text, mood }` |
| DELETE | `/entries/{date}` | 기록 삭제 |

`date` 는 `YYYY-MM-DD`, `mood` 는 `good` / `soso` / `bad` 또는 생략.

DynamoDB 키는 `userId`(Cognito sub) + `date` 라, 남의 기록은 조회 자체가 불가능하다.

## 1. 백엔드 배포

### 로컬에 AWS 자격 증명이 있는 경우

```bash
cd infra
npm install
npx cdk deploy
```

### 자격 증명이 없는 경우 (권장)

이 계정은 IAM 조회가 제한되어 액세스 키 발급이 안 될 수 있다.
그럴 땐 AWS 콘솔 좌측 하단 **CloudShell** 을 쓴다. 자격 증명이 자동으로 들어가 있다.

```bash
git clone <이 저장소 주소>
cd <저장소>/infra
npm install
npx cdk deploy
```

`CDKToolkit` 부트스트랩은 이미 되어 있으므로 `cdk bootstrap` 은 필요 없다.

배포가 끝나면 Outputs 에 아래 값이 나온다.

```
RetroStack.ApiUrl            = https://xxxx.execute-api.ap-northeast-2.amazonaws.com
RetroStack.UserPoolId        = ap-northeast-2_xxxxxxxxx
RetroStack.UserPoolClientId  = xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 2. 프론트엔드 로컬 실행

```bash
cp .env.example .env   # 위 Outputs 값을 채운다
npm install
npm run dev
```

`.env` 가 비어 있으면 설정 안내 화면이 뜬다.

## 3. 프론트엔드 배포 (Amplify Hosting)

배포 주소의 앞부분은 **브랜치 이름**이 된다. 그래서 `main` 을 그대로 쓰는 대신
배포 전용 브랜치 `oneline-retro` 를 두고 거기로 밀어 넣는다.

```bash
git push origin main:oneline-retro
```

`main` 은 작업용으로 남고, 배포하고 싶을 때만 위 한 줄을 실행하면 된다.
브랜치를 오갈 필요가 없다.

1. AWS 콘솔 → **Amplify** → 새 앱 생성 → GitHub 연결
2. 저장소를 고르고 브랜치는 **`oneline-retro`** 를 선택
3. `amplify.yml` 이 자동 인식된다
4. **환경 변수**에 `.env` 와 같은 4개 값을 등록 (이 단계를 빠뜨리면 설정 안내 화면만 나온다)
5. 배포 후 `https://oneline-retro.xxxxx.amplifyapp.com` 접속

`xxxxx` 는 Amplify 가 만드는 앱 ID 라 고를 수 없다. 이름을 온전히 정하려면
사용자 지정 도메인을 연결해야 한다.

클라이언트 라우터를 쓰지 않으므로 SPA 리라이트 규칙은 따로 넣지 않아도 된다.

### 배포 후 조여야 할 것

CORS 로 허용하는 출처는 배포할 때 정한다. 아무것도 넘기지 않으면
로컬 개발 서버(`http://localhost:5173`)만 허용한다.

Amplify 도메인이 정해지면 그 주소를 넣어 다시 배포한다. 쉼표로 여러 개를 준다.

```bash
cd infra
npx cdk deploy -c origins=https://main.xxxxx.amplifyapp.com,http://localhost:5173
```

넘긴 목록이 기존 설정을 통째로 대체하므로, 로컬 개발을 계속할 거면
`http://localhost:5173` 도 함께 적어야 한다. 실제 적용된 값은 배포 출력의
`AllowedOrigins` 에서 확인할 수 있다.

## 정리

```bash
cd infra && npx cdk destroy
```

DynamoDB 테이블과 User Pool 은 `RemovalPolicy.DESTROY` 라 함께 삭제된다.
실습용 설정이므로, 실제 서비스라면 `RETAIN` 으로 바꿔야 한다.

## 알려진 사항

- 로그인 화면은 `@aws-amplify/ui-react` 대신 `aws-amplify/auth` 를 직접 불러
  만들었다. 그 패키지를 쓰던 시절 번들이 1.1MB(gzip 246KB)였는데 지금은
  341KB(gzip 103KB)다. 스타일시트만 320KB 였고, 대부분은 90년대 풍으로
  덮어쓰느라 버려지던 규칙이었다.
- 앱은 최근 365일치를 한 번에 받아 달력과 통계를 그린다. 그보다 오래된 기록은
  `GET /entries?from=&to=` 로 따로 가져와야 한다.
