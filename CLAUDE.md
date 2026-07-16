# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QIK Anime — full-stack anime streaming/tracking app. React SPA frontend (`anime-site/`) + NestJS backend (`server/`) + React Native mobile app (`mobile/`). Anime catalog data comes from the external YummyAnime API (https://yani.tv); the backend only adds social/gamification layers (users, bookmarks, ratings, comments, progress, friends, notifications, watch rooms).

Two API clients on the frontend: `api/client.js` → YummyAnime (catalog), `api/backend.js` → NestJS (user data). A single anime page merges both. See `ARCHITECTURE.md` for the data-flow diagrams.

## Commands

```bash
# Frontend (from repo root)
cd anime-site && npm run dev      # Vite dev server on :5173 (proxies /api → :3001)
cd anime-site && npm run build    # Production build → anime-site/dist
cd anime-site && npm run preview  # Preview production build locally
cd anime-site && npm run sitemap  # Regenerate sitemap (scripts/generate-sitemap.mjs)

# Backend (from repo root)
cd server && npm run dev          # nest start --watch on :3001
cd server && npm run build        # TypeScript compile → server/dist
cd server && npm run start:prod   # node dist/main.js (what PM2 runs in prod)

# Mobile (from repo root)
cd mobile && npm start            # Expo dev server
cd mobile && npm run android      # Launch on connected Android device/emulator
cd mobile && npm run ios          # Launch on iOS simulator (macOS only)
cd mobile && npm run web          # Launch in browser
cd mobile && npm run lint         # Expo lint
```

There is **no test runner, linter, or formatter configured** in either `package.json`. Don't claim to "run tests" — there are none.

Dev env: `server/.env` (see `server/.env.example`) and `anime-site/.env` (see `anime-site/.env.example`). Both run with sensible defaults if env vars are missing. Vite proxies `/api` to `localhost:3001`, so frontend uses `/api` paths in dev (and in prod behind nginx).

## Environment variables (non-obvious behaviours)

- `APP_ROOT` (server) — base directory for resolving relative `DB_PATH`/`UPLOAD_DIR`. Defaults to the server project root and rarely needs changing.
- `ADMIN_SECRET` (server) — visit `/admin`, enter this code, and your account becomes admin. This is the **only** way to bootstrap the first admin account.
- `DEEPSEEK_TOKEN` (server) — required for the emoji quiz feature. Read directly from `.env` at runtime (bypasses NestJS ConfigService), so `pm2 reload` is enough to pick up changes without a full restart.
- `VITE_YUMMY_PRIVATE_TOKEN` (frontend) — takes priority over `VITE_YUMMY_APP_TOKEN` for higher rate limits on the YummyAnime API.
- `CORS_ORIGINS` (server) — comma-separated; when empty in production, only `quickik.ru` domains are allowed.

## Architecture essentials (read multiple files to grasp)

**Frontend** (`anime-site/src/`): React 18 + Vite + React Router + plain CSS. Pages in `pages/`, reusable UI in `components/`. Global state via Context only (`AuthContext`, `ThemeContext`) — no Redux. Fetch via the `useApi` hook, never raw `fetch` in components. All styles in one file `styles/index.css` (~2850 lines) using CSS variables + `[data-theme='light']`. Icons are inline SVGs in `components/icons.jsx`. Modals/toasts render via `ReactDOM.createPortal`. JWT stored in `localStorage` key `qik_token`; cached user object in `qik_user`. HLS.js plays `.m3u8` AniLibria streams. `motion` (Framer Motion) for animations, `react-helmet-async` for `<title>`/meta tags.

**Backend** (`server/src/`): NestJS 10 + TypeORM + sql.js (SQLite in WASM) + Passport JWT + Socket.IO. Modular — each domain is a folder containing `<name>.module.ts`, `.controller.ts`, `.service.ts`, `.entity.ts`, `dto.ts`. Module list in `ARCHITECTURE.md`. App composition in `app.module.ts`, bootstrap in `main.ts`. Guards: `JwtAuthGuard` (strict), `OptionalJwtAuthGuard` (guests allowed), `AdminGuard`, `MasterOrAdminGuard`. Use `@CurrentUser()` decorator. File paths via `common/runtime-paths.ts` (`DB_PATH`, `UPLOAD_DIR_ABSOLUTE`) — never hardcode. `SERVER.md`/READMEs in `server/docs/` may have extra detail.

**Database**: SQLite at `server/data/qik-anime.db`. TypeORM runs with **`synchronize: true`** — schema is generated from entity classes on startup, no migrations. Adding columns is safe; deleting/renaming requires manually deleting the DB file in dev. XP/levels/achievements are computed from activity at request time, never stored.

**Watch rooms**: Socket.IO namespace `/watch-rooms`, JWT-authenticated. Host play/pause → `PATCH /api/watch-rooms/:id/state` → WS broadcast `room:state` → viewers apply. HTTP polling `GET .../sync` is the fallback. State versioning (`stateVersion`, `membersVersion`, `lastMessageId`) detects desync.

**Mobile** (`mobile/src/`): React Native 0.86 + Expo 57 + Expo Router (file-based routing). Screens in `app/`, reusable UI in `components/`. Theming via `useTheme` hook returning light/dark `Colors`. No global state management yet — each screen is a self-contained page. Icons from `lucide-react-native`. Animations via `react-native-reanimated`. The custom tab bar lives in `components/app-tabs.tsx`, backed by the `ExpandableTabs` UI component. Path aliases: `@/` → `src/`, `@/assets/*` → `assets/*`. Explicitly typed routes via `experiments.typedRoutes`. React Compiler enabled.

## Critical constraints

- **No native dependencies.** Everything must build/run without Visual Studio Build Tools. Hence `sql.js` (not `better-sqlite3`), `bcryptjs` (not `bcrypt`), `socket.io` (pure JS). Don't add packages that need native compilation.
- **Mobile is Expo SDK 57.** Always check exact-version docs at https://docs.expo.dev/versions/v57.0.0/ before writing mobile code — APIs change between SDK versions.
- **Mobile is Android-first.** The app targets Android; iOS/web exist but are secondary. All mobile code must work on Android at minimum.
- **SQLite via sql.js has limited transaction support** — avoid multi-statement atomicity; use the "write then clean up on error" pattern (see `CommentsService.toggleLike`).
- **`static.yani.tv` is blocked in RF** — the frontend `fixUrl()` swaps poster hosts to `imgproxy.yani.tv`. Don't bypass this.
- Entity changes that aren't backward-compatible will corrupt/require deleting the prod DB — be deliberate.

## Roles

- **User** — base account (bookmarks, ratings, comments, friends)
- **Master** — moderate comments (edit/delete any), access watch rooms
- **Admin** — everything master has + admin panel, site stats, appoint masters

## Deployment (pushing to `main` triggers CI)

Push to `main` → `.github/workflows/deploy.yml` builds both, rsyncs to `/root/qik-anime/` (excluding `server/data/` and `server/uploads/`), copies frontend `dist/*` → `/var/www/quickik.ru/` (nginx), runs `npm ci --omit=dev` on server, and `pm2 reload anime-api`. `.env` files, the DB, and `uploads/` are **never** deployed — they live only on the server.

Full deployment, env-var, server-layout, and "what broke & how to fix it" notes are in `AGENTS.md` (the `## ⚠️ DEPLOYMENT` section). Read that before touching deploy or debugging prod.

## Conventions

Detailed rules in `RULES.md`; project state (contexts, page-local state, gamification formulas) in `STATE.md`. Summary:

- Commits in Russian, format `<глагол> <что сделано>` (e.g. «добавил комнаты», «fixed rooms»). Default branch `main`.
- Frontend: components PascalCase, utils/hooks camelCase; no CSS modules; no icon libraries.
- Backend: one domain per module; validate via `class-validator` DTOs; throw NestJS built-in exceptions (`NotFoundException`, etc.); don't use raw SQL.
- Never commit `.env`, `node_modules/`, `dist/`, `data/qik-anime.db`, `uploads/`.

## Working docs (read these for depth, not duplicated here)

- `AGENTS.md` — deploy runbook, env vars, prod troubleshooting, server structure, library/skill guidance.
- `ARCHITECTURE.md` — system diagram, data flows, DB schema, module boundaries.
- `RULES.md` — code rules (frontend, backend, general) + git rules.
- `STATE.md` — client state shapes, page-local state, gamification/achievement/avatar-frame thresholds.
