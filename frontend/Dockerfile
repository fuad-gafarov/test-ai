# syntax=docker/dockerfile:1
# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage: unprivileged nginx (runs as uid 101, no root needed) ----
# Listens on 8081 (not 80/8080): in the shared-localhost Fargate task the api
# container owns 8080, and a non-root process should not bind <1024.
FROM nginxinc/nginx-unprivileged:1.28-alpine
# nginx.conf is a template: the image's entrypoint substitutes ${API_UPSTREAM}
# (only defined env vars are replaced, so nginx's own $variables are untouched).
ENV API_UPSTREAM=127.0.0.1:8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8081
