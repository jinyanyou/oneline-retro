# 한마디

하루를 한마디로 기록하고, 지난 날들을 돌아보는 회고 노트.
1995년 데스크톱 GUI 를 그대로 옮겨 놓은 화면에서 쓴다.

**→ [한마디 열기](https://oneline-retro.dq7wl11l9whxd.amplifyapp.com)**

하루에 한 줄이면 충분하다는 생각에서 시작했다. 길게 쓰려면 부담스러워 미루게
되고, 미루면 아예 안 쓰게 된다. 그래서 입력 칸은 280자로 막아 두고, 기분은
얼굴 세 개 중에 고르기만 하면 되게 했다. 대신 쌓인 기록을 달력과 통계로 돌아볼
수 있게 했다.

## 무엇을 할 수 있나

- **오늘 한마디** — 한 줄(280자)과 기분(좋았다 / 그럭저럭 / 아쉬웠다)
- **목록** — 최신 날짜부터. 각 줄에서 바로 수정·삭제
- **달력** — 기록한 날은 튀어나온 칸에 기분 얼굴이 찍힌다. **빈 날을 눌러 지난
  날의 기록을 채워 넣을 수도 있다**
- **통계** — 연속 기록 일수, 최장 연속, 이번 달 기록률, 기분 분포
- 삭제는 되돌릴 수 없으므로 확인 대화 상자를 거친다
- 로그아웃은 **파일** 메뉴에 있다 (제목 표시줄 X 버튼도 같은 동작)

```
┌────────────────────────────────────────────────┬───┬───┬───┐
│ 한마디 - me@example.com                        │ _ │ □ │ X │
├────────────────────────────────────────────────┴───┴───┴───┤
│  파일   편집   보기   도움말                               │
├────────────────────────────────────────────────────────────┤
│ ┌─ 8월 31일 (일) ────────────────────────────────────────┐ │
│ │  오늘 기분  [ 😊 좋았다 ][ 😐 그럭저럭 ][ 😞 아쉬웠다 ] │ │
│ │  ┌───────────────────────────────────────────────────┐ │ │
│ │  │ 오늘 하루를 한마디로 남겨보세요.                  │ │ │
│ │  └───────────────────────────────────────────────────┘ │ │
│ │  268자 남음                                   [ 저장 ] │ │
│ └────────────────────────────────────────────────────────┘ │
│  ┌──────┐┌──────┐┌──────┐                                  │
│  │ 목록 ││ 달력 ││ 통계 │                                  │
│ ┌┴──────┴┴──────┴┴──────┴─────────────────────────────────┐│
│ │        ◀ 이전      1996년 8월      오늘    다음 ▶       ││
│ │   일    월    화    수    목    금    토                 ││
│ │              ┌───┐ ┌───┐ ┌───┐                          ││
│ │    1    2    │ 3 │ │ 4 │ │ 5 │  6    7                  ││
│ │              │😊 │ │😐 │ │😊 │                          ││
│ │              └───┘ └───┘ └───┘                          ││
│ └─────────────────────────────────────────────────────────┘│
├──────────────┬────────────────────────────┬────────────────┤
│ 기록 12개    │ 오후 3:14 저장됨           │ 2026-08-31     │
└──────────────┴────────────────────────────┴────────────────┘
```

테두리는 전부 `box-shadow` 를 4겹으로 겹쳐 그렸다. 이미지는 한 장도 쓰지 않는다.

## 구성

| 계층 | 서비스 |
| --- | --- |
| 프론트엔드 | React + TypeScript + Vite → Amplify Hosting |
| 로그인 | Amazon Cognito User Pool |
| API | API Gateway (HTTP API) + JWT 권한 부여자 |
| 로직 | AWS Lambda (Node.js 24) |
| 데이터 | DynamoDB |
| 인프라 | AWS CDK (TypeScript) |

```
브라우저 ──① 이메일 + 비밀번호 ──▶ Cognito User Pool
    │                                    │
    │◀────────── ID 토큰 ────────────────┘
    │
    └─② Authorization: Bearer <ID 토큰> ─▶ API Gateway
                                              │ JWT 검증 (audience = 앱 클라이언트)
                                              ▼
                                           Lambda ──▶ DynamoDB
                                                      PK userId (sub) / SK date
```

권한 부여자가 통과시킨 요청만 Lambda 에 닿고, Lambda 는 토큰에서 꺼낸 `sub` 을
파티션 키로 쓴다. 그래서 남의 기록은 조회 자체가 성립하지 않는다.

리전은 `ap-northeast-2` (서울).

## 디렉터리

```
.
├── src/                    프론트엔드
│   ├── App.tsx             창 전체 + 입력 칸 + 탭
│   ├── Auth.tsx            로그인 / 회원가입 / 코드 확인
│   ├── Calendar.tsx        달력 탭
│   ├── Stats.tsx           통계 탭
│   ├── ConfirmDialog.tsx   삭제 확인 대화 상자
│   ├── TitleBar.tsx        창 제목 표시줄
│   ├── date.ts             날짜 키 다루기
│   ├── moods.ts            기분 목록
│   ├── api.ts              API 호출 + 토큰 첨부
│   ├── amplify-config.ts   Cognito 설정
│   └── App.css             1995년 데스크톱 GUI 전부
├── infra/                  백엔드 (AWS CDK)
│   ├── bin/app.ts          CDK 진입점
│   ├── lib/retro-stack.ts  리소스 정의
│   └── lambda/entries.js   API 핸들러
└── amplify.yml             Amplify Hosting 빌드 설정
```

## API

모든 요청에 Cognito **ID 토큰**이 필요하다 (`Authorization: Bearer <token>`).
액세스 토큰이 아니다 — 권한 부여자가 audience 를 앱 클라이언트 ID 로 검증한다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/entries` | 내 기록 목록 (최신순, `from`/`to`/`limit` 옵션) |
| GET | `/entries/{date}` | 특정 날짜 기록 |
| PUT | `/entries/{date}` | 기록 생성/수정 `{ text, mood }` |
| DELETE | `/entries/{date}` | 기록 삭제 |

`date` 는 `YYYY-MM-DD`, `mood` 는 `good` / `soso` / `bad` 또는 생략.
`from` 과 `to` 는 함께 줘야 적용되고, `limit` 은 서버에서 365 로 잘린다.

## 로컬에서 실행하기

백엔드가 먼저 있어야 한다. 아래 [백엔드 배포](#백엔드-배포)를 참고해
`ApiUrl` / `UserPoolId` / `UserPoolClientId` 를 얻어 둔다.

```bash
cp .env.example .env   # 위 세 값을 채운다
npm install
npm run dev            # http://localhost:5173
```

`.env` 가 비어 있으면 설정 안내 화면이 뜬다.

```bash
npm run build   # 타입 검사 + 프로덕션 빌드
npm run lint
```

## 백엔드 배포

```bash
cd infra
npm install
npx cdk deploy
```

로컬에 AWS 자격 증명이 없다면 콘솔의 **CloudShell** 을 쓰는 편이 빠르다.
자격 증명이 자동으로 들어가 있어 저장소만 받으면 된다. `CDKToolkit` 부트스트랩은
이미 되어 있으므로 `cdk bootstrap` 은 필요 없다.

배포가 끝나면 Outputs 에 프론트엔드가 쓸 값이 나온다.

```
RetroStack.ApiUrl            = https://xxxx.execute-api.ap-northeast-2.amazonaws.com
RetroStack.UserPoolId        = ap-northeast-2_xxxxxxxxx
RetroStack.UserPoolClientId  = xxxxxxxxxxxxxxxxxxxxxxxxxx
RetroStack.AllowedOrigins    = http://localhost:5173
RetroStack.EmailSender       = Cognito 기본 발신자 (하루 50통)
```

### CORS 허용 출처

배포할 때 정한다. 아무것도 넘기지 않으면 로컬 개발 서버만 허용한다.

```bash
npx cdk deploy -c origins=https://oneline-retro.xxxxx.amplifyapp.com,http://localhost:5173
```

넘긴 목록이 기존 설정을 **통째로 대체**하므로, 로컬 개발을 계속할 거면
`http://localhost:5173` 도 함께 적어야 한다. 실제 적용된 값은 `AllowedOrigins`
출력으로 확인한다.

## 프론트엔드 배포 (Amplify Hosting)

배포 주소의 앞부분은 **브랜치 이름**이 된다. 그래서 `main` 을 그대로 쓰지 않고
배포 전용 브랜치 `oneline-retro` 를 둔다.

```bash
git push origin main:oneline-retro
```

`main` 은 작업용으로 남고, 배포할 때만 위 한 줄을 실행한다. 브랜치를 오갈
필요가 없고, Amplify 가 감지해서 자동으로 다시 빌드한다.

처음 연결할 때:

1. AWS 콘솔 → **Amplify** → 새 앱 생성 → GitHub 연결
2. 저장소를 고르고 브랜치는 **`oneline-retro`** 를 선택
3. `amplify.yml` 이 자동 인식된다 (`npm ci` → `npm run build` → `dist`)
4. **환경 변수**에 `.env` 와 같은 4개 값을 등록 — 빠뜨리면 설정 안내 화면만 나온다
5. 배포 후 `https://oneline-retro.xxxxx.amplifyapp.com` 접속

앱 이름은 영숫자만 받는다(한글 불가). `xxxxx` 는 Amplify 가 만드는 앱 ID 라 고를
수 없고, 주소를 온전히 정하려면 사용자 지정 도메인을 연결해야 한다.

클라이언트 라우터를 쓰지 않으므로 SPA 리라이트 규칙은 필요 없다.

## 알려진 사항

- **가입 인증 메일이 스팸함으로 자주 간다.** Cognito 기본 발신자
  (`no-reply@verificationemail.com`)는 도메인 평판이 없다. 하루 50통 한도도 있다.
  제대로 고치려면 도메인을 인증해 SES 로 보내야 한다. 인프라는 열어 두었으니
  발신 주소만 넘기면 된다.

  ```bash
  npx cdk deploy -c sesFrom=no-reply@내도메인.com
  ```

  단 SES 는 처음에 샌드박스 상태라 인증된 수신자에게만 발송된다. 해제 신청이
  따로 필요하다. 도메인 없이 개인 메일 주소를 발신자로 등록하는 것은 권하지
  않는다 — DKIM 정렬이 깨져 오히려 스팸 판정이 나빠진다.
- **사이트에 비밀번호 보호가 걸려 있지 않다.** 주소를 아는 사람은 가입할 수 있다.
  Amplify 콘솔의 **호스팅 → 액세스 제어**에서 켤 수 있다.
- 앱은 최근 365일치를 한 번에 받아 달력과 통계를 그린다. 그보다 오래된 기록은
  `GET /entries?from=&to=` 로 따로 가져와야 한다.
- 로그인 화면은 `@aws-amplify/ui-react` 대신 `aws-amplify/auth` 를 직접 불러
  만들었다. 그 패키지를 쓰던 시절 번들이 1.1MB(gzip 246KB)였는데 지금은
  345KB(gzip 104KB)다. 스타일시트만 320KB 였고 대부분은 90년대 풍으로 덮어쓰느라
  버려지던 규칙이었다.
- 실습용 설정이라 DynamoDB 테이블과 User Pool 이 `RemovalPolicy.DESTROY` 다.
  실제 서비스라면 `RETAIN` 이어야 한다.

## 정리

```bash
cd infra && npx cdk destroy
```

테이블과 User Pool 이 함께 삭제된다. Amplify 앱은 콘솔에서 따로 지운다.
