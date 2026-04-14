#!/usr/bin/env node
/**
 * One-shot sync: pull all orders from RetailCRM → upsert into Supabase.
 * Usage: node --env-file=.env.local scripts/sync-to-supabase.mjs
 *
 * Requires: RETAILCRM_URL, RETAILCRM_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.RETAILCRM_URL;
const KEY = process.env.RETAILCRM_API_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE || !KEY) { console.error("Missing RETAILCRM env vars"); process.exit(1); }
if (!SB_URL || !SB_KEY) { console.error("Missing SUPABASE env vars"); process.exit(1); }

const sb = createClient(SB_URL, SB_KEY);

function mapOrder(o) {
  const customer = o.customer || {};
  const phones = customer.phones || [];
  return {
    id: o.id,
    external_id: o.externalId || null,
    number: o.number || null,
    status: o.status || null,
    total_summ: Number(o.totalSumm || 0),
    customer_name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
    customer_phone: phones[0]?.number || null,
    city: o.delivery?.address?.city || null,
    utm_source: o.customFields?.utm_source || null,
    created_at: o.createdAt || null,
    updated_at: o.statusUpdatedAt || o.createdAt || null,
    raw: o,
  };
}

async function fetchOrdersPage(page = 1) {
  const url = new URL(`/api/v5/orders`, BASE);
  url.searchParams.set("apiKey", KEY);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", String(page));
  const res = await fetch(url);
  return res.json();
}

async function main() {
  let page = 1;
  let total = 0;

  while (true) {
    const data = await fetchOrdersPage(page);
    if (!data.success) { console.error("API error:", data); break; }

    const orders = data.orders || [];
    if (orders.length === 0) break;

    const rows = orders.map(mapOrder);
    const { error } = await sb.from("orders").upsert(rows, { onConflict: "id" });
    if (error) { console.error("Supabase upsert error:", error); process.exit(1); }

    total += rows.length;
    console.log(`Page ${page}: synced ${rows.length} orders (total: ${total})`);

    if (page >= data.pagination.totalPageCount) break;
    page++;
  }

  // Update sync_state
  await sb.from("sync_state").upsert({ key: "last_sync", value: new Date().toISOString() });
  console.log(`Done. Total synced: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
