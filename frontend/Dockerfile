# Tiny static-file server for the Todo frontend.
# The backend URL is injected at container *start* time (not build time) via
# the API_BASE env var, so the same image can be pointed at any backend
# without rebuilding. See docker-entrypoint.d/40-generate-config.sh.
FROM nginx:1.27-alpine

COPY index.html style.css app.js /usr/share/nginx/html/
COPY docker-entrypoint.d/40-generate-config.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh

# Optional: set at `docker run -e API_BASE=http://<backend-ip>:8080/api/todos`
# or via the ECS task definition's container "environment" list.
ENV API_BASE=""

EXPOSE 80
