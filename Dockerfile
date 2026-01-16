FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./

RUN npm install --quiet --no-fund --loglevel=error

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate && \
    npm run build && \
    npm prune --production


    
FROM node:22-slim AS production

WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=build --chown=appuser:appgroup /app/dist /app/dist
COPY --from=build --chown=appuser:appgroup /app/node_modules /app/node_modules
COPY --from=build --chown=appuser:appgroup /app/prisma /app/prisma

USER appuser

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main.js"]