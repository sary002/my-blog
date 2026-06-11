# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal blog site (Chinese language UI) with an integrated AI chat assistant.

- **Frontend** ([src/](src/)) — React 19 + TypeScript + Vite, routed via React Router 7
- **Backend** ([backend/](backend/)) — Node.js + Express 5, proxies chat requests to the MiniMax-M3 LLM API
- **AI Provider** — MiniMax (`https://api.minimax.chat/v1/chat/completions`, model `MiniMax-M3`); the API key is stored in [backend/.env](backend/.env) as `MINIMAX_API_KEY`

The backend is deployed at `https://tangsanyi-blog.onrender.com`; the frontend `AIChat` page calls this deployed URL directly (no Vite proxy in front), so the dev server's `/api` proxy is only relevant if you wire a local backend to the frontend.

## Common Commands

Frontend (run from repo root):

```bash
npm run dev          # Vite dev server (HMR)
npm run build        # tsc -b && vite build → dist/
npm run lint         # eslint over the whole repo
npm run preview      # serve the production build
```

Backend (run from [backend/](backend/) or via root scripts):

```bash
npm run backend         # node server.js
npm run backend:dev     # node --watch server.js
```

There is no test suite yet — the project has no `test` script. No single-test command.

## Architecture

### Frontend routing ([src/App.tsx](src/App.tsx))

Two routes, both inside a `BrowserRouter`:
- `/` → `Home` page → composes `Hero`, `Projects`, `Articles`, `Contact` sections
- `/ai` → `AIChat` page (chat UI; the `<Footer />` is hidden on this route)

`Navbar` ([src/components/Navbar.tsx](src/components/Navbar.tsx)) is route-aware: on `/` it shows in-page anchor links (`#hero`, `#projects`, …) plus an "AI 助手" link; on other routes it collapses to a "首页" link. It tracks `scrollY > 10` to toggle the `navbar--scrolled` style, and locks body scroll while the mobile menu is open.

`key={pathname}` on `<Navbar />` forces a remount on route change so the scroll listener re-binds to the right window — keep this when refactoring.

### Static content ([src/data/content.ts](src/data/content.ts))

All project cards, article summaries, and contact links are hard-coded here as typed TS arrays. There is no CMS or fetch. Update this file to change homepage content.

### AI chat flow

- [src/pages/AIChat.tsx](src/pages/AIChat.tsx) — local `useState<Message[]>` history, no persistence. Sends `{ message: string }` to `POST /chat`.
- [backend/server.js](backend/server.js) — Express app. `POST /chat` forwards the message to MiniMax's chat-completions endpoint with `model: 'MiniMax-M3'`, returns `{ answer: string }`. Health check at `GET /`.
- CORS is wide open (`*`) in [backend/server.js:10-17](backend/server.js#L10-L17); tighten before exposing the API beyond the deployed frontend.

### Vite proxy quirk

[vite.config.ts](vite.config.ts) proxies `/api` to `http://localhost:3001`, but the backend's default `PORT` is `3000` (see [backend/server.js:5](backend/server.js#L5)). If you want the proxy to hit a local backend, either change the proxy target or set `PORT=3001` in [backend/.env](backend/.env). The frontend `AIChat` does **not** use the proxy — it calls the Render URL directly.

## Conventions

- **CSS**: BEM-style class names (block, `__element`, `--modifier`) defined in a single global stylesheet ([src/index.css](src/index.css)). No CSS-in-JS, no Tailwind, no module CSS. Inline SVGs are inlined per-component.
- **Component style**: default exports, functional components, hooks only. `tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly` — type-only imports must use `import type`.
- **Routing patterns**: in-page anchors for homepage sections; `<Link>` from `react-router-dom` for cross-page navigation. `ProjectCard` ([src/components/Projects.tsx:4-43](src/components/Projects.tsx#L4-L43)) picks `<Link>` vs `<a>` based on whether the link starts with `/`.
- **Static data → component**: components import typed arrays from [src/data/content.ts](src/data/content.ts) rather than receiving props — fine for this scale, but couples components to the data file.
- **No backend env file in VCS**: `.env` is gitignored, but a populated copy currently exists locally. [backend/.env.example](backend/.env.example) documents the `MINIMAX_API_KEY` variable name.

## Where to Start

- Add or change homepage content → [src/data/content.ts](src/data/content.ts)
- Tweak chat UX (loading states, streaming, history) → [src/pages/AIChat.tsx](src/pages/AIChat.tsx) and [backend/server.js](backend/server.js) `/chat` handler
- Add a new section to the homepage → new component in [src/components/](src/components/), composed in [src/pages/Home.tsx](src/pages/Home.tsx)
- Adjust global styles or design tokens → [src/index.css](src/index.css) (look for CSS variables at the top)
