FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
COPY apps/tracker/package.json ./apps/tracker/
COPY apps/cron/package.json ./apps/cron/
COPY packages/db/package.json ./packages/db/
RUN npm ci

# Build stage
FROM base AS build-env
COPY --from=deps /app/node_modules /app/node_modules
COPY . /app/

# Generate prisma client for database access
RUN npm run db:generate --workspace=@basetrack/db

# Production runner stage
FROM base AS runner
COPY --from=build-env /app/package.json /app/package.json
COPY --from=build-env /app/node_modules /app/node_modules
COPY --from=build-env /app/apps/cron /app/apps/cron
COPY --from=build-env /app/packages/db /app/packages/db

ENV NODE_ENV=production

CMD ["npm", "start", "-w", "@basetrack/cron"]
