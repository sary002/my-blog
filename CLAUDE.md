# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

一个中文个人博客站点，内置两个 AI 功能：

- **自由对话**（`/ai`）— 类似 ChatGPT 的多轮聊天
- **AI 职业翻译官**（`/ai-translator`）— 用读者熟悉的职业语言解释 AI 概念

技术骨架：

- **前端**（[src/](src/)）— React 19 + TypeScript + Vite 8，React Router 7，mermaid 11 用于客户端图表渲染
- **后端**（[backend/](backend/)）— Node.js + Express 5，转发 LLM 请求到 MiniMax，同时支持 JSON 与 Server-Sent Events（SSE）流式
- **AI Provider** — MiniMax（`https://api.minimax.chat/v1/chat/completions`，模型 `MiniMax-M3`）；API key 存在 [backend/.env](backend/.env) 的 `MINIMAX_API_KEY` 中

后端部署在 `https://tangsanyi-blog.onrender.com`；前端两个 AI 页面默认调用该部署 URL。Vite dev server 自带的 `/api` 代理仅在把本地后端挂到前端时才需要（见"部署方式"）。

## 1. 项目架构

### 1.1 路由（[src/App.tsx](src/App.tsx)）

`BrowserRouter` 内三条路由：

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | `Home` | 拼装 `Hero` / `Projects` / `Articles` / `Contact` 四个区块 |
| `/ai` | `AIChat` | 自由聊天；`<Footer />` 在此路由隐藏 |
| `/ai-translator` | `AITranslator` | 职业翻译官；`<Footer />` 正常显示 |

`Navbar`（[src/components/Navbar.tsx](src/components/Navbar.tsx)）按路径自适应：

- 在 `/`：展示锚点链接（`#hero` / `#projects` / `#articles` / `#contact`）+ "AI 助手" + "AI 翻译官"
- 在其他路径：折叠为单个 "首页" 链接，但仍保留两个 AI 入口
- 监听 `scrollY > 10` 切换 `navbar--scrolled` 样式（首页顶部不滚动时是透明，滚到底/跳到其他页时是实色）
- 移动端菜单展开时锁定 body 滚动
- `<Navbar key={pathname} />` 强制路由切换时重挂载，让滚动监听重新绑定到当前 window —— **重构时保留 `key`**

### 1.2 API base 解析（[src/lib/apiBase.ts](src/lib/apiBase.ts)）

`API_BASE` 在**运行时**（非构建时）解析，优先级：

1. `VITE_API_BASE_URL` 环境变量 —— 显式覆盖（用于 staging）
2. 当 `window.location.hostname` 是 loopback（`localhost` / `127.0.0.1` / `0.0.0.0` / `::1`）时，假定后端在同主机 `:3001`
3. 兜底为生产 Render URL

好处：同一份 Vite 产物在 dev 与 production 都可用，免 `.env.local`。

### 1.3 AIChat 数据流

- 状态：本地 `useState<Message[]>`，**持久化到 `localStorage`**，key 为 `my-blog-chat-history`
- 发送：`POST /chat`（默认 mode），body `{ message, history }`，每次启动把最近 20 条作为 history 发回（`HISTORY_TURNS = 20`）
- 响应：JSON `{ answer }`。HTTP 错误以"假装的助手消息"形式内联展示（无独立 toast）
- 取消：每次 send 自带 `AbortController`；新请求和组件卸载都会取消上一次

### 1.4 AITranslator 数据流

两步 UX：

1. `GET /professions` 拿职业下拉列表
2. `POST /chat` 带 `{ mode: 'translator', profession, concept, stream: true }`，后端以 SSE 流式返回 6 段 markdown 答案

6 段按 `## ` 头切分：一句话理解 / 职业映射 / ASCII图解 / Mermaid图 / 真实案例 / 学习建议。Mermaid 段在客户端剥离代码块围栏后渲染。

后端关键文件：

- [backend/professions.js](backend/professions.js) — 职业目录（id / label / context / analogySeeds）。`context` + `analogySeeds` 服务端自用，`GET /professions` 之前已 strip
- [backend/concept-meta.js](backend/concept-meta.js) — 概念元数据查找器（英文全称 + 音标），大小写不敏感。命中失败返回 `null`，UI 静默省略元数据块

### 1.5 静态内容（[src/data/content.ts](src/data/content.ts)）

首页的项目卡、文章摘要、联系方式全部是带类型的 TS 字面量数组。无 CMS，无 fetch。改首页内容就改这一个文件。

## 2. 技术栈

### 2.1 前端

| 依赖 | 版本 | 用途 |
|---|---|---|
| React | ^19.2.6 | UI 框架 |
| React DOM | ^19.2.6 | DOM 渲染 |
| React Router DOM | ^7.17.0 | 路由 |
| TypeScript | ~6.0.2 | 类型系统；`noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax` / `erasableSyntaxOnly` 全开 |
| Vite | ^8.0.12 | dev server / build |
| mermaid | ^11.15.0 | AI 翻译官的 Mermaid 图表客户端渲染 |

- 用 `import type` 写纯类型导入
- 用 `crypto.randomUUID()` 给消息生成 id
- 聊天历史持久化在 `localStorage`（无 IndexedDB、无 Service Worker）

### 2.2 后端

| 依赖 | 版本 | 用途 |
|---|---|---|
| express | ^5.1.0 | HTTP 框架（ESM） |
| dotenv | ^17.4.2 | 读 `.env` |

- 纯 `.js`（无 TS），ESM（`"type": "module"`）
- `express.json({ limit: '8kb' })` 防止 payload DoS
- 进程内限流（in-memory `Map`），**仅适用单实例** —— 多实例要换共享存储
- 无 DB、无 ORM、无 auth

### 2.3 Lint / Type-check

- ESLint 10（flat config）：`@eslint/js` + `typescript-eslint` + `react-hooks` + `react-refresh`
- `tsc -b` 嵌在 `npm run build` 里

### 2.4 常用命令

前端（仓库根）：

```bash
npm run dev          # Vite dev server (HMR) :5173
npm run build        # tsc -b && vite build → dist/
npm run lint         # eslint .
npm run preview      # 预览生产构建
npm run backend      # 启后端（生产模式）
npm run backend:dev  # 启后端（node --watch）
```

后端（在 [backend/](backend/) 或用根脚本）：

```bash
npm start            # node server.js
npm run dev          # node --watch server.js
```

无测试套件 —— 项目无 `test` 脚本。

## 3. 数据库设计

**没有数据库**。状态只有两处：

| 位置 | 内容 | 生命周期 | 代码位置 |
|---|---|---|---|
| 浏览器 `localStorage` | AIChat 消息历史 | 直到用户点"清空对话"或被 `localStorage.removeItem` 清除 | [src/pages/AIChat.tsx:10](src/pages/AIChat.tsx#L10)（`STORAGE_KEY = 'my-blog-chat-history'`） |
| 后端进程内存 | 限流 IP→时间戳列表 | 进程生命周期，重启即清零 | [backend/server.js:60-76](backend/server.js#L60-L76) |

含义：

- 聊天历史是 per-browser 的，清理站点数据会一起清掉
- 限流是 per-process 的；扩到多实例必须把 `Map` 换成共享存储（Redis / Upstash）
- `hits` map 在持续流量下不设上限，但 `rateLimit` 中间件在每次请求时剔掉过期项，稳态上限 = `RATE_LIMIT_MAX × (RATE_LIMIT_WINDOW_MS / 1000)` per 活跃 IP

## 4. API 接口

所有端点都在后端（[backend/server.js](backend/server.js)），前端通过 `API_BASE`（[src/lib/apiBase.ts](src/lib/apiBase.ts)）调用。共同约束：

- `POST /chat` 受 30 req / 60s per IP 的限流（[backend/server.js:60-76](backend/server.js#L60-L76)）；`GET` 端点不限流
- 请求体上限 8kb（`express.json({ limit: '8kb' })`）
- CORS：白名单模式（不是 `*`），见"部署方式"

### 4.1 `GET /` — 健康检查

```json
{ "status": "ok", "message": "my-blog backend is running", "timestamp": "..." }
```

### 4.2 `GET /professions` — 职业目录（翻译官用）

服务端是唯一数据源（[backend/professions.js](backend/professions.js)），`context` / `analogySeeds` 在返回前 strip 掉。

```json
{ "professions": [{ "id": "backend-dev", "label": "后端开发" }, ...] }
```

### 4.3 `POST /chat` — 多模式端点

按 `mode` 字段分两种模式。

#### 模式 1：默认（自由聊天，AIChat 页面用）

请求：

```json
{
  "message": "...",
  "history": [{ "role": "user|assistant", "content": "..." }, ...]
}
```

响应（HTTP 200）：`{ "answer": "..." }`

- `history` 可选；最多 20 条；role 限定 `user` / `assistant`（**不允许 `system`**，防止前端注入）
- `message` 上限 4000 字符

#### 模式 2：`mode: "translator"`（AITranslator 页面用）

请求：

```json
{ "mode": "translator", "profession": "backend-dev", "concept": "MCP", "stream": true }
```

- `profession` 必须是已知 id（后端校验；未命中返回 400 并附 `available: [...]`）
- `concept` 上限 4000 字符
- `stream`：可选。`true` 返回 SSE，省略/false 返回 JSON

**非流式响应**（HTTP 200）：

```json
{
  "answer": "...",
  "meta": { "name": "MCP", "english": "Model Context Protocol", "phonetic": "/ˌɛm ˌsiː ˈpiː/" }
}
```

`meta` 在概念未命中查找表时为 `null`，客户端静默省略元数据块。

**流式响应**（`Content-Type: text/event-stream; charset=utf-8`）：

```
data: {"meta":{...}}\n\n         # 前导事件，仅在 meta 命中时发
data: {"content":"..."}\n\n      # 每个 upstream delta 一个事件
data: {"content":"..."}\n\n
data: [DONE]\n\n                # 结束标记
```

上游出错时流以 `data: {"error":"upstream_..."}\n\n` + `[DONE]` 收尾。

### 4.4 错误码

| 码 | 含义 | body |
|---|---|---|
| 400 | 输入不合法（缺字段、profession 未命中、history 形态错） | `{ "error": "..." }` |
| 429 | 限流 | `{ "error": "rate_limited", "retryAfter": N }` |
| 500 | 后端配置错（缺 API key） | `{ "error": "Server configuration error" }` |
| 502 | upstream 非 2xx | `{ "error": "upstream_error" }` |
| 504 | upstream 超时（`UPSTREAM_TIMEOUT_MS`，默认 60s） | `{ "error": "upstream_timeout" }` |

## 5. 部署方式

### 5.1 前端

- 构建：`npm run build` → 静态文件落在 `dist/`
- 托管：任意静态站点（Render static site / Vercel / Netlify / 自建 nginx 均可）
- 当前生产前端域名：`https://tangsanyi-blog.onrender.com`

### 5.2 后端

- 部署地址：`https://tangsanyi-blog.onrender.com`（与前端同源；同源不带 cookie 也无所谓，**这里没用到 cookie**）
- 单 Node 进程，进程内状态。重启丢失限流计数（可接受，见"数据库设计"）
- 必需 / 可选环境变量：

  | 变量 | 必需 | 默认 | 含义 |
  |---|---|---|---|
  | `MINIMAX_API_KEY` | ✅ | —— | 不可为占位符 `your-key-here`，否则启动后所有 chat 走 500 |
  | `ALLOWED_ORIGINS` | ❌ | `http://localhost:5173,https://tangsanyi-blog.onrender.com` | 逗号分隔 CORS 白名单 |
  | `PORT` | ❌ | `3001` | 监听端口 |
  | `UPSTREAM_TIMEOUT_MS` | ❌ | `60000` | upstream fetch 超时（覆盖默认 60s） |

- CORS 行为：仅对白名单中的 `Origin` 回写 `Access-Control-Allow-Origin` + `Vary: Origin`；不在白名单的 origin 拿不到 CORS 头；无 `Origin` 头的请求（curl、server-to-server）也不带 CORS 头。**不是 `*`**

### 5.3 本地开发

- 后端：`npm run backend:dev`（或 `cd backend && npm run dev`）→ `http://localhost:3001`
- 前端：`npm run dev` → `http://localhost:5173`
- `src/lib/apiBase.ts` 检测到 loopback 主机自动指向 `http://localhost:3001`，**不需要 `.env.local`**
- Vite dev server 自带的 `/api` 代理（[vite.config.ts](vite.config.ts)）**当前没被前端代码使用**——`AIChat` / `AITranslator` 都直接打 `${API_BASE}/chat`。代理是逃生口，保留以备切换

### 5.4 上线流程

- 仓库内无 CI/CD 配置文件。推 `main` 触发 Render 自动部署，配置在 Render 控制台（不在本仓库）
- `.env` 已在 `.gitignore`；线上环境变量必须在 Render 控制台（或对应托管平台）里维护，绝不能通过修改已追踪文件来改
- 修改生产配置时建议顺序：本地验证 → 提 PR → 合并到 `main` → Render 自动部署 → 在 Render 控制台改 env（如有需要）

## 6. 开发规范

- **CSS**：BEM 风格（block / `__element` / `--modifier`），全部放在 [src/index.css](src/index.css) 一张全局表里。无 CSS-in-JS、无 Tailwind、无 module CSS。SVG 内联在组件里
- **组件**：默认导出、函数组件、hooks only。`tsconfig.app.json` 开了 `noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax` / `erasableSyntaxOnly` —— 纯类型导入必须用 `import type`
- **路由写法**：首页区块用锚点；跨页导航用 `<Link>`。`ProjectCard`（[src/components/Projects.tsx:4-43](src/components/Projects.tsx#L4-L43)）按链接是否以 `/` 开头选 `<Link>` 或 `<a>`
- **静态数据 → 组件**：组件直接 `import` [src/data/content.ts](src/data/content.ts) 的类型化数组，不通过 props 传。当前的规模下可以，但组件被耦合到了数据文件
- **环境变量卫生**：`.env` 已在 `.gitignore`；**绝不能把真 key 提交进任何被追踪的文件**。[backend/.env.example](backend/.env.example) 是文档化的契约，里面写的 `your-key-here` 是占位符。当前本地有一份已填好的 `.env`（未追踪）；如果它曾经出现在已追踪文件里，**必须去 MiniMax 控制台 rotate**
- **Mermaid 安全**：Mermaid 用 `securityLevel: 'strict'` 初始化（[src/pages/AITranslator.tsx:11](src/pages/AITranslator.tsx#L11)）。图表源是模型输出，不可信，**不要降低安全等级**
- **Mermaid 初始化只调一次**：`mermaid.initialize({...})` 必须在模块顶层（[src/pages/AITranslator.tsx:8-14](src/pages/AITranslator.tsx#L8-L14)）。不要挪到组件函数体或 hook 里
- **SSE 协议**：wire 格式见 §4.3 模式 2。前导 `data: {meta}` 可选；`data: {content}` 是 delta；`data: [DONE]` 是终止。客户端解析器对残缺 chunk 静默跳过，**服务端写新事件时也要匹配**。`safeWrite` 在写之前查 `res.writableEnded || res.destroyed`，避开 Express 5 / Node 20+ 的 `req.on('close')` 提前触发 bug
- **反 prompt 注入**：客户端发的 `history` 限定 `user` / `assistant`（[backend/server.js:83-106](backend/server.js#L83-L106)）；翻译官的系统提示由服务端从受信任目录构造，**客户端永远看不到也不能改**。**不要放宽这两条**
- **AbortController 归属**：每个 in-flight fetch 持一个 `AbortController`；新请求和 unmount 时取消上一个。AIChat / AITranslator 都按这个模式写
- **职业目录契约**：`FALLBACK_PROFESSIONS`（[src/pages/AITranslator.tsx:26-34](src/pages/AITranslator.tsx#L26-L34)）是 [backend/professions.js](backend/professions.js) 的镜像契约。**新增职业时两边都要改**
- **概念元数据**：[backend/concept-meta.js](backend/concept-meta.js) 是简单的大小写不敏感查找表；`phonetic` 是粗略提示，不是严格 IPA。命中失败返回 `null`，UI 静默省略

## Where to Start

- 改 / 增首页内容 → [src/data/content.ts](src/data/content.ts)
- 调聊天 UX（loading、history、错误态）→ [src/pages/AIChat.tsx](src/pages/AIChat.tsx) + [backend/server.js](backend/server.js) `/chat` 默认模式
- 增 / 改职业 → [backend/professions.js](backend/professions.js) + 同步 `FALLBACK_PROFESSIONS`（[src/pages/AITranslator.tsx:26-34](src/pages/AITranslator.tsx#L26-L34)）
- 增 / 改概念的英文全称 / 音标 → [backend/concept-meta.js](backend/concept-meta.js)
- 调翻译官 UX（段切分、Mermaid、错误提示）→ [src/pages/AITranslator.tsx](src/pages/AITranslator.tsx) + [backend/server.js](backend/server.js) `/chat` translator 模式
- 加首页新区块 → [src/components/](src/components/) 新组件，[src/pages/Home.tsx](src/pages/Home.tsx) 拼装
- 加顶层页面 → [src/pages/](src/pages/) 新页面，[src/App.tsx](src/App.tsx) `<Routes>` 注册，[src/components/Navbar.tsx](src/components/Navbar.tsx) 加 Navbar 链接
- 改全局样式 / 设计 token → [src/index.css](src/index.css) 顶部 CSS 变量
