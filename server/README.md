# QIK Anime — бэкенд ⚙️

NestJS API для аккаунтов, закладок, рейтингов и комментариев.

## 🧱 Стек

- **NestJS 10** + TypeScript
- **TypeORM** + **sql.js** (SQLite в WebAssembly — чистый JS, **без нативной сборки
  и без Visual Studio / node-gyp**). Данные сохраняются в файл `qik-anime.db`.
- **JWT** (Passport) для авторизации, **bcryptjs** для хэширования паролей
- **class-validator** для валидации DTO

> ⚠️ Почему не `better-sqlite3`? Это нативный модуль, который на Windows + Node 22/24
> требует Visual Studio C++ Build Tools для компиляции. `sql.js` ставится как обычный
> JS-пакет и работает одинаково на любой ОС без дополнительных инструментов.

## 🚀 Запуск

```bash
npm install
npm run dev        # режим разработки с автоперезагрузкой → http://localhost:3001/api
# или
npm run build && npm run start:prod
```

Файл БД создастся автоматически при первом запросе.

## ⚙️ Переменные окружения

```bash
cp .env.example .env
```

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `PORT` | порт API | `3001` |
| `JWT_SECRET` | секрет для подписи JWT | dev-значение (**смените в проде**) |
| `DB_PATH` | путь к файлу SQLite | `qik-anime.db` |

## 📡 Эндпоинты

Базовый префикс: `/api`

### Auth
| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| POST | `/auth/register` | гость | регистрация `{ email, username, password }` |
| POST | `/auth/login` | гость | вход `{ login, password }` (login = email или ник) |
| GET | `/auth/me` | JWT | текущий пользователь |

### Закладки
| Метод | Путь | Описание |
|---|---|---|
| GET | `/bookmarks?status=` | список закладок пользователя |
| GET | `/bookmarks/anime/:animeId` | статус конкретного аниме |
| PUT | `/bookmarks` | добавить/обновить `{ animeId, status, … }` |
| DELETE | `/bookmarks/anime/:animeId` | удалить |

Статусы: `watching`, `planned`, `completed`, `on_hold`, `dropped`, `favorite`.

### Рейтинги
| Метод | Путь | Описание |
|---|---|---|
| GET | `/ratings/anime/:animeId` | средняя оценка, распределение, своя оценка |
| PUT | `/ratings` | поставить оценку `{ animeId, score }` (1–10) |
| DELETE | `/ratings/anime/:animeId` | удалить свою оценку |

### Комментарии
| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/comments/anime/:animeId` | гость | список комментариев |
| POST | `/comments` | JWT | добавить `{ animeId, body, parentId? }` |
| PATCH | `/comments/:id` | JWT (автор) | редактировать |
| DELETE | `/comments/:id` | JWT (автор) | удалить |

## 🔐 Авторизация

В защищённые запросы передавайте заголовок:

```
Authorization: Bearer <token>
```

Токен возвращается при регистрации/входе и живёт 30 дней.
