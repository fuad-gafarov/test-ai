# Todo app on AWS (ECS Fargate) - CDK

TypeScript AWS CDK app that deploys the Todo app (React + Spring Boot) to **one ECS Fargate task** behind a public
Application Load Balancer, with todos stored on an encrypted **EFS** file system.

## Architecture

```
Internet --HTTP:80--> ALB (public subnets, 2 AZs)
                        |  target group, health check GET /  (port 8081)
                        v
        Fargate service (desiredCount 1, public IP, awsvpc)  -- one task, shared localhost --
          +-- web  (nginxinc/nginx-unprivileged, :8081)  serves React build, proxies /api/ -> 127.0.0.1:8080
          +-- api  (eclipse-temurin:25-jre, Spring Boot :8080, --todo.data-file=/data/todos.txt)
                        |  /data  (EFS access point /todos, uid/gid 10001, TLS + IAM auth)
                        v
                      EFS (encrypted at rest, TLS in transit, RETAIN on stack delete)
Logs: CloudWatch Logs, one group, 14-day retention, stream prefixes `web` and `api`
```

`cdk deploy` builds `backend/Dockerfile` and `frontend/Dockerfile` locally and pushes them to the CDK bootstrap ECR
repository (`cdk-hnb659fds-container-assets-<account>-<region>`), so you need Docker running.

### Resources created by `cdk deploy` (stack `TodoStack`)

| Area | Resources |
|------|-----------|
| Network | VPC (10.0.0.0/16), 2 public subnets (2 AZs), Internet Gateway, route tables. **No NAT gateway, no private subnets** |
| Security groups | ALB SG (80 from 0.0.0.0/0), task SG (8081 from ALB SG only), EFS SG (2049 from task SG only, no egress) |
| Load balancer | Internet-facing ALB, HTTP:80 listener, target group (HTTP 8081, health check `/`) |
| Compute | ECS cluster, Fargate task definition (0.5 vCPU / 1 GB, Linux x86_64), ECS service (desired 1, min healthy 0 %, max 100 %, deployment circuit breaker with rollback) |
| Storage | EFS file system (encrypted, **RETAIN**), 2 mount targets, access point `/todos` (uid/gid 10001), file-system policy denying non-TLS access |
| Logs | 1 CloudWatch log group, 2-week retention |
| IAM | Task execution role (CDK-generated: ECR pull of the two images + write to the log group), task role (only `elasticfilesystem:ClientMount/ClientWrite` on this file system, restricted to the access point) |
| Images | 2 Docker image assets in the bootstrap ECR repo |
| Outputs | `AppUrl`, `DataFileSystemId`, `LogGroupName` |

Plus, once per account/region, `cdk bootstrap` creates the `CDKToolkit` stack (S3 asset bucket, ECR asset repo, IAM roles).

### Decisions and trade-offs

- **Single writer.** `desiredCount 1`, `minimumHealthyPercent 0`, `maximumPercent 100`: a redeploy stops the old task before
  starting the new one, so two tasks never write `todos.txt` concurrently. Cost: about 1-2 minutes of downtime per deploy.
  There is no autoscaling and no high availability: a failed AZ or task means downtime until ECS replaces it.
- **nginx listens on 8081, not 80.** Both containers share one network namespace (awsvpc), and Spring Boot owns 8080,
  which is also the default port of `nginx-unprivileged`. The unprivileged image runs as uid 101 and should not bind
  ports below 1024, so 8081 is used. The ALB listener is still port 80; only the target port differs.
- **Public subnets, public IP, no NAT.** A NAT gateway costs about 33 USD/month in us-east-1 plus data; this layout avoids it.
  Trade-off: the task has a public IP, but its security group only accepts traffic from the ALB, and the EFS is only
  reachable from the task. Nothing is reachable directly from the internet except the ALB.
- **HTTP only.** No domain/certificate was requested. Traffic between browser and ALB is unencrypted. To add HTTPS:
  register a domain, issue an ACM certificate, add an HTTPS:443 listener, redirect 80 to 443.
- **x86_64.** Graviton (ARM64) Fargate is about 20 % cheaper, but building ARM images on a typical Windows PC needs QEMU
  emulation (slow). Switch `cpuArchitecture` and `Platform.LINUX_ARM64` in `lib/todo-stack.ts` if you want that.
- **EFS** uses General Purpose / Bursting throughput. The data is a few KB, so storage cost is effectively zero.
  Automatic backups are off (AWS Backup would add cost). The EFS is **retained** on `cdk destroy`.
- **Health checks.** The ALB checks nginx at `/` (status 200). The `api` container has its own ECS health check against
  Spring Actuator `/actuator/health` (already a dependency; no backend change needed) and `web` starts only after `api` is
  healthy. The Actuator endpoint is not exposed through nginx. Note the ALB check proves nginx is up, not the API; if the
  API dies the essential container exit makes ECS replace the task.
- **No backend changes are required.** Same-origin requests through nginx pass Spring's CORS check (nginx forwards the
  original `Host`), so `todo.cors-allowed-origin` can stay at its default.
- **ECR.** The bootstrap asset repository has no lifecycle policy, so each deployed image version stays until deleted.
  Each version is about 0.16 GB (about 0.02 USD/month).

## Prerequisites (Windows)

1. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (2.32.0 or newer for `aws login`).
2. Node.js 20+ and npm.
3. Docker Desktop, **running** (Linux containers mode).
4. Sign in: `aws login` (or `aws login --profile NAME`). No access keys are needed. The identity needs permission for
   CloudFormation, IAM role creation, S3, ECR, ECS, EC2/VPC, EFS, ELB, CloudWatch Logs and SSM (PowerUserAccess plus
   IAM role management, or AdministratorAccess in a personal sandbox account).

## Deploy

From the repository root:

```bat
deploy-aws.bat            REM default profile
deploy-aws.bat myprofile  REM named profile
```

The script checks the AWS CLI, Node, Docker (running) and credentials (`aws sts get-caller-identity`), asks for
confirmation, runs `cdk bootstrap` if the account/region is not bootstrapped, runs `cdk deploy`, and prints the URL.
Region comes from the profile, else `AWS_REGION`/`AWS_DEFAULT_REGION`, else `us-east-1`.

Manual equivalent:

```bat
cd infra
npm ci
set CDK_DEFAULT_ACCOUNT=<account-id>
set CDK_DEFAULT_REGION=us-east-1
npx cdk bootstrap
npm run deploy
```

Other scripts: `npm run build` (type-check), `npm run synth`, `npm run diff`, `npm run destroy`.
Optional compliance scan: `npx cdk synth -c nag=true` (cdk-nag AwsSolutions pack; intentional exceptions are suppressed
with reasons in `lib/todo-stack.ts`).

## Destroy

```bat
destroy-aws.bat [profile]
```

Asks you to type `destroy`, then runs `cdk destroy`. **The EFS file system (your todos) is retained** and keeps
costing cents per month. Delete it permanently with
`aws efs delete-file-system --file-system-id <fs-id>` (the id is an output of the stack and is printed by the script).
The `CDKToolkit` bootstrap stack and image assets also stay; remove them separately if you no longer use CDK in the account.

A fresh deploy after destroy creates a **new, empty** EFS; the old one is not re-attached automatically.

## Estimated monthly cost (us-east-1, on-demand, 730 h/month, USD)

| Item | Basis | Per month |
|------|-------|-----------|
| Fargate task | 0.5 vCPU x 0.04048 USD/h = 14.78; 1 GB x 0.004445 USD/GB-h = 3.24 | **18.02** |
| Application Load Balancer | 0.0225 USD/h = 16.43; LCU 0.008 USD/LCU-h at roughly 0.1 LCU average (low traffic) = 0.58 | **17.01** |
| Public IPv4 addresses | 3 (1 task + 1 per ALB AZ) x 0.005 USD/h | **10.95** |
| EFS | General Purpose storage 0.30 USD/GB-month; data is a few KB | **< 0.01** |
| CloudWatch Logs | 0.50 USD/GB ingested, 0.03 USD/GB-month stored; a few MB/month | **< 0.50** |
| ECR (bootstrap repo) | 0.10 USD/GB-month, about 0.16 GB per deployed version | **< 0.10** |
| Data transfer out | first 100 GB/month to the internet free; this app transfers KBs | ~0 |
| **Total (about)** | | **about 46 USD/month (about 0.063 USD/hour)** |

Not included: a NAT gateway (not used; would add about 33 USD), Route 53/ACM, AWS Backup, taxes. `cdk bootstrap` itself costs
almost nothing. The biggest levers: stop paying by destroying the stack when not in use (the ALB + Fargate + IPv4 portion
is billed hourly), Graviton (about -20 % on Fargate), or a smaller task (0.25 vCPU / 0.5 GB is about 9 USD but is tight for a JVM).

Pricing sources (public AWS Price List bulk files, fetched 2026-10-01, region us-east-1):
`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{AmazonECS,AWSELB,AmazonEFS,AmazonCloudWatch,AmazonECR,AmazonVPC}/current/us-east-1/index.json`.
The ALB LCU average is an assumption; actual LCU-hours depend on traffic.

## Files

- `bin/todo-app.ts` - CDK app entry; account/region from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION`
- `lib/todo-stack.ts` - the stack
- `../backend/Dockerfile`, `../frontend/Dockerfile`, `../frontend/nginx.conf` - images
- `../deploy-aws.bat`, `../destroy-aws.bat` - Windows helpers
