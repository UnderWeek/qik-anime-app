# STATE.md

## Client-Side State

### AuthContext (`anime-site/src/context/AuthContext.jsx`)

Центральное хранилище состояния пользователя.

```js
{
  user: null | { id, email, username, avatarColor, avatarUrl, bannerUrl, avatarFrame, bio },
  token: null | string,
  isAuthModalOpen: boolean,
  toasts: Array<{ id, type: 'success' | 'error', message }>,
}
```

- `user` и `token` синхронизируются с `localStorage` (ключи `qik_token`, `qik_user`)
- При монтировании: если токен есть, проверяется через `GET /auth/me`
- `login()`, `register()` — устанавливают токен и пользователя
- `logout()` — очищает токен и пользователя
- `addToast()` — добавляет уведомление (автоудаление через 4с)
- `removeToast()` — удаляет уведомление по id

### ThemeContext (`anime-site/src/context/ThemeContext.jsx`)

```js
{
  theme: 'dark' | 'light',
  toggleTheme: () => void,
}
```

- Значение хранится в `localStorage` (ключ `theme`)
- При изменении устанавливает `data-theme` атрибут на `<html>`
- По умолчанию `dark`

### useApi Hook (`anime-site/src/hooks/useApi.js`)

```js
{
  data: any | null,
  loading: boolean,
  error: Error | null,
  refetch: () => Promise<void>,
}
```

- Принимает `fetcher` функцию и опциональный `deps` массив
- Автоматически вызывает `fetcher` при изменении `deps`

### Локальный стейт страниц

| Страница | Локальный стейт |
|----------|----------------|
| `Catalog.jsx` | filters (сортировка, тип, статус, жанры, год, сезоны), anime list, pagination cursor, loadingMore |
| `AnimeDetail.jsx` | anime data, recommendations, comments list, bookmark status, user rating, tab state |
| `Watch.jsx` | episode data, selected dubbing/player/episode, progress seconds, `kodik` iframe state, createRoomData |
| `Profile.jsx` | profile data (user, stats, achievements, bookmarks, history, friends, comments), edit mode, avatar editor state |
| `Rooms.jsx` | rooms list, create form, join form |
| `RoomWatch.jsx` | room state, sync polling interval, WebSocket connection, chat messages, anime search, video iframe + postMessage |
| `Friends.jsx` | friends list, pending requests (in/out), search results |
| `Library.jsx` | bookmarks grouped by status, active tab |
| `Schedule.jsx` | schedule data grouped by day, active day tab |

## Server-Side State (Database)

### Геймификация (вычисляется, не хранится)

**XP** вычисляется из активностей:
- 10 XP за просмотренный эпизод
- 1 XP за минуту просмотра
- 5 XP за оценку
- 8 XP за комментарий
- 3 XP за закладку
- 15 XP за друга

**Уровень**: `Math.floor(Math.sqrt(totalXp / 100)) + 1`

**Достижения** (10 шт., проверяются при запросе профиля):
- 👶 Первый шаг — первый просмотренный эпизод
- 🍿 Запойщик — 10 эпизодов
- 🎬 Машина — 100 эпизодов
- ⏰ 24 часа — 86400+ секунд просмотра
- ⭐ Критик — 5+ оценок
- 💬 Болтун — 10+ комментариев
- 👑 Коллекционер — 20+ закладок
- 🤝 Душа компании — 5+ друзей
- 🌟 Популярный — 20+ лайков на комментариях
- 🥚 Re:Zero S4 — просмотр любого эпизода Re:Zero S4 (скрытое)

**Рамки аватаров** разблокируются по уровню:
- Уровень 1: Нет рамки
- Уровень 5: Mint
- Уровень 10: Lavender
- Уровень 15: Peach
- Уровень 20: Rose
- Уровень 30: Gold
- Уровень 40: Aurora
- Уровень 50: Legend

### Watch Room State (WebSocket)

Состояние комнаты рассылается через WebSocket события:
- `room:snapshot` — полное состояние при подключении (участники, текущее видео, позиция, сообщения)
- `room:state` — изменение состояния плеера (время, пауза, видео)
- `room:members` — изменение списка участников
- `room:message` — новое сообщение чата

Сервер хранит версионность (`stateVersion`, `membersVersion`, `lastMessageId`) для обнаружения рассинхрона. Клиент синхронизируется через WebSocket, с HTTP polling как fallback.

## Persistence

| Что | Где | Формат |
|-----|-----|--------|
| Данные БД | `server/data/qik-anime.db` | SQLite (бинарный) |
| JWT токен | `localStorage` (браузер) | `qik_token` |
| Пользователь | `localStorage` (браузер) | `qik_user` (JSON) |
| Тема | `localStorage` (браузер) | `theme` ('dark'/'light') |
| Загруженные файлы | `server/uploads/` | Изображения (jpg/png/gif/webp) |
