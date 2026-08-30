import {
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
  Duration,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as path from 'node:path';

/**
 * 한 줄 회고 기록장 - 전체 백엔드.
 *
 * 학습용 프로젝트라 스택을 하나로 합쳤다. 리소스가 늘어나면
 * Data / Auth / Api 로 쪼개는 편이 낫다.
 */
export class RetroStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------
    // 데이터: 사용자별 날짜별 회고 한 건
    // PK = userId (Cognito sub), SK = date (YYYY-MM-DD)
    // 한 사용자의 기간 조회가 SK range query 로 바로 되는 구조다.
    // ---------------------------------------------------------------
    const table = new dynamodb.Table(this, 'EntriesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // 실습 계정이라 스택 삭제 시 테이블도 함께 지운다.
      // 실제 서비스라면 RETAIN 이어야 한다.
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
    });

    // ---------------------------------------------------------------
    // 인증: 이메일로 가입/로그인하는 사용자 풀
    // ---------------------------------------------------------------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 브라우저에서 직접 쓰는 클라이언트라 시크릿을 두지 않는다.
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      generateSecret: false,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // ---------------------------------------------------------------
    // 로직: 엔트리 CRUD 한 개의 Lambda 가 라우팅까지 담당
    // 번들러(esbuild) 없이 돌도록 순수 CommonJS 로 작성했다.
    // Node 20 런타임에 AWS SDK v3 가 이미 포함되어 있어 의존성이 없다.
    // ---------------------------------------------------------------
    const entriesLogGroup = new logs.LogGroup(this, 'EntriesFnLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const entriesFn = new lambda.Function(this, 'EntriesFn', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'entries.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup: entriesLogGroup,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadWriteData(entriesFn);

    // ---------------------------------------------------------------
    // API: Cognito ID 토큰을 검증하는 HTTP API
    // ---------------------------------------------------------------
    const authorizer = new HttpJwtAuthorizer(
      'JwtAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    const api = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        // 배포 후 Amplify 도메인으로 좁히는 것을 권장한다.
        allowOrigins: ['*'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
      },
    });

    const integration = new HttpLambdaIntegration('EntriesIntegration', entriesFn);

    api.addRoutes({
      path: '/entries',
      methods: [HttpMethod.GET],
      integration,
      authorizer,
    });

    api.addRoutes({
      path: '/entries/{date}',
      methods: [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE],
      integration,
      authorizer,
    });

    // ---------------------------------------------------------------
    // 프론트엔드 .env 에 넣을 값들
    // ---------------------------------------------------------------
    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'Region', { value: this.region });
  }
}
