#!/usr/bin/env bash
# Central configuration for all deploy scripts. Edit these if you want
# different names/region; everything else derives from here.
set -euo pipefail

# --- Editable settings ---------------------------------------------------
AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER_NAME="${CLUSTER_NAME:-todo-app-cluster}"
BACKEND_REPO="${BACKEND_REPO:-todo-backend}"
FRONTEND_REPO="${FRONTEND_REPO:-todo-frontend}"
BACKEND_SERVICE="${BACKEND_SERVICE:-todo-backend-svc}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-todo-frontend-svc}"
BACKEND_FAMILY="todo-backend"
FRONTEND_FAMILY="todo-frontend"
EXEC_ROLE_NAME="todoAppTaskExecutionRole"
SG_NAME="todo-app-sg"
BACKEND_PORT=8080
FRONTEND_PORT=80
# --------------------------------------------------------------------------

# Derived at runtime (require aws cli + credentials already configured).
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BACKEND_IMAGE_REPO_URI="${ECR_REGISTRY}/${BACKEND_REPO}"
FRONTEND_IMAGE_REPO_URI="${ECR_REGISTRY}/${FRONTEND_REPO}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${REPO_ROOT}/deploy"
TASK_DEFS_DIR="${DEPLOY_DIR}/task-defs"
RENDERED_DIR="${DEPLOY_DIR}/task-defs/rendered"
mkdir -p "${RENDERED_DIR}"

export AWS_REGION CLUSTER_NAME BACKEND_REPO FRONTEND_REPO BACKEND_SERVICE FRONTEND_SERVICE
export BACKEND_FAMILY FRONTEND_FAMILY EXEC_ROLE_NAME SG_NAME BACKEND_PORT FRONTEND_PORT
export AWS_ACCOUNT_ID ECR_REGISTRY BACKEND_IMAGE_REPO_URI FRONTEND_IMAGE_REPO_URI
export REPO_ROOT DEPLOY_DIR TASK_DEFS_DIR RENDERED_DIR
