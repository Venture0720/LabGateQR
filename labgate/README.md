# LabGate API

Backend для системы контроля доступа и учёта посещаемости (FastAPI + Supabase/PostgreSQL).

## ⚠️ Перед началом — обязательно

Пароль от базы, который был отправлен в чате, нужно СМЕНИТЬ:
Supabase Dashboard → Project Settings → Database → Reset Database Password.
Новый пароль вписывай только в свой локальный `.env` (этот файл в `.gitignore`, в репозиторий не попадёт).

## Установка

```bash
cd labgate
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Настройка окружения

```bash
cp .env.example .env
```

Открой `.env` и заполни своими значениями:

```env
DATABASE_URL=postgresql://postgres:НОВЫЙ_ПАРОЛЬ@db.etgmcimlnbuppiouacxx.supabase.co:5432/postgres
SUPABASE_URL=https://etgmcimlnbuppiouacxx.supabase.co
JWT_SECRET_KEY=сгенерируй_длинную_случайную_строку
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=720
DEV_BOOTSTRAP_USERNAME=developer
DEV_BOOTSTRAP_PASSWORD=придумай_надёжный_пароль
```

Сгенерировать `JWT_SECRET_KEY` можно так:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Запуск

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

При первом запуске:
- автоматически создаются таблицы в Supabase;
- автоматически создаётся аккаунт разработчика (developer) из `.env` (`DEV_BOOTSTRAP_USERNAME` / `DEV_BOOTSTRAP_PASSWORD`).

Документация API (Swagger): http://localhost:8000/docs

## Базовый сценарий использования

1. **Войти как developer**: `POST /api/v1/auth/login` (form-data: username, password) → получить `access_token`.
2. **Создать админа/студента**: `POST /api/v1/auth/register` с Bearer токеном developer'а.
3. **Войти как админ**, сгенерировать QR: `POST /api/v1/attendance/qr/generate`.
4. **Войти как студент**, отсканировать QR: `POST /api/v1/attendance/scan` с `{"secret": "..."}`.
5. **Админ смотрит статистику**:
   - `GET /api/v1/attendance/today` — кто пришёл сегодня
   - `GET /api/v1/attendance/history?days=30` — история по дням
   - `GET /api/v1/attendance/percentage` — процент посещаемости

## Структура проекта

```
labgate/
├── app/
│   ├── main.py            # точка входа, CORS, bootstrap
│   ├── config.py          # настройки из .env
│   ├── database.py        # подключение к Supabase Postgres
│   ├── models.py          # SQLAlchemy модели (User, QRCode, Attendance)
│   ├── schemas.py         # Pydantic схемы запросов/ответов
│   ├── security.py        # хэширование паролей, JWT
│   ├── dependencies.py    # проверка ролей и текущего пользователя
│   └── routers/
│       ├── auth.py        # login, register (только developer)
│       └── attendance.py  # QR-коды, scan, аналитика
├── requirements.txt
├── .env.example
└── .gitignore
```

## Важные замечания

- **Один scan в день на студента** — встроено через unique constraint в БД (`user_id` + `attendance_date`). Если нужно разрешить несколько сканирований в день (вход/выход) — скажи, уберу это ограничение.
- **CORS открыт на `*`** — подойдёт для разработки и подключения с любого мобильного клиента. Перед продакшеном сузь до реального домена приложения.
- **Таблицы создаются автоматически** (`Base.metadata.create_all`) — удобно для старта, но для серьёзного продакшена лучше подключить Alembic для версионируемых миграций.
