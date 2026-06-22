# AGENTS.md

## Project Overview

QIK Anime — full-stack приложение для просмотра и отслеживания аниме. Состоит из React SPA (`anime-site/`) и NestJS бэкенда (`server/`). Данные об аниме берутся из внешнего YummyAnime API (https://yani.tv). Бэкенд добавляет социальные и геймификационные фичи: пользователи, закладки, рейтинги, комментарии, прогресс просмотра, друзья, уведомления, совместные комнаты просмотра.

## Tech Stack

- **Frontend**: React 18, Vite 5, React Router, Socket.IO Client, HLS.js, чистый CSS (без библиотек)
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

---

## ⚠️ DEPLOYMENT (CRITICAL)

### Как работает деплой

При пуше в `main` → GitHub Actions workflow (`.github/workflows/deploy.yml`) автоматически:
1. Собирает фронтенд (`vite build`) и бэкенд (`nest build`)
2. Rsync'ит артефакт на сервер: `/root/qik-anime/`
3. Копирует `anime-site/dist/*` → `/var/www/quickik.ru/` (nginx)
4. Ставит продакшен-зависимости сервера (`npm ci --omit=dev`)
5. Перезапускает PM2: `pm2 reload anime-api`

### Что НЕ деплоится (в .gitignore)
- `.env` файлы — должны быть созданы на сервере вручную
- `server/data/` — БД исключена из rsync (`--exclude='server/data/'`)
- `server/uploads/` — загрузки исключены из rsync (`--exclude='server/uploads/'`)
- `node_modules/` — ставятся на сервере через `npm ci --omit=dev`

### Переменные окружения (на сервере `/root/qik-anime/server/.env`)

```
PORT=3001
JWT_SECRET=<секрет>
DB_PATH=data/qik-anime.db
UPLOAD_DIR=uploads
CORS_ORIGINS=
ADMIN_SECRET=<код для получения админки>
DEEPSEEK_TOKEN=<токен для квиза>
```

### Что может сломаться и как чинить

**1. База данных обнулилась**
- Причина: раньше `rsync --delete` удалял `server/data/`. Сейчас ИСПРАВЛЕНО — `--exclude='server/data/'` и `--exclude='server/uploads/'`
- Бэкап: крон每晚 в 3:00 делает копию `/root/qik-anime/server/data/qik-anime.db` → `/root/backups/qik-anime-<дата>.db`, хранит 7 дней
- Восстановить: `cp /root/backups/qik-anime-<дата>.db /root/qik-anime/server/data/qik-anime.db && pm2 reload anime-api`
- Бэкап-скрипт: `/root/backup-db.sh`

**2. Сервер не стартует после деплоя**
- Логи: `pm2 logs anime-api --lines 50 --nostream`
- Частые причины:
  - Ошибка компиляции TypeScript (новый код не скомпилировался)
  - `npm ci --omit=dev` упал (новый пакет не установлен) — проверь `package.json` и `package-lock.json`
  - TypeORM `synchronize: true` конфликтует с существующей схемой (добавлены/удалены колонки) — проверь entity-классы
  - Отсутствуют env-переменные в `.env`

**3. Фронтенд не обновляется после деплоя**
- Проверь что CI прошёл зелёным (GitHub Actions)
- Проверь на сервере: `ls -la /var/www/quickik.ru/index.html` — дата должна быть свежей
- Проверь nginx: `nginx -t && systemctl status nginx`
- Кэш браузера: Ctrl+Shift+R

**4. Комнаты не работают**
- Socket.IO требует WebSocket прокси в nginx
- Проверь nginx: `cat /etc/nginx/sites-enabled/quickik.ru` — должен быть блок для `/api/` с `proxy_set_header Upgrade $http_upgrade`
- Если комнаты закрыты для обычных пользователей — это фича (только мастера/админы)

**5. Квиз по эмодзи не работает**
- Нужен `DEEPSEEK_TOKEN` в `.env` на сервере
- Контроллер читает `.env` напрямую (минуя PM2), так что `pm2 reload` должен подхватить

### Ручной деплой (если CI сломан)

```bash
# На сервере
cd /root/qik-anime
git pull origin main
cd anime-site && npm ci && npm run build && cp -r dist/* /var/www/quickik.ru/
cd ../server && npm ci --omit=dev && npm run build && pm2 reload anime-api
```

### Структура сервера

```
/var/www/quickik.ru/        # nginx root (статика фронтенда)
/root/qik-anime/            # git repo
/root/qik-anime/server/.env # env-переменные (НЕ в гите!)
/root/qik-anime/server/data/qik-anime.db  # SQLite БД
/root/backups/              # ежедневные бэкапы БД
/root/backup-db.sh          # скрипт бэкапа
```

### GitHub Secrets (для CI)

| Секрет | Описание |
|--------|----------|
| `SSH_HOST` | IP сервера |
| `SSH_USER` | root |
| `SSH_KEY` | Приватный SSH-ключ (base64) |
| `SSH_PORT` | 22 |

---

## Project Conventions

### Frontend
- Компоненты в `anime-site/src/components/`, страницы в `pages/`
- Стейт через React Context (`AuthContext`, `ThemeContext`), без Redux
- Запросы к API через функции в `api/backend.js` (бэкенд) и `api/client.js` (YummyAnime)
- Стили в одном файле `styles/index.css` (~2850 строк), CSS-переменные для тёмной/светлой темы
- Хук `useApi` для fetch с loading/error состоянием
- HLS.js для воспроизведения .m3u8 стримов (AniLibria)

### Backend
- Модульная структура: каждый модуль в своей папке внутри `server/src/`
- JWT аутентификация через Passport (токен в `Authorization: Bearer <token>`)
- Декоратор `@CurrentUser()` для получения пользователя в контроллерах
- `OptionalJwtAuthGuard` для эндпоинтов, доступных и гостям
- `AdminGuard` — только админы
- `MasterOrAdminGuard` — мастера и админы (комнаты)
- DTO с валидацией через `class-validator`
- Загрузка файлов через multer в `uploads/`
- AniLibria API проксируется через `anilibria.service.ts`

### Database
- TypeORM с `synchronize: true` — схема БД генерируется из entity-классов
- Все entity лежат в `*.entity.ts` внутри соответствующих модулей
- Уникальные составные индексы через `@Unique()` декоратор
- ВНИМАНИЕ: при добавлении/удалении полей в entity — TypeORM сам обновит схему при старте

### Roles
- **User** — базовый аккаунт (закладки, оценки, комментарии, друзья)
- **Master** — модерация комментариев, доступ к комнатам просмотра
- **Admin** — всё что у мастера + админка, статистика, назначение мастеров

### Key Patterns
- **Два API**: Фронтенд ходит в NestJS за соц. данными и в YummyAnime за каталогом аниме
- **Геймификация**: XP вычисляется из активности (не хранится), уровни по формуле `100 * (n-1)^1.5`
- **Watch Rooms — видео**: AniLibria API → HLS `.m3u8` стримы → HLS.js в HTML5 `<video>`
- **Watch Rooms — синхронизация**: host события play/pause → HTTP PATCH `/watch-rooms/:id/state` → WebSocket `room:state` → viewer применяет
- **Watch Rooms — плеер**: `<video>` всегда в DOM, overlay «Выберите аниме» когда нет URL. HLS инициализируется при изменении `iframeSrc`
