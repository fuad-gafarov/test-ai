@echo off
rem Destroy the Todo app stack from AWS.
rem
rem Usage:
rem   destroy-aws.bat [aws-profile]     (default profile: "default")
rem
rem What is removed: ALB, ECS service/cluster, VPC, security groups, log group, IAM roles.
rem What is KEPT:    the EFS file system with todos.txt (removal policy RETAIN) and the
rem                  CDK bootstrap resources (CDKToolkit stack, image assets in ECR/S3).
rem The retained EFS keeps costing about 0.30 USD per GB-month (cents for this app).
rem To delete it too:  aws efs delete-file-system --file-system-id fs-XXXX --profile NAME
rem                    (the id is printed below and shown in the EFS console)

setlocal EnableExtensions
set "ROOT=%~dp0"
set "PROFILE=%~1"
if "%PROFILE%"=="" set "PROFILE=default"

where aws >nul 2>nul || (echo error: AWS CLI not found. & exit /b 1)
where node >nul 2>nul || (echo error: Node.js not found. & exit /b 1)

set "ACCOUNT="
for /f "usebackq delims=" %%A in (`aws sts get-caller-identity --profile %PROFILE% --query Account --output text 2^>nul`) do set "ACCOUNT=%%A"
if not defined ACCOUNT (
  echo error: no valid AWS credentials for profile "%PROFILE%". Run: aws login --profile %PROFILE%
  exit /b 1
)
set "REGION="
for /f "usebackq delims=" %%R in (`aws configure get region --profile %PROFILE% 2^>nul`) do set "REGION=%%R"
if not defined REGION set "REGION=%AWS_REGION%"
if not defined REGION set "REGION=%AWS_DEFAULT_REGION%"
if not defined REGION set "REGION=us-east-1"

set "FSID="
for /f "usebackq delims=" %%F in (`aws cloudformation describe-stacks --stack-name TodoStack --profile %PROFILE% --region %REGION% --query "Stacks[0].Outputs[?OutputKey=='DataFileSystemId'].OutputValue" --output text 2^>nul`) do set "FSID=%%F"

echo This will DESTROY stack TodoStack in account %ACCOUNT% / %REGION% ^(profile %PROFILE%^).
echo The app will go offline. The EFS file system %FSID% with your todos is RETAINED, not deleted.
set "CONFIRM="
set /p "CONFIRM=Type 'destroy' to continue: "
if /i not "%CONFIRM%"=="destroy" (echo Cancelled. & exit /b 1)

set "CDK_DEFAULT_ACCOUNT=%ACCOUNT%"
set "CDK_DEFAULT_REGION=%REGION%"
set "AWS_PROFILE=%PROFILE%"
pushd "%ROOT%infra"
if not exist node_modules (
  call npm ci || (popd & exit /b 1)
)
call npx cdk destroy TodoStack --force --profile %PROFILE% || (popd & echo Destroy FAILED & exit /b 1)
popd

echo.
echo ==^> Stack destroyed.
echo     Retained EFS file system: %FSID%   ^(still billed; holds todos.txt^)
echo     To delete it permanently:  aws efs delete-file-system --file-system-id %FSID% --profile %PROFILE% --region %REGION%
exit /b 0
