#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { TodoStack } from '../lib/todo-stack';

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
if (!region) {
  throw new Error(
    'No AWS region resolved. Set CDK_DEFAULT_REGION (e.g. us-east-1) or configure a region in your AWS profile.',
  );
}

new TodoStack(app, 'TodoStack', {
  env: { account, region },
  description: 'Todo app: ECS Fargate (nginx + Spring Boot) behind an ALB, todos on encrypted EFS',
});

// Optional compliance scan:  npx cdk synth -c nag=true
if (app.node.tryGetContext('nag') === 'true') {
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
}
