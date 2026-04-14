# ADR — GBC Retail CRM Analytics

Session handover. Source of truth для следующей сессии в native Claude Code IDE.
Дата: 2026-04-14.

---

## 1. Цель

Тестовое задание AI Tools Specialist: мини-дашборд заказов на стеке
**RetailCRM → Supabase → Next.js (Vercel) + Telegram bot**. Полное ТЗ:
[README.md](../README.md).

Deliverables:
- Ссылка на работающий дашборд на Vercel
- GitHub-репо (форк `Morty2049/gbc-analytics-dashboard`)
- Скриншот Telegram-уведомления
- Раздел в README: какие промпты, где застряли, как решили

## 2. Рабочая директория и git

- **Корень проекта:** клон форка репозитория
- **origin:** `https://github.com/Morty2049/gbc-analytics-dashboard.git`
- **Branch:** `main`, ahead of `origin/main` by 1 commit (`f2ba5ed` — не запушен, ждёт подтверждения)

Untracked / uncommitted (на момент handover):
- `scripts/check-retailcrm.mjs` — валидатор API, работает
- `docs/adr.md` — этот файл

## 3. Финализированные решения (с подтверждением пользователя)

| Слой | Выбор |
|---|---|
| Frontend | **Next.js 15 (App Router) + Tremor** на Vercel |
| БД | **Supabase Postgres** (project ref `aljlvlvgdfwxikhmaona`, name `Quaso`, free tier) |
| Sync RetailCRM → Supabase | **Webhook + Cron fallback** (webhook для realtime, cron каждые 15 мин как страховка) |
| Telegram | **Бот с `/start` подпиской**, `chat_id` подписчиков хранятся в Supabase `telegram_subscribers` |
| Метрики дашборда | Orders by day, Revenue by day, Top cities / utm_sources, Recent orders table |
| Порог Telegram-алерта | `ORDER_ALERT_THRESHOLD_KZT=50000` |
| Runtime | Node 25 (`--env-file=.env.local`), без доп. package manager'а до первой нужды |

Детали плана и архитектуры: [docs/gsd-brief.md](gsd-brief.md).
Выжимка RetailCRM API v5: [docs/retailcrm-api.md](retailcrm-api.md).
Стек-обоснование: [docs/stack.md](stack.md).

## 4. Окружение и доступы

`.env.local` заполнен, `.env.example` — чистый шаблон (в git).

Готовые значения (в `.env.local`, не коммитится):
- **RetailCRM** ✅ `RETAILCRM_URL`, `RETAILCRM_API_KEY`, `RETAILCRM_SITE`
- **Supabase** ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (новый формат `sb_publishable_...`), `SUPABASE_PROJECT_REF`
- **Telegram** ✅ `TELEGRAM_BOT_TOKEN` (для `@gbc_analytics_best_bot`), `TELEGRAM_BOT_USERNAME`, `TELEGRAM_TEST_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`
- **App** ✅ `ORDER_ALERT_THRESHOLD_KZT=50000`

Пустое, заполнится по ходу:
- `SUPABASE_SERVICE_ROLE_KEY` — возьмём перед деплоем на Vercel (Project API Keys → secret → Reveal & copy)
- `NEXT_PUBLIC_APP_URL` — после первого Vercel-деплоя

Шаблон всех переменных — в [.env.example](../.env.example).

## 5. MCP серверы

Настроены в `~/.claude.json` (project scope):
- **`supabase`** — HTTP, `https://mcp.supabase.com/mcp?project_ref=aljlvlvgdfwxikhmaona`, `✓ Connected`. В этой сессии VSCode-обёртки Claude Code tools не подгрузились (баг UI). В native IDE уже доступны через `ToolSearch select:mcp__claude_ai_Supabase__*` — есть `execute_sql`, `apply_migration`, `list_tables`, `deploy_edge_function`, `generate_typescript_types` и т.д.
- **`vercel`** — HTTP, `https://mcp.vercel.com`, требует OAuth (в следующей сессии: `/mcp` → `vercel` → Authenticate)

Есть также "claude.ai Supabase" (web-интеграция Anthropic) — тот же API, но не project-scoped. Оба работают взаимозаменяемо.

## 6. Tooling на машине

- ✅ `node` 25.8.0 (встроенные `fetch` и `--env-file`)
- ✅ `git` + `gh` 2.89 (установлен через `brew install gh`; `gh auth login` ещё не выполнен)
- ✅ `brew` 5.1.5
- ❌ `tsx` — не нужен, пишем `.mjs`
- ❌ `supabase` CLI — не установлен (используем MCP напрямую)
- ❌ `vercel` CLI — поставим перед деплоем (`brew install vercel-cli` или `npm i -g vercel`)

## 7. Сделано

1. ✅ Склонирован форк, указан правильный `origin` на `Morty2049/...`
2. ✅ Реорганизация: всё в один репо (удалён внешний wrapper git-init)
3. ✅ Написаны docs: [retailcrm-api.md](retailcrm-api.md), [stack.md](stack.md), [gsd-brief.md](gsd-brief.md)
4. ✅ `.env.example` шаблон (committed) и `.env.local` (заполнен, gitignored)
5. ✅ Коммит `f2ba5ed chore: scaffold project — docs, env template, solution section in README` — **не запушен**
6. ✅ MCP серверы добавлены: `supabase` (HTTP + OAuth), `vercel` (HTTP + OAuth)
7. ✅ Установлен `gh` CLI
8. ✅ **Валидация RetailCRM API**: [scripts/check-retailcrm.mjs](../scripts/check-retailcrm.mjs) — успешно проверяет credentials и печатает справочники

### Результаты валидации RetailCRM (demo-аккаунт `quaso`)

- `access_full`, 187 API-методов доступны
- Sites: **`quaso`** (единственный)
- **Order types:** `main` (Основной) — только один, используем его
- **Order methods** (11 шт): `phone`, `shopping-cart`, `one-click`, `price-decrease-request`, `landing-page`, `offline`, `app`, `live-chat`, `terminal`, `missed-call`, `messenger`
- **Statuses** (24 шт): `new`, `complete`, `partially-completed`, `availability-confirmed`, `offer-analog`, `ready-to-wait`, `waiting-for-arrival`, `client-confirmed`, `prepayed`, `send-to-assembling`, `assembling`, `assembling-complete`, `send-to-delivery`, `delivering`, `redirect`, `ready-for-self-pickup`, `arrived-in-pickup-point`, `no-call`, `no-product`, `already-buyed`, `delyvery-did-not-suit`, `prices-did-not-suit`, `cancel-other`, `return`
- **Текущее количество заказов:** 0 (чистая база, можно грузить mock)
- **⚠️ Скрипт отметил `orders write permission: false`** — это **false-negative** моей проверки: я искал точную строку `/api/v5/orders/create` среди методов, retailCRM возвращает их в другом формате (`/api/v5/orders/{externalId}/edit` и т.п.). Но `access_full` + 187 методов подтверждают что доступ на запись есть. **Fix для следующей сессии:** убрать hasOrderWrite проверку или искать по regex `/orders(\/create|\/upload|$)/`.

### Соответствие `mock_orders.json` → RetailCRM

- `orderType: "eshop-individual"` в mock ❌ не существует в нашем аккаунте — **нужно заменить на `main`** при upload
- `orderMethod: "shopping-cart"` ✅ существует
- `status: "new"` ✅ существует
- `firstName/lastName/phone/email` — inline customer, работает
- `items[].productName / initialPrice / quantity` — работает для free-text позиций (без привязки к каталогу)
- `delivery.address.{city, text}` ✅
- `customFields.utm_source` ✅ — но нужно проверить что custom field `utm_source` заведено в проекте (Settings → Custom Fields → Orders). Если нет — создать через `/reference/custom-fields/edit` или положить в `notes`/`customerComment`

## 8. Следующие шаги (в порядке)

1. **Исправить и расширить upload-скрипт** — `scripts/upload-orders.mjs`:
   - читать `mock_orders.json`
   - маппить `orderType` → `main`
   - проверить/создать custom field `utm_source` (`GET /reference/custom-fields` → если нет, `POST /custom-fields/create`)
   - грузить батчами по 50 через `POST /api/v5/orders/upload` (форма `site=...&orders=<JSON>`)
   - `--dry-run` флаг для первой проверки 5 заказов
2. **Supabase schema** через MCP `apply_migration`:
   ```sql
   create table orders (
     id bigint primary key,
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
3. **Sync RetailCRM → Supabase**: Next.js API route `/api/sync` + Vercel Cron 15 мин, использует `filter[updatedAtFrom]` из `sync_state`
4. **Webhook receiver** `/api/webhooks/retailcrm` (+ регистрация webhook в admin UI RetailCRM)
5. **Telegram бот**: `/api/telegram/webhook` обрабатывает `/start` → insert в `telegram_subscribers`; utility `sendTelegram(chatId, text)`; в webhook receiver — чек порога 50 000 ₸
6. **Next.js дашборд**: `app/page.tsx` + Tremor Cards/Charts, 4 метрики (orders/day, revenue/day, top cities/utm, recent orders table), `@supabase/supabase-js` на anon ключе через RLS
7. **Deploy**: `vercel link`, env vars через Vercel MCP, первый deploy, регистрация Telegram webhook и RetailCRM webhook с production URL
8. **README дополнить разделом "Решение"** с промптами и граблями
9. **Push** — всё время держим на локальном main до явного разрешения пользователя

## 9. Открытые решения на следующую сессию

- Сразу писать Next.js проект в корне fork или в подпапке `app/` рядом с `mock_orders.json`? **Рекомендация:** в корне, `mock_orders.json` остаётся, `scripts/` остаются, добавляются `app/`, `package.json`, `next.config.js`, etc. — так Vercel подхватит root automatically.
- Для бота `/start` подписки — использовать Telegram webhook (нужен public URL, т.е. после первого деплоя) или polling через cron для локальной разработки? **Рекомендация:** webhook после деплоя, до того момента используем `TELEGRAM_TEST_CHAT_ID` напрямую.
- utm_source custom field — создавать программно или вручную в RetailCRM UI? **Рекомендация:** вручную (1 клик), быстрее.

## 10. Команды для рестарта в новой сессии

```bash
cd <project root>

# Проверить что всё на месте
git status
git log --oneline -5
cat docs/adr.md | head -5
node --env-file=.env.local scripts/check-retailcrm.mjs

# В Claude Code:
# /mcp → supabase (должен быть ✓), vercel → Authenticate (если ещё нет)
# Начать со Шага 1 из раздела 8.
```
