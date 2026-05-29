# JimiCanvas 部署说明

生产地址：`https://canvas.jimmyai.cn`

## 架构

```
用户 → canvas.jimmyai.cn:443 (jimiai_frontend Nginx, SSL)
     → jimiai_canvas (静态 + /api/ 反代)
     → jimiai_backend:27355
```

## 1. SSL 证书（服务器，首次）

```bash
mkdir -p /opt/project/data/nginx/ssl /opt/project/data/nginx/certbot
cd /opt/project
docker compose -f docker-compose.prod.yml up -d frontend

sudo certbot certonly --webroot \
  -w /opt/project/data/nginx/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d canvas.jimmyai.cn

sudo cp /etc/letsencrypt/live/canvas.jimmyai.cn/fullchain.pem /opt/project/data/nginx/ssl/canvas_cert.pem
sudo cp /etc/letsencrypt/live/canvas.jimmyai.cn/privkey.pem /opt/project/data/nginx/ssl/canvas_key.pem
sudo cp /etc/letsencrypt/live/canvas.jimmyai.cn/chain.pem /opt/project/data/nginx/ssl/canvas_chain.pem
sudo chmod 644 /opt/project/data/nginx/ssl/canvas_cert.pem /opt/project/data/nginx/ssl/canvas_chain.pem
sudo chmod 600 /opt/project/data/nginx/ssl/canvas_key.pem
```

## 2. 部署服务

构建参数（HTTPS）：

```bash
docker build \
  --build-arg VITE_API_URL=https://canvas.jimmyai.cn \
  --build-arg VITE_WEB_APP_URL=https://www.jimmyai.cn \
  -t <ACR>/jimicanvas:latest .
```

`jimiaiapp` `.env.production`：

```bash
VUE_APP_CANVAS_URL=https://canvas.jimmyai.cn
```

服务器：

```bash
cd /opt/project
export CANVAS_IMAGE=<ACR>/jimicanvas:latest
export FRONTEND_IMAGE=<ACR>/jimiapp:latest-cn
docker compose -f docker-compose.prod.yml pull canvas frontend
docker compose -f docker-compose.prod.yml up -d canvas frontend
```

## 3. 验证

```bash
curl -sS https://canvas.jimmyai.cn/health   # healthy
curl -I http://canvas.jimmyai.cn            # 301 → https
```

## 4. 证书续期

```bash
sudo certbot renew --deploy-hook 'cp /etc/letsencrypt/live/canvas.jimmyai.cn/fullchain.pem /opt/project/data/nginx/ssl/canvas_cert.pem && cp /etc/letsencrypt/live/canvas.jimmyai.cn/privkey.pem /opt/project/data/nginx/ssl/canvas_key.pem && cp /etc/letsencrypt/live/canvas.jimmyai.cn/chain.pem /opt/project/data/nginx/ssl/canvas_chain.pem && docker compose -f /opt/project/docker-compose.prod.yml restart frontend'
```
