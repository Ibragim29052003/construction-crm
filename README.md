# Контур — объекты и задачи

Мини-CRM для строительной команды: объекты, назначение задач, проверка результата и история статусов. React, TypeScript, Redux Toolkit / RTK Query, Supabase.

[Открыть приложение](https://ibragim29052003.github.io/construction-crm/). Тестовые доступы передаю отдельно.

## Запуск

Нужен Node.js 22.12+.

```bash
npm ci
cp .env.example .env.local
# Заполнить URL и публичный ключ Supabase
npm run dev
```

Для своей базы: создать проект Supabase и выполнить файлы из `supabase/migrations` по порядку в SQL Editor (либо `supabase db push`). В Authentication → Sign In / Providers выключить **Allow new users to sign up**. В Authentication → Users вручную добавить пользователей с подтверждённым email, затем создать им записи в `profiles`: `id` из Auth, `display_name`, `role` (`manager` или `executor`). Роль из пользовательских metadata не используется.

Во фронтенде нужен только publishable/anon key. `service_role` и secret key не нужны.

## Проверки и сборка

```bash
npm run check        # ESLint, тесты, TypeScript, сборка
npm run preview      # просмотр production-сборки
```

`tests/database/security.sql` проверяет RLS и все сочетания ролей/статусов на базе с применёнными миграциями. Запуск: `DATABASE_TEST_URL=... npm run test:db`. Нужна отдельная тестовая база и административное подключение; данные проверки откатываются. В CI такая база поднимается автоматически.

GitHub Actions проверяет код и публикует `dist` в Pages. В переменных репозитория нужны `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`; источник Pages — GitHub Actions. Маршрутизация через `#`, поэтому прямые ссылки и обновление страницы работают на статическом хостинге.

## Как устроено

`src/features` — вход, объекты, задачи; `src/shared` — API и общие компоненты; `supabase/migrations` — схема и правила доступа. Чтение ограничено RLS, запись — через функции базы с проверкой роли, версии записи и допустимого перехода. История записывается в той же транзакции.

[Объяснение для руководителя](docs/overview.md) · [Решения и допущения](docs/decisions.md)

Для наполнения своей демобазы: создать трёх пользователей и их профили, заполнить копию `docs/demo-users.example.json` (сохранить как `demo-users.local.json`, он игнорируется Git), затем:

```bash
DEMO_CREDENTIALS_FILE=demo-users.local.json node --env-file=.env.local scripts/seed-demo.mjs
DEMO_CREDENTIALS_FILE=demo-users.local.json node --env-file=.env.local scripts/verify-api.mjs
```
