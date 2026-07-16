# ARCHITECTURE.md

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│  anime-site/ (Vite, port 5173 dev, static build prod)   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │  Pages   │  │Components│  │ Contexts (Auth,     │    │
│  │ (12 pgs) │  │  (15)    │  │ Theme)              │    │
│  └──────────┘  └──────────┘  └────────────────────┘    │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴───────────────┐  │
│  │              api/ (HTTP clients)                  │  │
│  │  client.js → YummyAnime API                      │  │
│  │  backend.js → NestJS Backend                      │  │
│  │  socket.io-client → NestJS WebSocket Gateway      │  │
│  └──────────────────────────────────────────────────┘  │
└──────────┬──────────────────────┬──────────────────────┘
           │ HTTP                 │ HTTP + WS
           ▼                      ▼
┌──────────────────┐  ┌──────────────────────────────────┐
│  YummyAnime API  │  │     NestJS Backend (:3001)        │
│  api.yani.tv     │  │  server/ (Express, /api prefix)   │
│                  │  │                                    │
│  • Каталог аниме │  │  ┌────────────────────────────┐  │
│  • Видео/серии   │  │  │  Modules (10)              │  │
│  • Поиск         │  │  │  Auth, Users, Bookmarks,   │  │
│  • Расписание    │  │  │  Ratings, Comments,        │  │
│  • Рекомендации  │  │  │  Progress, Friends,        │  │
│  • Новости/фид   │  │  │  Notifications, Uploads,   │  │
│                  │  │  │  Suggestions, WatchRooms   │  │
│                  │  │  └──────────┬─────────────────┘  │
│                  │  │             │                      │
│                  │  │  ┌──────────▼─────────────────┐  │
│                  │  │  │  TypeORM + sql.js (SQLite) │  │
│                  │  │  │  data/qik-anime.db         │  │
│                  │  │  └────────────────────────────┘  │
└──────────────────┘  └──────────────────────────────────┘
```

## Data Flow

### Получение аниме
1. Фронтенд → `api/client.js` → YummyAnime API (`api.yani.tv`)
2. Параллельно: фронтенд → `api/backend.js` → NestJS (для получения пользовательских данных: закладки, рейтинг, прогресс)
3. Данные сливаются на уровне страницы

### Авторизация
1. `POST /api/auth/login` или `POST /api/auth/register` → JWT токен (30 дней)
2. Токен хранится в `localStorage` под ключом `qik_token`
3. Все защищённые запросы: `Authorization: Bearer <token>`

### Watch Room (комнаты совместного просмотра)
1. Создание: `POST /api/watch-rooms` → возвращает код комнаты
2. Подключение: Socket.IO в namespace `/watch-rooms`, аутентификация по JWT
3. Клиент шлёт `room:join { roomId }` → сервер рассылает состояние
4. Синхронизация видео: `PATCH /api/watch-rooms/:id/state` → WebSocket broadcast
5. Чат: `POST /api/watch-rooms/:id/messages` → WebSocket broadcast
6. Fallback: HTTP polling `GET /api/watch-rooms/:id/sync`

## Database Schema

### Таблицы (SQLite через TypeORM)

| Таблица | Назначение |
|---------|------------|
| `users` | Пользователи (email, username, пароль, аватар, баннер, XP-статистика) |
| `bookmarks` | Закладки аниме (статус: watching/planned/completed/on_hold/dropped/favorite) |
| `ratings` | Оценки аниме (1-10) |
| `comments` | Комментарии к аниме и профилям, с лайками |
| `comment_likes` | Лайки комментариев |
| `watch_progress` | Прогресс просмотра (серия, секунда, продолжительность) |
| `friendships` | Дружеские связи (pending/accepted) |
| `notifications` | Уведомления (friend_request, friend_accept, anime_suggestion, comment_reply, system) |
| `watch_rooms` | Комнаты совместного просмотра (код, владелец, состояние плеера) |
| `watch_room_participants` | Участники комнат |
| `watch_room_messages` | Сообщения чата комнат |

## Module Boundaries

### Backend Modules

```
AppModule
├── ConfigModule      (глобальный .env)
├── TypeOrmModule     (SQLite, synchronize: true)
├── ServeStaticModule (раздача uploads/)
├── AuthModule        (регистрация, вход, JWT)
├── UsersModule       (профили, поиск, статистика)
├── BookmarksModule   (закладки аниме)
├── RatingsModule     (рейтинги 1-10)
├── CommentsModule    (комментарии + лайки)
├── ProgressModule    (прогресс просмотра)
├── FriendsModule     (друзья)
├── NotificationsModule (уведомления)
├── UploadsModule     (загрузка изображений)
├── SuggestionsModule (предложения аниме друзьям)
└── WatchRoomsModule  (комнаты просмотра + WebSocket)
```

Каждый модуль содержит: `.module.ts`, `.controller.ts`, `.service.ts`, `.entity.ts` (если есть сущность), `dto.ts` (если есть DTO).

### Auth Guards
- `JwtAuthGuard` — строгая аутентификация (401 без токена)
- `OptionalJwtAuthGuard` — мягкая аутентификация (req.user = null для гостей)

## Environment Variables

### Server (.env)
```
PORT=3001
JWT_SECRET=qik-anime-dev-secret-change-me
APP_ROOT=
DB_PATH=data/qik-anime.db
UPLOAD_DIR=uploads
CORS_ORIGINS=
```

### Frontend (.env)
```
VITE_YUMMY_APP_TOKEN=
VITE_QIK_API_URL=
```
