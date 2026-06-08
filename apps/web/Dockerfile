# Purpose: Build and run the web app container in local development.
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable
RUN npm i -g pnpm
RUN pnpm install --no-frozen-lockfile || true
EXPOSE 5173
CMD ["sh", "-c", "pnpm dev --host 0.0.0.0 --port 5173"]
