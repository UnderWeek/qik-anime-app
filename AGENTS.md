# AGENTS.md

## Project Overview

QIK Anime — full-stack приложение для просмотра и отслеживания аниме. Состоит из React SPA (`anime-site/`) и NestJS бэкенда (`server/`). Данные об аниме берутся из внешнего YummyAnime API (https://yani.tv). Бэкенд добавляет социальные и геймификационные фичи: пользователи, закладки, рейтинги, комментарии, прогресс просмотра, друзья, уведомления, совместные комнаты просмотра.

## Tech Stack

- **Frontend**: React 18, Vite 5, React Router, Socket.IO Client, чистый CSS (без библиотек)
- **Backend**: NestJS 10, TypeORM, sql.js (SQLite через WebAssembly), Passport JWT, Socket.IO
- **Database**: SQLite (файл `server/data/qik-anime.db`, автосинхронизация через TypeORM `synchronize: true`)

## Commands

```bash
# Frontend (из корня)
cd anime-site && npm run dev     # Dev сервер на :5173
cd anime-site && npm run build   # Production build

# Backend (из корня)
cd server && npm run start:dev   # Dev сервер на :3001
cd server && npm run build       # Компиляция TypeScript
```

## Project Conventions

### Frontend
- Компоненты в `anime-site/src/components/`, страницы в `pages/`
- Стейт через React Context (`AuthContext`, `ThemeContext`), без Redux
- Запросы к API через функции в `api/backend.js` (бэкенд) и `api/client.js` (YummyAnime)
- Стили в одном файле `styles/index.css` (~2550 строк), CSS-переменные для тёмной/светлой темы
- Хук `useApi` для fetch с loading/error состоянием
- Нотификации через `Toast` (портал), модалки через порталы

### Backend
- Модульная структура: каждый модуль в своей папке внутри `server/src/`
- JWT аутентификация через Passport (токен в `Authorization: Bearer <token>`)
- Декоратор `@CurrentUser()` для получения пользователя в контроллерах
- `OptionalJwtAuthGuard` для эндпоинтов, доступных и гостям
- DTO с валидацией через `class-validator`
- Загрузка файлов через multer в `uploads/`

### Database
- TypeORM с `synchronize: true` — схема БД генерируется из entity-классов
- Все entity лежат в `*.entity.ts` внутри соответствующих модулей
- Уникальные составные индексы через `@Unique()` декоратор

### Key Patterns
- **Два API**: Фронтенд ходит в NestJS за соц. данными и в YummyAnime за каталогом аниме
- **Геймификация**: XP вычисляется из активности (не хранится), уровни по формуле `100 * (n-1)^1.5`
- **Watch Rooms**: Синхронизация через Socket.IO + HTTP polling fallback
- **Оптимистичные обновления**: Лайки комментариев обновляют UI до ответа API, с откатом при ошибке
