@echo off
rem Deploy the Todo app to AWS (ECS Fargate + ALB + EFS) with the AWS CDK.
rem
rem Usage:
rem   deploy-aws.bat [aws-profile]
rem
rem   aws-profile   AWS CLI profile to use (default: "default").
rem                 Sign in first with:  aws login [--profile NAME]
rem
rem Region: taken from the profile, else AWS_REGION / AWS_DEFAULT_REGION, else us-east-1.
rem This CREATES AWS resources that cost roughly 46 USD per month (see infra\README.md).
rem Requires: AWS CLI v2, Node.js 20+, Docker Desktop (running).

setlocal EnableExtensions
set "ROOT=%~dp0"
set "INFRA=%ROOT%infra"
set "PROFILE=%~1"
if "%PROFILE%"=="" set "PROFILE=default"

echo ==^> Checking prerequisites
where aws >nul 2>nul || (echo error: AWS CLI not found. Install AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html & exit /b 1)
where node >nul 2>nul || (echo error: Node.js not found. Install Node.js 20+ from https://nodejs.org & exit /b 1)
where npm  >nul 2>nul || (echo error: npm not found. Install Node.js 20+. & exit /b 1)
where docker >nul 2>nul || (echo error: Docker not found. Install Docker Desktop. & exit /b 1)
docker info >nul 2>nul || (echo error: Docker is installed but not running. Start Docker Desktop and retry. & exit /b 1)

echo ==^> Checking AWS credentials for profile "%PROFILE%"
set "ACCOUNT="
for /f "usebackq delims=" %%A in (`aws sts get-caller-identity --profile %PROFILE% --query Account --output text 2^>nul`) do set "ACCOUNT=%%A"
if not defined ACCOUNT (
  echo error: no valid AWS credentials for profile "%PROFILE%".
  echo        Run:  aws login --profile %PROFILE%     ^(or: aws login, for the default profile^)
  exit /b 1
)

set "REGION="
for /f "usebackq delims=" %%R in (`aws configure get region --profile %PROFILE% 2^>nul`) do set "REGION=%%R"
if not defined REGION set "REGION=%AWS_REGION%"
if not defined REGION set "REGION=%AWS_DEFAULT_REGION%"
if not defined REGION set "REGION=us-east-1"

set "CDK_DEFAULT_ACCOUNT=%ACCOUNT%"
set "CDK_DEFAULT_REGION=%REGION%"
set "AWS_PROFILE=%PROFILE%"
echo     account=%ACCOUNT%  region=%REGION%  profile=%PROFILE%

echo.
echo About to create: VPC, ALB, ECS Fargate service, encrypted EFS, log group, IAM roles
echo in account %ACCOUNT% / %REGION%. Estimated cost: about 46 USD per month.
set "OK="
set /p "OK=Continue? (y/N) "
if /i not "%OK%"=="y" (echo Cancelled. & exit /b 1)

pushd "%INFRA%"
if not exist node_modules (
  echo ==^> Installing infra dependencies
  call npm ci || (popd & exit /b 1)
)

echo ==^> Checking CDK bootstrap in %REGION%
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --profile %PROFILE% --region %REGION% >nul 2>nul
if errorlevel 1 (
  echo     Not bootstrapped. Running cdk bootstrap ^(creates the CDKToolkit stack: S3 bucket, ECR repo, IAM roles^)
  call npx cdk bootstrap aws://%ACCOUNT%/%REGION% --profile %PROFILE% || (popd & echo Bootstrap FAILED & exit /b 1)
) else (
  echo     Already bootstrapped.
)

echo ==^> Deploying ^(builds both Docker images and pushes them to ECR^)
call npx cdk deploy TodoStack --profile %PROFILE% --require-approval broadening --outputs-file cdk-outputs.json || (popd & echo Deploy FAILED & exit /b 1)
popd

set "URL="
for /f "usebackq delims=" %%U in (`aws cloudformation describe-stacks --stack-name TodoStack --profile %PROFILE% --region %REGION% --query "Stacks[0].Outputs[?OutputKey=='AppUrl'].OutputValue" --output text`) do set "URL=%%U"
echo.
echo ==^> Deployed. App URL: %URL%
echo     It can take 1-2 minutes after deploy before the load balancer reports the task healthy.
echo     Remove everything with destroy-aws.bat ^(todo data on EFS is RETAINED by default^).
exit /b 0
