# Deploying the Todo app to AWS Fargate (cheap test setup)

This deploys the `frontend/` (nginx, static files) and `backend/` (Spring
Boot) containers as two independent ECS Fargate services, **with no load
balancer**. Each task gets a public IP directly (`awsvpc` network mode +
`assignPublicIp: ENABLED`). This is the cheapest way to run two public
containers on Fargate, at the cost of the app's IP changing whenever a task
restarts or you redeploy.

If you outgrow this (need a stable hostname, HTTPS, multiple tasks, etc.),
the standard upgrade path is: put an Application Load Balancer in front of
each service (or one ALB with path/host routing for both), and point a
Route 53 record at it. That's a ~$16-20/month fixed cost this setup avoids -
not built here on purpose.

## What gets created

| Resource | Purpose |
|---|---|
| ECR repos `todo-backend`, `todo-frontend` | Store built images |
| ECS cluster `todo-app-cluster` (Fargate) | Runs both services |
| ECS service `todo-backend-svc` | 1 task, 0.5 vCPU / 1 GB, port 8080 |
| ECS service `todo-frontend-svc` | 1 task, 0.25 vCPU / 0.5 GB, port 80 |
| IAM role `todoAppTaskExecutionRole` | Lets ECS pull images from ECR + write logs |
| Security group `todo-app-sg` | Inbound tcp/80 and tcp/8080 from 0.0.0.0/0, all outbound |
| CloudWatch log groups `/ecs/todo-backend`, `/ecs/todo-frontend` | Container logs |

No ALB, no NAT gateway, no Route 53 record, no VPC created (uses your
account's default VPC + its public subnets).

## Prerequisites

- AWS CLI v2, configured with credentials that can create/manage ECR, ECS,
  IAM, EC2 (security groups), and CloudWatch Logs resources
  (`aws configure` or `aws sso login`).
- Your AWS account ID and preferred region (defaults to `us-east-1` -
  override by exporting `AWS_REGION` before running any script, or editing
  `deploy/scripts/config.sh`).
- A default VPC in that region (nearly every AWS account has one; if yours
  doesn't, set `VPC_ID` and `SUBNET_IDS` env vars before running the
  scripts - see `deploy/scripts/lib.sh`).
- Docker, for building images.
- `bash`, `sed`, `git` (all standard on Linux/macOS; on Windows use WSL).

All scripts live in `deploy/scripts/` and are idempotent - safe to re-run.

## One-time setup

```bash
cd deploy/scripts
./01-one-time-setup.sh
```

This creates the ECR repos, ECS cluster, IAM execution role, log groups,
and security group. It does **not** deploy anything yet (there's nothing to
deploy - no images exist in ECR until the first `02-deploy.sh` run).

## Day-to-day: build, push, and deploy an update

### Option A - run it yourself locally

```bash
cd deploy/scripts
./02-deploy.sh
```

This will, in order:
1. Build the backend image, tag it with the current git short SHA and
   `latest`, push both tags to ECR.
2. Register a new backend task definition revision and either create the
   backend service (first run) or update it with `--force-new-deployment`.
3. Wait for the backend service to reach steady state, then resolve its
   new task's public IP.
4. Build and push the frontend image, with its task definition's `API_BASE`
   env var set to `http://<backend-ip>:8080/api/todos`.
5. Create/update the frontend service the same way, wait for it to
   stabilize, and print both public URLs.

Useful variants:
- `./02-deploy.sh --backend-only` - only rebuild/redeploy the backend
  (does **not** touch the frontend's task, so the frontend keeps whatever
  backend IP it already has - if the backend's IP changed, follow with
  `--frontend-only` to repoint it).
- `./02-deploy.sh --frontend-only` - rebuild the frontend, pointed at
  whatever backend IP is currently live.

Because there's no load balancer, a plain "update just one service" isn't
quite as simple as with an ALB setup: if the backend's IP changes, the
frontend must be redeployed to pick up the new IP. Easiest habit: just run
`./02-deploy.sh` with no flags - it always deploys backend then frontend
and wires them together correctly, and Fargate billing is per-second so an
extra frontend redeploy costs essentially nothing.

### Option B - trigger the GitHub Actions workflow

`.github/workflows/deploy.yml` runs the exact same `deploy/scripts/02-deploy.sh`
in CI. It's **manually triggered only** (`workflow_dispatch`), not on every
push - see "Why manual, not automatic" below.

One-time repo setup for this to work:
1. Create an IAM user (or role) with the same permissions as above, scoped
   down to ECR/ECS/logs (avoid attaching full admin if you can).
2. Add repo secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
3. Optionally add repo variables `AWS_REGION` and `CLUSTER_NAME` if you
   changed them from the defaults (`us-east-1` / `todo-app-cluster`).

To deploy: GitHub repo -> Actions tab -> "Deploy Todo app to Fargate" ->
"Run workflow" -> pick `both` / `backend-only` / `frontend-only`.

> A more secure alternative to long-lived access keys is OIDC federation
> (`aws-actions/configure-aws-credentials` supports `role-to-assume` with no
> stored secret at all). Not set up here to keep this test deployment
> simple - worth doing if this becomes a real project.

#### Why manual, not automatic-on-push

This setup deliberately does **not** deploy on every push to main:
- No ALB means every deploy can change the app's public IP. Auto-deploying
  on push would silently move the URL whenever someone merges, which is
  confusing for a demo app people might have bookmarked.
- It's explicitly a budget test app - deploys should be an intentional
  action, not a side effect of pushing code.

If you later add an ALB + Route 53 (stable URL), switching this workflow to
`on: push: branches: [main]` is a one-line change.

## Finding the app's public IP/URL

```bash
cd deploy/scripts
./03-get-url.sh
```

Prints the current frontend and backend public IPs/URLs by querying the
running tasks' ENIs. Safe to run any time; doesn't change anything. Under
the hood it's:

```bash
TASK_ARN=$(aws ecs list-tasks --cluster todo-app-cluster \
  --service-name todo-frontend-svc --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster todo-app-cluster --tasks "$TASK_ARN" \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value | [0]' --output text)
aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text
```

(swap `todo-frontend-svc` for `todo-backend-svc` for the API's IP).

Remember: this IP can change after any redeploy or task restart. Re-run
`03-get-url.sh` whenever you need the current one.

## Estimated monthly cost

Fargate on-demand pricing (us-east-1, per vCPU-hour ~$0.04048, per GB-hour
~$0.004445), running both services 24/7:

| Service | Size | $/hour | $/month (730h) |
|---|---|---|---|
| Backend | 0.5 vCPU / 1 GB | ~$0.0247 | ~$18.00 |
| Frontend | 0.25 vCPU / 0.5 GB | ~$0.0123 | ~$9.00 |
| **Total compute** | | | **~$27/month** |

Plus, effectively negligible:
- ECR image storage: ~$0.10/GB-month (images are well under 1 GB combined) -
  well under $1/month.
- CloudWatch Logs: free tier covers 5 GB ingestion/storage; a low-traffic
  demo app stays within it.
- Data transfer out: AWS's general free tier (1 GB/month, or 100 GB/month
  under some account types) comfortably covers demo-level traffic.
- No ALB (~$16-20/month saved), no NAT gateway (~$32/month saved - avoided
  entirely by using public subnets + public IPs).

**Bottom line: roughly $25-30/month if left running continuously.** Since
Fargate bills per second, you can cut this substantially by scaling
services to 0 when not actively demoing it (see below) - cost while stopped
is near-zero (just the fractions of a cent for ECR/log storage).

To pause without a full teardown (keeps all config, just stops billing for
compute):

```bash
aws ecs update-service --cluster todo-app-cluster --service todo-backend-svc --desired-count 0
aws ecs update-service --cluster todo-app-cluster --service todo-frontend-svc --desired-count 0
```

Resume with `./02-deploy.sh` (it will notice the services exist and give
them a fresh task/IP), or `--desired-count 1` on both services directly.

## Tearing everything down

```bash
cd deploy/scripts
./04-teardown.sh
```

Deletes both services, the cluster, both ECR repos (and every image in
them), the IAM role, the log groups, and the security group, after asking
for confirmation. Run this when you're done testing so nothing keeps
billing.

Double check afterward in the AWS Console (ECS, ECR, EC2 -> Security
Groups) for the region you used, in case anything was left in a state the
script couldn't clean up (e.g. a security group still attached to an ENI
that hasn't finished detaching - the script prints the exact retry command
if that happens).

## Notes / known limitations (all intentional for a cheap test deployment)

- **No HTTPS.** Both services are plain HTTP on their raw IPs.
- **No auth, wide-open CORS, public security group.** This mirrors the
  app's existing posture (see main README) - fine for a disposable demo,
  not for anything with real data.
- **Ephemeral data.** The backend's H2 database lives inside the container;
  every redeploy or restart wipes it. No EFS/volume is mounted (again, this
  matches the app's existing behavior - see `backend/Dockerfile`).
- **IP churn.** Every deploy can hand out a new public IP for either
  service. There's no DNS name. If you need a stable address, that's the
  trigger to add an ALB + Route 53 (see top of this doc).
- **Single task per service, no auto-recovery guarantees beyond ECS's
  own.** ECS will restart a crashed task, but with `desired-count 1` there's
  a brief gap with zero capacity while it does, and the new task gets a new
  IP.
