#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { RetroStack } from '../lib/retro-stack';

const app = new App();

new RetroStack(app, 'RetroStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-2',
  },
  description: '한 줄 회고 기록장 - Cognito + HTTP API + Lambda + DynamoDB',
});
