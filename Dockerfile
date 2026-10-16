FROM oven/bun:1.4.2 AS base
WORKDIR /app

FROM base AS dev
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts
ENV NODE_ENV=development
EXPOSE 3000
CMD ["bun", "run", "dev:docker:app"]