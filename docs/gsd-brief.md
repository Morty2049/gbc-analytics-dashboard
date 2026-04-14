# GSD Brief — RetailCRM Analytics MVP

## Цель
Мини-дашборд заказов как demo для тестового задания AI Tools Specialist.

## Решения (зафиксированы с пользователем)
- **Frontend:** Next.js 15 (App Router) + **Tremor** на Vercel
- **Sync RetailCRM → Supabase:** **webhook + cron fallback** (надёжнее)
  - Webhook: POST `/api/webhooks/retailcrm` → upsert в `orders` → check threshold → Telegram
  - Cron: Vercel Cron каждые 15 мин → `/api/sync` → `GET /api/v5/orders?filter[updatedAtFrom]=last_sync`
- **Telegram:** бот с `/start`-подпиской, `chat_id` подписчиков хранятся в Supabase (`telegram_subscribers`)
- **Метрики дашборда:**
  1. Заказы по дням (bar/line)
  2. Выручка по дням
  3. Топ городов / каналов (utm_source) — pie/bar
  4. Таблица последних заказов с фильтром по статусу

## Архитектура
```
RetailCRM ──webhook──▶ Vercel /api/webhooks/retailcrm ─┐
   │                                                    ├─▶ Supabase (orders)
   └──polled──◀── Vercel Cron /api/sync ────────────────┘            │
                                                                     ▼
                                       Telegram Bot ◀── /api/notify (порог 50 000 ₸)
                                                                     ▲
                                       /api/telegram/webhook ◀── BotFather
```

## Схема Supabase (черновик)
```sql
create table orders (
  id bigint primary key,                 -- retailCRM id
  external_id text,
  number text,
  status text,
  total_summ numeric,
  customer_name text,
  customer_phone text,
  city text,
  utm_source text,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb
);
create index orders_created_at_idx on orders (created_at desc);

create table telegram_subscribers (
  chat_id bigint primary key,
  username text,
  subscribed_at timestamptz default now()
);

create table sync_state (
  key text primary key,
  value timestamptz
);
```

## План работ (порядок)
1. **Setup:** аккаунты RetailCRM/Supabase/Vercel/BotFather, env vars
2. **Schema:** применить SQL выше в Supabase
3. **Upload mock orders:** `scripts/upload-orders.ts` → `/api/v5/orders/upload` (батчи по 50)
4. **Sync API route + cron:** `/api/sync` polling по `updatedAtFrom`
5. **Webhook receiver:** `/api/webhooks/retailcrm` (upsert + порог-чек)
6. **Telegram bot:** `/api/telegram/webhook` обрабатывает `/start`, sender util
7. **Dashboard:** 4 метрики на одной странице
8. **Deploy:** Vercel + env vars + регистрация webhook'ов в RetailCRM и Telegram
9. **README:** промпты, грабли, скриншот уведомления

## Открытые риски
- RetailCRM demo может не дать `webhooks` API → fallback на cron-only
- Free Vercel cron — минимальный интервал 1/час на hobby; если нужно чаще, остаётся webhook
- Mock-заказы используют `productName` (free-text), не SKU — `/orders/upload` принимает, валидируем на dry-run первой партии из 5
