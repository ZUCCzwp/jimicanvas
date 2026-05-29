# JimiCanvas 部署说明

生产域名：`https://canvas.jimmyai.cn`（与 `jimiaiapp` 的 `VUE_APP_CANVAS_URL` 一致）

## 架构

```
用户 → canvas.jimmyai.cn (jimiai_frontend Nginx, 443)
     → jimiai_canvas 容器 (静态 + /api/ 反代)
     → jimiai_backend:27355
```

## 1. 推送代码触发 CI（推荐）

在 `jimicanvas` 仓库配置与 `jimiaiweb` 相同的 GitHub Secrets：

- `ACR_REGISTRY` / `ACR_NAMESPACE` / `ACR_USERNAME` / `ACR_PASSWORD`
- `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_PORT`

推送 `main` 分支后，Actions 会构建镜像 `jimicanvas` 并在服务器执行：

```bash
docker compose -f docker-compose.prod.yml pull canvas
docker compose -f docker-compose.prod.yml up -d canvas
```

## 2. 服务器一次性准备

在 `/opt/project`（与现有 jimiai 部署同目录）：

### 2.1 更新 compose

将 `jimiaigo` 仓库中的 `docker-compose.prod.yml`（含 `canvas` 服务）同步到服务器。

### 2.2 DNS

添加 A 记录：`canvas.jimmyai.cn` → 服务器公网 IP。

### 2.3 SSL 证书

参考主站 `app.jimmyai.cn` 做法，为 canvas 子域申请证书并放到：

```
/opt/project/data/nginx/ssl/canvas_cert.pem
/opt/project/data/nginx/ssl/canvas_key.pem
/opt/project/data/nginx/ssl/canvas_chain.pem
```

示例（Certbot webroot，需先保证 80 可访问 `/.well-known`）：

```bash
certbot certonly --webroot -w /opt/project/data/nginx/certbot \
  -d canvas.jimmyai.cn
# 再复制 fullchain.pem / privkey.pem 为上述文件名
```

### 2.4 更新主站 Nginx

将 `jimiaiapp/nginx.conf`（含 `canvas.jimmyai.cn` 反代块）部署后，**重新构建并拉起 frontend**：

```bash
export FRONTEND_IMAGE=<你的ACR>/jimiapp:latest-cn
docker compose -f docker-compose.prod.yml pull frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

## 3. 手动部署（无 CI 时）

在能访问服务器的机器上：

```bash
# 构建并推送到 ACR（替换 registry/namespace）
docker build -t <ACR>/jimicanvas:latest \
  --build-arg VITE_API_URL=https://canvas.jimmyai.cn \
  --build-arg VITE_WEB_APP_URL=https://www.jimmyai.cn \
  .
docker push <ACR>/jimicanvas:latest

# SSH 到服务器
ssh user@your-server
cd /opt/project
export CANVAS_IMAGE=<ACR>/jimicanvas:latest
docker compose -f docker-compose.prod.yml pull canvas
docker compose -f docker-compose.prod.yml up -d canvas
```

## 4. 验证

```bash
curl -sS https://canvas.jimmyai.cn/health
# 期望: healthy

docker ps | grep jimiai_canvas
docker logs jimiai_canvas --tail 50
```

浏览器打开 `https://canvas.jimmyai.cn`，从主站登录后进入画布应能正常调用 `/api/`。
