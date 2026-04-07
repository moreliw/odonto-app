FROM node:20-bullseye-slim AS builder
WORKDIR /app
# Copy backend package manifests
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install
# Copy backend configs and sources
COPY tsconfig.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate
RUN npm run build

FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
