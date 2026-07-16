# RULES.md

## Code Rules

### Frontend (anime-site)

1. **Компоненты vs страницы**: Переиспользуемые UI-элементы — в `components/`, полноценные страницы с маршрутизацией — в `pages/`. Не клади страницу в `components/`.

2. **Стили**: Все стили в `styles/index.css`. Не создавай CSS-модули или отдельные файлы стилей. Используй CSS-переменные из дизайн-системы (`--surface`, `--surface-secondary`, `--text`, `--text-secondary`, `--accent`, `--accent-secondary`). Для тёмной/светлой темы используй `[data-theme='light']` селектор.

3. **API-клиенты**: Все HTTP-запросы к бэкенду — через функции в `api/backend.js`. Все запросы к YummyAnime — через `api/client.js`. Не пиши fetch напрямую в компонентах.

4. **Стейт**: Никакого Redux. Используй React Context для глобального стейта (`AuthContext`, `ThemeContext`), локальный `useState`/`useEffect` для страниц. Для fetch-запросов — хук `useApi`.

5. **Иконки**: Все иконки определены в `components/icons.jsx` как inline SVG. Не подключай иконочные библиотеки.

6. **Порталы**: Модалки (`AuthModal`, `SuggestModal`, `BookmarkButton` dropdown) и `Toast` рендерятся через `ReactDOM.createPortal` в DOM на верхнем уровне. Lightbox тоже портал.

7. **Именование**: Компоненты — PascalCase (`AnimeCard.jsx`), утилиты/контексты/хуки — camelCase (`useApi.js`, `backend.js`).

### Backend (server)

1. **Модульная структура**: Каждый функциональный домен — отдельный модуль NestJS. Внутри модуля: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.entity.ts`, `dto.ts`. Не объединяй разные сущности в один модуль.

2. **Аутентификация**: Используй `@CurrentUser()` декоратор для получения пользователя. Для обязательной аутентификации — `@UseGuards(JwtAuthGuard)`, для опциональной — `@UseGuards(OptionalJwtAuthGuard)`.

3. **Валидация**: Все входные данные — через DTO с декораторами `class-validator`. Не валидируй вручную в контроллерах или сервисах.

4. **Entity**: TypeORM entity с декораторами `@Entity()`, `@Column()`, `@ManyToOne()`, `@Unique()`. Не используй raw SQL без крайней необходимости.

5. **Транзакции**: SQLite через sql.js не поддерживает полноценные транзакции TypeORM. Избегай операций, требующих атомарности нескольких запросов. Если нужно — используй паттерн «сначала пишем, потом чистим при ошибке» (как в `CommentsService.toggleLike`).

6. **Обработка ошибок**: Полагайся на встроенные исключения NestJS (`NotFoundException`, `BadRequestException`, `ForbiddenException`, `UnauthorizedException`). Фильтр исключений NestJS преобразует их в HTTP-ответы.

7. **Пути к файлам**: Используй `runtime-paths.ts` для получения `DB_PATH`, `UPLOAD_DIR_ABSOLUTE`. Не хардкодь пути.

### Общие

1. **Безопасность**: JWT-секрет — через переменную окружения, никогда не хардкодить. Пароли хешируются bcryptjs. Файлы загружаются с проверкой MIME-типа и размера. CORS настроен на конкретные домены.

2. **No native dependencies**: Всё должно работать без Visual Studio Build Tools. Поэтому: `sql.js` вместо `better-sqlite3`, `bcryptjs` вместо `bcrypt`, `socket.io` (чистый JS) вместо нативных альтернатив.

3. **Логирование**: NestJS дефолтный логгер. Не добавляй внешние логгеры без явной необходимости.

4. **Конфигурация**: Все изменяемые параметры — через переменные окружения (`.env`). Значения по умолчанию прописаны в коде на случай отсутствия `.env`.

5. **Миграции**: TypeORM `synchronize: true` — схема БД генерируется из entity. Не используй миграции TypeORM. При изменении entity убедись, что изменения обратно совместимы (добавление колонок — OK, удаление/переименование — удали БД вручную при разработке).

## Git Rules

- Ветка по умолчанию: `main`
- Коммиты на русском языке, в формате: `<глагол> <что сделано>` (например: «добавил комнаты», «fix rooms x2», «fixed rooms»)
- Не коммитить: `.env` файлы, `node_modules/`, `dist/`, `.npm-cache/`, `data/qik-anime.db`, `uploads/`
