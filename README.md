# JimiCanvas · 吉米 AI 无限画布

**在无限画布上串联你的 AI 创作流程** — 自由排布图片、视频与文本节点，在同一画布内完成灵感整理、AI 生图与生视频，并自动同步到云端。

| 在线体验 | 主站 |
|----------|------|
| [canvas.jimmyai.cn](https://canvas.jimmyai.cn) | [www.jimmyai.cn](https://www.jimmyai.cn) |

---

## ✨ 产品亮点

- **无限画布工作台** — 拖拽式节点编排，灵感与产出在同一张画布上可视化串联
- **多模态 AI 节点** — 文本、图片、视频、音频节点自由连接，构建完整创作链路
- **预设工作流模版** — 文生图、图生视频、图/视频反推提示词、图生图等一键起步
- **主流模型支持** — Sora / VEO / Seedance / Grok 视频模型，GPT Image / Nano Banana 等图像模型
- **云端自动保存** — 画布项目实时同步，随时继续创作
- **与吉米 AI 主站联动** — 统一账号体系，从主站一键跳转画布；余额与会员权益互通

---

## 🔗 快速访问

| 名称 | 链接 | 说明 |
|------|------|------|
| **JimiCanvas 画布** | https://canvas.jimmyai.cn | 在线创作入口 |
| **吉米 AI 主站** | https://www.jimmyai.cn | 视频生成、充值、会员、任务中心等 |
| **开放平台** | https://open.jimmyai.cn | API 接入与开发者控制台（如有部署） |

> 建议从 [吉米 AI 主站](https://www.jimmyai.cn) 登录后进入画布，账号与余额自动同步。

---

## 📋 项目简介

JimiCanvas 是 [吉米 AI](https://www.jimmyai.cn) 生态下的 **React 无限画布前端**，面向内容创作者与 AI 工作流用户，提供节点化、可视化的 AIGC 创作体验。

### 核心能力

| 模块 | 说明 |
|------|------|
| 画布编辑 | 缩放、平移、小地图、背景样式、节点连线 |
| 图片生成 | 多模型、多比例、参考图、批量次数 |
| 视频生成 | Sora / VEO / Omni / Seedance / Grok 等线路 |
| 音频生成 | TTS 语音合成节点 |
| 工作流模版 | 常用链路预设，降低上手成本 |
| 资产管理 | 素材库选取、预览、引用到节点 |

---

## 🛠️ 技术栈

- **框架**: React 19
- **构建**: Vite 6
- **动画**: GSAP
- **图标**: Lucide React
- **部署**: Docker + Nginx

---

## 📦 项目结构

```
jimicanvas/
├── public/                 # 静态资源（含客服二维码 wechat-qrcode.png）
├── src/
│   ├── components/         # UI 组件（画布、节点、弹窗等）
│   ├── hooks/              # React Hooks
│   ├── lib/                # API、画布逻辑、常量
│   ├── pages/              # 页面（CanvasHome 等）
│   ├── styles/             # 主题与样式
│   ├── App.jsx             # 画布编辑器
│   └── main.jsx            # 入口
├── Dockerfile
├── nginx.conf
├── DEPLOY.md               # 生产部署说明
└── package.json
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与开发

```bash
npm install
npm run dev
```

开发时 API 默认指向 `http://localhost:27355`（需本地运行 jimiaigo 后端）。

### 构建

```bash
npm run build
npm run preview
```

### 环境变量

复制示例并按需修改：

```bash
cp .env.production.example .env.production
```

| 变量 | 说明 |
|------|------|
| `VITE_API_URL` | 后端 API 地址（生产如 `https://canvas.jimmyai.cn`） |
| `VITE_WEB_APP_URL` | 吉米 AI 主站地址（如 `https://www.jimmyai.cn`），用于跳转登录与个人中心 |

---

## 🐳 Docker 部署

生产构建示例：

```bash
docker build \
  --build-arg VITE_API_URL=https://canvas.jimmyai.cn \
  --build-arg VITE_WEB_APP_URL=https://www.jimmyai.cn \
  -t jimicanvas:latest .
```

完整 SSL、Nginx 与 Compose 部署步骤见 [DEPLOY.md](./DEPLOY.md)。

---

## 🔗 与 jimiaiapp 联动

- 主站 `jimiaiapp` 通过 `VUE_APP_CANVAS_URL` 跳转至画布（默认 `https://canvas.jimmyai.cn`）
- 画布通过 `VITE_WEB_APP_URL` 回跳主站登录与充值
- 同域或跨域跳转时支持 Token 同步，打开指定画布或新建画布

---

## 📄 许可证

本项目为吉米 AI 内部/商业项目，未经授权请勿用于二次分发。

---

<p align="center">
  <a href="https://www.jimmyai.cn"><strong>吉米 AI 主站</strong></a>
  ·
  <a href="https://canvas.jimmyai.cn"><strong>立即体验 JimiCanvas</strong></a>
</p>
