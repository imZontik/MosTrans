# API «Магистраль 400»

Интерактивная спецификация доступна в Swagger UI: `http://localhost:8080/api/docs` (OpenAPI: `/api/openapi.json`).

- Базовый префикс: `/api`
- Формат: JSON
- Авторизация: заголовок `Authorization: Bearer <JWT>` либо `?token=<JWT>` (web view)
- Коды ошибок: `400`, `401`, `403`, `404`, `409`, `429`; тело ошибки — `{"detail": "<сообщение>"}`

## Аутентификация

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/auth/register` | Регистрация проводника |
| POST | `/api/auth/login` | Вход, выдача JWT |

### `POST /api/auth/register`
```json
{
  "email": "ivan@m400.ru",
  "password": "secret",
  "full_name": "Иван Петров",
  "position": "conductor",
  "team": "Бригада 3",
  "depot": "Депо Москва"
}
```

### `POST /api/auth/login`
```json
{ "email": "ivan@m400.ru", "password": "secret" }
```
Ответ: `{"access_token": "<jwt>", "token_type": "bearer"}`.

## Профиль

| Метод | Путь | Роль | Назначение |
|-------|------|------|------------|
| GET | `/api/me` | employee | Полный профиль: уровень, очки, компетенции, квалификация, достижения, место в рейтинге |
| GET | `/api/me/runs` | employee | История прохождений |
| GET | `/api/achievements` | employee | Каталог достижений с прогрессом |
| GET | `/api/users/{user_id}` | employee | Публичный профиль другого сотрудника |

## Сценарии и прохождение

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/scenarios` | Список доступных сценариев (с учётом должности и роли) |
| GET | `/api/scenarios/recommended` | Рекомендованный сценарий по слабым местам (адаптивная сложность) |
| GET | `/api/scenarios/{scenario_id}` | Сценарий + первый узел графа |
| POST | `/api/runs` | Начать прохождение `{"scenario_id": int, "restart": bool}` |
| GET | `/api/runs/{run_id}` | Текущее состояние забега (узел, шкалы, таймер) |
| POST | `/api/runs/{run_id}/answer` | Ответ на узел |
| POST | `/api/runs/{run_id}/abandon` | Прервать забег |

### `POST /api/runs/{run_id}/answer`
```json
{
  "node_id": "n3",
  "action": "choose",            // continue | choose | answer | timeout
  "choice_id": "a",              // для action=choose
  "text": "вызвать скорую"       // для action=answer (свободный текст)
}
```
Ответ при завершении содержит `summary`: результат, debrief (разбор каждого решения), breakdown очков, уровень, новые достижения.

## Лидерборд

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/leaderboard` | Рейтинг; параметры: `period=week|all`, `scope=company|depot|team`, `unit`, `limit` |
| GET | `/api/leaderboard/units` | Доступные депо/бригады для `scope`/`unit` |

## Турниры

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/tournaments/current` | Текущий турнир (вопрос, countdown) |
| GET | `/api/tournaments` | Последние турниры |
| POST | `/api/tournaments/{id}/join` | Участие в турнире |
| POST | `/api/tournaments/{id}/answer` | Ответ на вопрос `{"index": 0, "option": 2}` |
| GET | `/api/tournaments/{id}/leaderboard` | Живая таблица турнира `?limit=` |

## Специвенты

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/emergencies/pending` | Ожидающее экстренное событие (polling раз в ~20 с) |

## Админ-панель (роли `lead`, `admin`)

Все пути под префиксом `/api/admin`, защищены зависимостью `staff_user`.

### Аналитика
| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/admin/analytics/overview` | Пульс команды за 30 дней (активность, успешность, частые ошибки) |
| GET | `/api/admin/employees` | Таблица сотрудников `?search=` |
| GET | `/api/admin/employees/{user_id}` | Детали сотрудника (компетенции, история, квалификация) |
| PATCH | `/api/admin/employees/{user_id}` | Обновить должность/роль/бригаду/депо |

### Управление сценариями
| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/admin/scenarios` | Все сценарии |
| POST | `/api/admin/scenarios` | Создать сценарий (JSON-граф) |
| GET | `/api/admin/scenarios/{id}` | Сценарий |
| PATCH | `/api/admin/scenarios/{id}` | Обновить |
| DELETE | `/api/admin/scenarios/{id}` | Удалить |
| POST | `/api/admin/scenarios/validate` | Проверить граф `{"graph": {...}}` |
| POST | `/api/admin/scenarios/generate` | Черновик по ТЗ через ИИ `{"spec", "category", "position", "difficulty"}` |

### Турниры и специвенты
| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/admin/tournaments` | Список |
| POST | `/api/admin/tournaments` | Создать `{"title", "starts_at", "duration_min"}` |
| POST | `/api/admin/tournaments/{id}/start-now` | Запустить сейчас `{"duration_min"}` |
| POST | `/api/admin/tournaments/{id}/finish` | Финализировать, начислить призы |
| GET | `/api/admin/emergencies` | Список специвентов |
| POST | `/api/admin/emergencies/dispatch` | Отправить специвент `{"scenario_id", "user_ids", "message"}` |

### ИИ-ассистент и отчёты
| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/admin/assistant` | ИИ-ассистент по сотрудникам `{"message": "..."}` |
| GET | `/api/admin/reports/training` | Отчёт для HR/LMS (JSON) `?days=` |
| GET | `/api/admin/reports/training.xlsx` | Тот же отчёт в Excel |

## Интеграция с внешними системами (HR / LMS)

Решение предоставляет **документированный API для интеграции**:

- **Отчёт о прогрессе обучения** — `GET /api/admin/reports/training` (JSON) и `.xlsx` — сводка по команде, компетенциям и частым ошибкам. Подходит для выгрузки в HR-системы и LMS.
- **ИИ-ассистент по кадровым данным** — `GET /api/admin/assistant` для запросов вида «проводники, у кого упал рейтинг безопасности за месяц».
- **CRUD сотрудников** — `PATCH /api/admin/employees/{id}` для синхронизации со справочником кадров.
- **Web view** — фронтенд встраивается во внешние приложения/мессенджеры (JWT через `?token=`, nginx разрешает `frame`).

Аутентификация интеграции — по JWT с ролью `staff` (`lead`/`admin`). Для продакшн-интеграций рекомендуется закрыть CORS конкретным доменом.