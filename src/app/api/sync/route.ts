import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { fetchOrders } from "@/lib/retailcrm";

// Called by Vercel Cron daily (or manually via GET).
// Pulls orders updated since last sync from RetailCRM → upserts into Supabase.
// Uses a per-field merge so that NULLs from RetailCRM never overwrite
// richer data already in Supabase (e.g. when a name was set via direct
// insert from mock_orders.json but RetailCRM list response doesn't expose it).
export async function GET() {
  try {
    const sb = createServiceClient();

    const { data: syncRow } = await sb
      .from("sync_state")
      .select("value")
      .eq("key", "last_sync")
      .single();

    const since = syncRow?.value
      ? new Date(syncRow.value).toISOString().replace("T", " ").slice(0, 19)
      : "2020-01-01 00:00:00";

    let page = 1;
    let totalUpserted = 0;

    while (true) {
      const { orders, pagination } = await fetchOrders(
        { createdAtFrom: since },
        page,
      );

      if (orders.length === 0) break;

      const rows = orders.map(mapOrder);

      // Fetch existing rows to preserve non-null fields
      const ids = rows.map((r) => r.id);
      const { data: existing } = await sb
        .from("orders")
        .select("id, customer_name, customer_phone, city, utm_source, created_at")
        .in("id", ids);

      const existingById = new Map(
        (existing ?? []).map((e) => [e.id, e]),
      );

      const merged = rows.map((r) => {
        const prev = existingById.get(r.id);
        if (!prev) return r;
        return {
          ...r,
          // Prefer existing values if RetailCRM sent null
          customer_name: r.customer_name ?? prev.customer_name,
          customer_phone: r.customer_phone ?? prev.customer_phone,
          city: r.city ?? prev.city,
          utm_source: r.utm_source ?? prev.utm_source,
          // Don't overwrite an already-set created_at if present
          created_at: prev.created_at ?? r.created_at,
        };
      });

      const { error } = await sb.from("orders").upsert(merged, { onConflict: "id" });
      if (error) throw error;

      totalUpserted += merged.length;
      if (page >= pagination.totalPageCount) break;
      page++;
    }

    await sb
      .from("sync_state")
      .upsert({ key: "last_sync", value: new Date().toISOString() });

    return NextResponse.json({ ok: true, upserted: totalUpserted });
  } catch (e) {
    console.error("Sync error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function mapOrder(o: Record<string, unknown>) {
  const customer = (o.customer ?? {}) as Record<string, unknown>;
  const delivery = (o.delivery ?? {}) as Record<string, unknown>;
  const address = (delivery.address ?? {}) as Record<string, unknown>;
  return {
    id: o.id,
    external_id: o.externalId ?? null,
    number: o.number ?? null,
    status: o.status ?? null,
    total_summ: Number(o.totalSumm ?? 0),
    customer_name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
    customer_phone: (customer.phones as { number?: string }[])?.[0]?.number ?? null,
    city: address.city?.toString() ?? null,
    utm_source: Array.isArray(o.customFields)
      ? null
      : (o.customFields as Record<string, unknown>)?.utm_source?.toString() ?? null,
    created_at: o.createdAt ?? null,
    updated_at: o.statusUpdatedAt ?? o.createdAt ?? null,
    raw: o,
  };
}
