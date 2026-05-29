# JimiCanvas 部署说明

## 阶段 1：先 HTTP 跑通（当前默认）

无需 SSL 证书。`jimiaiapp/nginx.conf` 已配置：`canvas.jimmyai.cn:80` 反代到 `jimiai_canvas`，并保留 `/.well-known/acme-challenge/` 供后续 Certbot 使用。

### 构建参数（注意用 http）

```bash
docker build \
  --build-arg VITE_API_URL=http://canvas.jimmyai.cn \
  --build-arg VITE_WEB_APP_URL=http://www.jimmyai.cn \
  -t <ACR>/jimicanvas:latest .
```

`jimiaiapp` 的 `.env.production`：

```bash
VUE_APP_CANVAS_URL=http://canvas.jimmyai.cn
```

### 服务器

```bash
cd /opt/project
export CANVAS_IMAGE=<ACR>/jimicanvas:latest
docker compose -f docker-compose.prod.yml pull canvas
docker compose -f docker-compose.prod.yml up -d canvas

# 更新含新 nginx.conf 的 frontend 镜像后
docker compose -f docker-compose.prod.yml pull frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### 验证

```bash
curl -sS http://canvas.jimmyai.cn/health   # healthy
```

浏览器访问：`http://canvas.jimmyai.cn`

---

## 阶段 2：申请 SSL 后再开 HTTPS

1. 确认 `http://canvas.jimmyai.cn` 可访问  
2. Certbot（webroot）：

```bash
sudo certbot certonly --webroot \
  -w /opt/project/data/nginx/certbot \
  -d canvas.jimmyai.cn
```

3. 复制证书为 `canvas_cert.pem` / `canvas_key.pem` / `canvas_chain.pem` 到 `/opt/project/data/nginx/ssl/`  
4. 在 `jimiaiapp/nginx.conf` 取消注释 canvas 的 `443` server，并把 80 的 `location /` 改回 `return 301 https://...`  
5. 重建镜像：`VITE_API_URL=https://canvas.jimmyai.cn`，`VUE_APP_CANVAS_URL=https://canvas.jimmyai.cn`  
6. `docker compose ... restart frontend`

---

## 内网端口（可选，不用域名）

`http://内网IP:8081`，见 `docker-compose.prod.yml` 的 `CANVAS_PORT`，无需改 frontend Nginx。
