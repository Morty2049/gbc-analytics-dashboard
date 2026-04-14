# Stack & Tools

## Recommended stack (минимально достаточный, MVP за 1 день)

| Слой | Выбор | Почему |
|---|---|---|
| Загрузка mock → RetailCRM | Node-скрипт `tsx scripts/upload-orders.ts` + native `fetch` | `/orders/upload` принимает 50 шт за раз — ровно наш кейс |
| RetailCRM → Supabase sync | Supabase Edge Function (Deno) на cron, или Vercel Cron Job | бесплатно, без отдельного сервера |
| БД | Supabase Postgres, таблица `orders` (id, external_id, status, total, created_at, customer_name, city, raw jsonb) | jsonb для гибкости + типизированные колонки для графиков |
| Дашборд | **Next.js 15 (App Router) на Vercel** + Recharts/Tremor | прямая интеграция Vercel, Supabase JS client, нативный SSR |
| Auth дашборда | Supabase RLS + anon key (read-only вьюха) | минимум кода |
| Telegram-бот | Webhook от RetailCRM → Vercel API route → `sendMessage` Bot API | без long-polling, 0 серверов |

## Cursor/Claude skills, релевантные стеку

- **`claude-api`** (доступен) — если решим встроить AI-генерацию инсайтов по заказам (опционально)
- **`subagent-driven-development`** (доступен) — для параллельного исполнения шагов (upload, sync, dashboard, bot) как независимых задач
- **`simplify`** — пройтись по итоговому коду перед сдачей
- **MCP, которые имеет смысл подключить:**
  - `supabase` MCP — управлять схемой/RLS из чата
  - `vercel` MCP — деплой и env vars
  - официального `retailcrm` MCP нет → используем `fetch` напрямую
  - Telegram — обычный HTTPS, MCP не нужен

## Env vars (черновик `.env.local`)
```
RETAILCRM_URL=https://<subdomain>.retailcrm.ru
RETAILCRM_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
ORDER_ALERT_THRESHOLD_KZT=50000
```
