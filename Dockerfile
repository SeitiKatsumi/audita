FROM mcr.microsoft.com/playwright:v1.53.0-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ARG CAPROVER_GIT_COMMIT_SHA=local
ENV APP_VERSION=${CAPROVER_GIT_COMMIT_SHA}

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.html styles.css app.js server.mjs ./
COPY assets ./assets
COPY data ./data
COPY db ./db
COPY collectors ./collectors
COPY services ./services

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

CMD ["node", "server.mjs"]
