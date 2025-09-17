FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN npm i -g pnpm@9 && pnpm install --frozen-lockfile || true
COPY . .
RUN pnpm build || true
EXPOSE 8088
CMD ["pnpm","dev"]