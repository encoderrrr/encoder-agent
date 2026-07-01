FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY README.md ./
COPY .env.example ./

RUN npm run build

CMD ["npm", "run", "start"]
