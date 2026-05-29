# 多阶段构建 Dockerfile for React (Vite) 前端项目
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 生产环境 API / 主站地址（构建时注入，可按部署域名覆盖）
ARG VITE_API_URL=https://canvas.jimmyai.cn
ARG VITE_WEB_APP_URL=https://www.jimmyai.cn
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WEB_APP_URL=$VITE_WEB_APP_URL

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
