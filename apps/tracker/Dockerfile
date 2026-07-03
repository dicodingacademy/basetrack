FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# Dependencies stage (includes all workspaces for monorepo resolution)
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

# Generate prisma client inside the workspace
RUN npm run db:generate --workspace=@basetrack/db
# Build the tracker app
RUN npm run build --workspace=apps-tracker

# Production runner stage
FROM base AS runner
# Copy root package.json for workspace awareness
COPY --from=build-env /app/package.json /app/package.json
COPY --from=build-env /app/node_modules /app/node_modules
COPY --from=build-env /app/apps/tracker /app/apps/tracker
COPY --from=build-env /app/packages/db /app/packages/db

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start", "-w", "apps-tracker"]
