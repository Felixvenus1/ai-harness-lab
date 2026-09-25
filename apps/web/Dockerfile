# Purpose: Build and run the web app container in local development.
FROM node:22-alpine
# Keep the repo layout so tsconfig "extends: ../../tsconfig.base.json" resolves.
WORKDIR /repo/apps/web
COPY tsconfig.base.json /repo/
COPY apps/web .
RUN npm ci
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
