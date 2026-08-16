# ==================== 基础镜像 ====================
FROM node:22-alpine AS base

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

WORKDIR /app

# ==================== 依赖安装阶段 ====================
FROM base AS deps

# CI 环境标识，避免 pnpm 交互式确认
ENV CI=true

COPY package.json ./
COPY . .

RUN pnpm install


# ==================== 构建阶段 ====================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .



# 设置环境变量
ENV NODE_ENV=production


RUN pnpm build

# ==================== 运行阶段 ====================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

# 暴露端口
EXPOSE 4000

ENV PORT=4000

# 启动命令
CMD ["node", "dist/src/main.js"]