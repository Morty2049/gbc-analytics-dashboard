# Тестовое задание — AI Tools Specialist

Построй мини-дашборд заказов. Используй Claude Code CLI (или другой AI-инструмент).

## Что нужно сделать

### Шаг 1: Создай аккаунты (всё бесплатно)

- [RetailCRM](https://www.retailcrm.ru/) — демо-аккаунт
- [Supabase](https://supabase.com/) — бесплатный проект
- [Vercel](https://vercel.com/) — бесплатный аккаунт
- [Telegram Bot](https://t.me/BotFather) — создай бота

### Шаг 2: Загрузи заказы в RetailCRM

В репо есть `mock_orders.json` — 50 тестовых заказов. Загрузи их в свой RetailCRM через API.

### Шаг 3: RetailCRM → Supabase

Напиши скрипт который забирает заказы из RetailCRM API и кладёт в Supabase.

### Шаг 4: Дашборд

Сделай веб-страницу с графиком заказов (данные из Supabase). Задеплой на Vercel.

### Шаг 5: Telegram-бот

Настрой уведомление в Telegram когда в RetailCRM появляется заказ на сумму больше 50,000 ₸.

## Результат

- Ссылка на работающий дашборд (Vercel)
- Ссылка на GitHub-репо с кодом
- Скриншот уведомления из Telegram
- В README репо опиши: какие промпты давал Claude Code, где застрял, как решил

## Как сдать

Отправь результат в Telegram: @DmitriyKrasnikov

---

## Реализация

### Ссылки

- **Дашборд:** https://gbc-analytics-dashboard-ochre.vercel.app 
<img width="820" height="1203" alt="image" src="https://github.com/user-attachments/assets/7b5ab9dd-340b-477b-822a-d72dee8e99e9" />

- **Telegram-бот:** [@gbc_analytics_best_bot](https://t.me/gbc_analytics_best_bot)
<img width="513" height="799" alt="image" src="https://github.com/user-attachments/assets/16697926-ac12-491c-815d-050f2b25a361" />

### Стек

| Слой | Технология |
|---|---|
| Frontend | Next.js 15 (App Router) + Recharts + Tailwind CSS 4 |
| Хостинг | Vercel (Hobby) |
| БД | Supabase Postgres (RLS, anon read) |
| CRM | RetailCRM API v5 (демо-аккаунт `quaso`) |
| Бот | Telegram Bot API через webhook на Vercel |

### Архитектура

```
RetailCRM ──webhook──▶ Vercel /api/webhooks/retailcrm ─┐
   │                                                    ├─▶ Supabase (orders)
   └──polled──◀── Vercel Cron /api/sync ────────────────┘            │
                                                                     ▼
                                       Telegram Bot ◀── alert (порог 50 000 ₸)
                                                                     ▲
                                       /api/telegram/webhook ◀── BotFather
```

### Дашборд (4 метрики)

1. **Заказы по дням** — BarChart
2. **Выручка по дням** — BarChart
3. **Топ городов** — PieChart
4. **Каналы (utm_source)** — горизонтальный BarChart
5. **Таблица последних заказов** с фильтром по статусу

### Telegram-бот

| Команда | Действие |
|---|---|
| `/start` | Подписка на алерты о крупных заказах |
| `/test_order` | Создаёт случайный заказ в RetailCRM + Supabase + шлёт алерт |
| `/stats` | Количество заказов, выручка, ссылка на дашборд |

### API endpoints

| Endpoint | Метод | Назначение |
|---|---|---|
| `/api/sync` | GET | Cron-синхронизация RetailCRM → Supabase |
| `/api/webhooks/retailcrm` | POST | Webhook от RetailCRM: upsert + alert |
| `/api/telegram/webhook` | POST | Webhook от Telegram: команды бота |
| `/api/notify` | POST | Ручная отправка алертов подписчикам |

### Скрипты

- `scripts/upload-orders.mjs` — загрузка mock_orders.json в RetailCRM (батчи по 50)
- `scripts/sync-to-supabase.mjs` — одноразовая синхронизация CRM → Supabase
- `scripts/check-retailcrm.mjs` — валидация API-ключа и справочников

### Промпты и грабли

**Какие промпты давал Claude Code:**

1. `init repo` — scaffolding Next.js 15 проекта с TypeScript, Tailwind, Supabase, Recharts
2. Валидация RetailCRM API — проверка credentials, справочников, создание тестового заказа
3. Загрузка 50 mock-заказов через `/api/v5/orders/upload`
4. Создание схемы Supabase через MCP (apply_migration)
5. Полный цикл: создание заказа → sync → dashboard → Telegram alert

**Где застрял и как решил (наш код):**

| Проблема | Решение |
|---|---|
| Tremor v3 не работает с Tailwind v4 (чёрно-белые графики, сломанный grid) | Заменил на Recharts + нативный Tailwind grid |
| `/api/v5/orders/upload` не сохраняет ФИО клиентов | Обновил каждый заказ через `/orders/{id}/edit` + customer через `/customers/{id}/edit` |
| `filter[updatedAtFrom]` не работает в RetailCRM | Нашёл правильное имя: `createdAtFrom` |
| `/api/sync` был upsert-only → удалённые в CRM заказы оставались в Supabase | Добавил diff-delete: сравниваю IDs из CRM с Supabase, удаляю лишние |
| Sync затирал customer_name/utm/даты NULL'ами (RetailCRM list endpoint их не отдаёт) | Field-level merge: fetch existing → `r.field ?? prev.field` |
| Vercel Hobby не поддерживает cron чаще раза в день | Изменил расписание с `*/15 * * * *` на `0 8 * * *` |
| `npm install` падает на Vercel из-за peer deps (React 19 vs Tremor) | Добавил `.npmrc` с `legacy-peer-deps=true` |
| Supabase `sb_publishable_` ключ — новый формат, не JWT | Работает нативно с `@supabase/supabase-js` |

**Грабли на стороне RetailCRM (не зависят от нашего кода):**

| Проблема | Влияние |
|---|---|
| Batch upload `/api/v5/orders/upload` создаёт customer entity без `firstName`/`lastName`/`phone`/`email` — только id | Пришлось после upload отдельно обновлять каждого customer через `/api/v5/customers/{id}/edit`. Без этого в "Список клиентов" все клиенты висят как "ФИО не указано" |
| В "Список клиентов" колонки `Кол-во заказов`, `Средний чек`, `Сумма заказов` показывают `0 KZT` даже когда у клиента есть заказы с суммами | Агрегаты не пересчитываются синхронно (фоновый job, в демо-аккаунте видимо не работает). При этом в `/orders` те же суммы корректные |
| Ротация / удаление API-ключей неинтуитивно запрятаны: Settings → Integration → API access keys → нужно провалиться в конкретный ключ чтобы увидеть кнопку "Отключить" | Для быстрой ротации после случайной утечки — очень неудобно. В первый раз сложно найти |
| Создание заказа с новым товаром через UI — добавление товара в карточку зависает, товар не сохраняется | Не удалось дотестировать создание заказа руками. Обошли созданием через API (`POST /api/v5/orders/create`) из команды `/test_order` бота |
| `/reference/order-types` в демо-аккаунте `quaso` вернул только один тип `main`, хотя в `mock_orders.json` был `eshop-individual` | Маппим все заказы на `main` при upload |
| `customFields.utm_source` не создан автоматически → custom field нужно заводить вручную в Settings → Custom Fields → Orders | Для MVP положили `utm_source` в `customFields` при create, но при чтении через `/orders` он не возвращается. В Supabase восстановили из mock_orders напрямую |

### Документация

- [docs/gsd-brief.md](docs/gsd-brief.md) — план, архитектура, схема БД
- [docs/adr.md](docs/adr.md) — ADR с полным контекстом для handover
- [docs/retailcrm-api.md](docs/retailcrm-api.md) — выжимка по RetailCRM API v5
- [docs/stack.md](docs/stack.md) — обоснование выбора инструментов
- [.env.example](.env.example) — шаблон переменных окружения
