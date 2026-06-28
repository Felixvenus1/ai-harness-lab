# Purpose: Build and run the web app container in local development.
FROM node:22-alpine
WORKDIR /app
COPY tsconfig.base.json .
COPY apps/web .
RUN npm install
EXPOSE 5173
CMD ["sh", "-c", "npm run dev"]
